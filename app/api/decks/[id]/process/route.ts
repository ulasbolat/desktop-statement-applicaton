import { NextResponse } from "next/server";

import { girisGerekli, hataCevabi, sunucuHatasi } from "@/lib/api";
import { UretimHatasi, kartlariUret, sorulariUret } from "@/lib/anthropic/generate";
import {
  cacheDenKopyala,
  ilerlemeHesapla,
  sonrakiAdim,
} from "@/lib/deck-pipeline";
import { LIMITS } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
// Tek bir parti (5 soru) ~30 sn. Hobby planının tavanı 60.
export const maxDuration = 60;

/**
 * Üretimin TEK bir adımını çalıştırır. İstemci deste hazır olana kadar
 * bunu sırayla tekrar çağırır.
 *
 * Neden parça parça: Hobby planında bir istek 60 sn'yi geçemiyor. 20 soruyu
 * tek çağrıda üretmek ~2 dakika sürer ve timeout'a düşer — üstelik token
 * yanar, karşılığında hiçbir şey alınmaz.
 *
 * Her adım idempotent: hangi adımda olduğumuzu veritabanındaki soru/kart
 * sayısından hesaplıyoruz, ayrı bir sayaç tutmuyoruz. Sayfa yenilense de
 * sekme kapansa da iş kaldığı yerden devam eder.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/decks/[id]/process">) {
  try {
    const { id } = await ctx.params;

    const user = await getUser();
    if (!user) return girisGerekli();

    const admin = createAdminClient();

    const { data: deste } = await admin
      .from("decks")
      .select("id, owner_id, source_document_id, status, error_message")
      .eq("id", id)
      .maybeSingle();

    if (!deste) return hataCevabi("Deste bulunamadı.", 404, "yok");

    // Service role RLS'i bypass ettiği için sahiplik kontrolünü BURADA
    // elle yapmak zorundayız.
    if (deste.owner_id !== user.id) {
      return hataCevabi("Bu desteye erişemezsin.", 403, "yetki");
    }

    if (deste.status === "ready") {
      return NextResponse.json({ status: "ready", progress: 100, bitti: true });
    }

    // Başarısız deste ancak açık istekle yeniden denenir.
    const tekrarMi =
      new URL(request.url).searchParams.get("tekrar") === "1";
    if (deste.status === "failed" && !tekrarMi) {
      return NextResponse.json({
        status: "failed",
        progress: 0,
        bitti: true,
        errorMessage: deste.error_message,
      });
    }

    const [{ count: soruSayisi }, { count: kartSayisi }] = await Promise.all([
      admin
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("deck_id", id),
      admin
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("deck_id", id),
    ]);

    let sorular = soruSayisi ?? 0;
    let kartlar = kartSayisi ?? 0;

    // ── Cache: aynı PDF'ten hazır deste var mı? ────────────────────────
    if (sorular === 0) {
      const kopyalandi = await cacheDenKopyala(admin, deste);
      if (kopyalandi) {
        await admin
          .from("decks")
          .update({ status: "ready", progress: 100, error_message: null })
          .eq("id", id);
        return NextResponse.json({
          status: "ready",
          progress: 100,
          bitti: true,
          cacheIsabeti: true,
        });
      }
    }

    const adim = sonrakiAdim(sorular, kartlar);

    if (adim.tur === "bitti") {
      await admin
        .from("decks")
        .update({ status: "ready", progress: 100, error_message: null })
        .eq("id", id);
      return NextResponse.json({ status: "ready", progress: 100, bitti: true });
    }

    await admin
      .from("decks")
      .update({ status: "generating", error_message: null })
      .eq("id", id);

    // ── Ders metnini al ────────────────────────────────────────────────
    const { data: dokuman } = await admin
      .from("source_documents")
      .select("extracted_text")
      .eq("id", deste.source_document_id)
      .single();

    if (!dokuman) {
      return await basarisizYap(
        admin,
        id,
        "Kaynak dosya bulunamadı. Desteyi silip PDF'i tekrar yükle.",
      );
    }

    try {
      if (adim.tur === "sorular") {
        // Aynı soruyu iki kez üretmesin diye mevcut soru köklerini veriyoruz.
        const { data: mevcut } = await admin
          .from("questions")
          .select("stem")
          .eq("deck_id", id)
          .order("position");

        const yeniSorular = await sorulariUret({
          admin,
          userId: user.id,
          deckId: id,
          partiNo: adim.partiNo,
          adet: adim.adet,
          dersMetni: dokuman.extracted_text,
          oncekiSorular: (mevcut ?? []).map((m) => m.stem),
        });

        if (yeniSorular.length === 0) {
          return await basarisizYap(
            admin,
            id,
            "Bu içerikten soru üretilemedi. Daha fazla metin içeren bir PDF dene.",
          );
        }

        const { error } = await admin.from("questions").insert(
          yeniSorular.map((s, i) => ({
            deck_id: id,
            position: sorular + i + 1,
            stem: s.soru,
            options: s.siklar,
            correct_index: s.dogru_sik,
            explanation: s.aciklama,
          })),
        );

        // 23505 = unique ihlali: aynı adım paralel çalışmış. Zararsız,
        // ilerleme zaten diğer istekte kaydedildi.
        if (error && error.code !== "23505") throw error;
        if (!error) sorular += yeniSorular.length;
      } else {
        const yeniKartlar = await kartlariUret({
          admin,
          userId: user.id,
          deckId: id,
          adet: LIMITS.totalFlashcards,
          dersMetni: dokuman.extracted_text,
        });

        const { error } = await admin.from("flashcards").insert(
          yeniKartlar.map((k, i) => ({
            deck_id: id,
            position: i + 1,
            front: k.on,
            back: k.arka,
          })),
        );

        if (error && error.code !== "23505") throw error;
        if (!error) kartlar += yeniKartlar.length;
      }
    } catch (hata) {
      if (hata instanceof UretimHatasi) {
        return await basarisizYap(admin, id, hata.kullaniciMesaji);
      }
      throw hata;
    }

    const bitti = sonrakiAdim(sorular, kartlar).tur === "bitti";
    const ilerleme = bitti ? 100 : ilerlemeHesapla(sorular, kartlar);

    await admin
      .from("decks")
      .update({
        status: bitti ? "ready" : "generating",
        progress: ilerleme,
      })
      .eq("id", id);

    return NextResponse.json({
      status: bitti ? "ready" : "generating",
      progress: ilerleme,
      soruSayisi: sorular,
      kartSayisi: kartlar,
      bitti,
    });
  } catch (hata) {
    return sunucuHatasi(hata);
  }
}

async function basarisizYap(
  admin: ReturnType<typeof createAdminClient>,
  deckId: string,
  mesaj: string,
) {
  await admin
    .from("decks")
    .update({ status: "failed", error_message: mesaj })
    .eq("id", deckId);

  return NextResponse.json({
    status: "failed",
    progress: 0,
    bitti: true,
    errorMessage: mesaj,
  });
}
