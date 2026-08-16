import { NextResponse } from "next/server";

import { govdeyiOku, girisGerekli, hataCevabi, sunucuHatasi } from "@/lib/api";
import { LIMITS } from "@/lib/env";
import { gecerliHashMi, sha256Hex } from "@/lib/hash";
import { gunlukLimitDurumu } from "@/lib/limits";
import { pdfMetniCikar } from "@/lib/pdf/extract";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
// PDF indirme + parse birkaç saniye sürebilir; Hobby limitinin altında.
export const maxDuration = 60;

type Govde = { storagePath: string; fileHash: string; fileName: string };

function govdeyiDogrula(ham: unknown): Govde | null {
  if (typeof ham !== "object" || ham === null) return null;
  const { storagePath, fileHash, fileName } = ham as Record<string, unknown>;
  if (typeof storagePath !== "string") return null;
  if (typeof fileName !== "string" || fileName.length === 0) return null;
  if (!gecerliHashMi(fileHash)) return null;
  return { storagePath, fileHash, fileName };
}

/** "Hücre Biyolojisi Hafta 3.pdf" → "Hücre Biyolojisi Hafta 3" */
function baslikUret(fileName: string): string {
  const temiz = fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  return (temiz.length > 0 ? temiz : "Adsız deste").slice(0, 200);
}

/**
 * PDF yüklendikten SONRA çağrılır. Dosyanın kendisi tarayıcıdan doğrudan
 * Supabase Storage'a gidiyor (Vercel'in ~4.5 MB istek gövdesi limiti
 * yüzünden), buraya sadece yolu geliyor.
 *
 * Burada yapılanlar:
 *   1. günlük yükleme limiti
 *   2. dosyayı indir, hash'i YENİDEN hesapla (istemciye güvenmiyoruz)
 *   3. aynı hash daha önce işlenmiş mi? → cache
 *   4. değilse metni çıkar ve kaydet
 *   5. deste kaydını aç
 *
 * Metin çıkarma bilerek burada, arka plan job'ında değil: bozuk/taranmış/
 * çok uzun PDF hatasını kullanıcı yükleme anında görsün, 20 saniye sonra
 * değil.
 */
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return girisGerekli();

    const govde = govdeyiDogrula(await govdeyiOku(request));
    if (!govde) {
      return hataCevabi("Geçersiz istek.", 400, "gecersiz_govde");
    }

    // Yol her zaman {user_id}/{hash}.pdf olmalı — hem storage politikasıyla
    // uyumlu hem de başkasının dosyasını işaret etmeyi engelliyor.
    const beklenenYol = `${user.id}/${govde.fileHash}.pdf`;
    if (govde.storagePath !== beklenenYol) {
      return hataCevabi("Geçersiz dosya yolu.", 400, "gecersiz_yol");
    }

    const admin = createAdminClient();

    const limit = await gunlukLimitDurumu(admin, user.id);
    if (limit.asildi) {
      return hataCevabi(
        `Günlük ${limit.limit} yükleme hakkını doldurdun. Yarın tekrar deneyebilirsin.`,
        429,
        "limit",
      );
    }

    // ── Dosyayı indir ve doğrula ────────────────────────────────────────
    const { data: dosya, error: indirmeHatasi } = await admin.storage
      .from("pdfs")
      .download(govde.storagePath);

    if (indirmeHatasi || !dosya) {
      return hataCevabi(
        "Yüklenen dosya bulunamadı. Tekrar yüklemeyi dene.",
        404,
        "dosya_yok",
      );
    }

    const bytes = new Uint8Array(await dosya.arrayBuffer());

    if (bytes.byteLength > LIMITS.maxFileBytes) {
      await admin.storage.from("pdfs").remove([govde.storagePath]);
      return hataCevabi(
        `Dosya ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB. En fazla ${LIMITS.maxFileBytes / 1024 / 1024} MB yükleyebilirsin.`,
        413,
        "cok_buyuk",
      );
    }

    const gercekHash = await sha256Hex(bytes);
    if (gercekHash !== govde.fileHash) {
      await admin.storage.from("pdfs").remove([govde.storagePath]);
      return hataCevabi(
        "Dosya doğrulanamadı. Tekrar yüklemeyi dene.",
        400,
        "hash_uyusmadi",
      );
    }

    // ── Cache: bu dosya daha önce işlendi mi? ───────────────────────────
    const { data: mevcutDokuman, error: dokumanHatasi } = await admin
      .from("source_documents")
      .select("id")
      .eq("file_hash", gercekHash)
      .maybeSingle();

    if (dokumanHatasi) throw dokumanHatasi;

    let sourceDocumentId = mevcutDokuman?.id ?? null;
    let cacheIsabeti = sourceDocumentId !== null;

    if (!sourceDocumentId) {
      const cikarma = await pdfMetniCikar(bytes);

      if (!cikarma.ok) {
        // Kullanılamayan dosyayı depoda tutmanın anlamı yok.
        await admin.storage.from("pdfs").remove([govde.storagePath]);
        return hataCevabi(cikarma.mesaj, 422, cikarma.kod);
      }

      const { data: yeniDokuman, error: ekleHatasi } = await admin
        .from("source_documents")
        .insert({
          file_hash: gercekHash,
          storage_path: govde.storagePath,
          page_count: cikarma.pageCount,
          char_count: cikarma.charCount,
          extracted_text: cikarma.text,
        })
        .select("id")
        .single();

      if (ekleHatasi) {
        // Yarış durumu: aynı anda iki yükleme aynı dosyayı eklemeye
        // çalıştıysa unique kısıtı patlar. O zaman diğerininkini kullan.
        const { data: yarisKazanani } = await admin
          .from("source_documents")
          .select("id")
          .eq("file_hash", gercekHash)
          .maybeSingle();

        if (!yarisKazanani) throw ekleHatasi;
        sourceDocumentId = yarisKazanani.id;
        cacheIsabeti = true;
      } else {
        sourceDocumentId = yeniDokuman.id;
      }
    }

    // ── Desteyi aç ──────────────────────────────────────────────────────
    const { data: deste, error: desteHatasi } = await admin
      .from("decks")
      .insert({
        owner_id: user.id,
        source_document_id: sourceDocumentId,
        title: baslikUret(govde.fileName),
        status: "pending",
        progress: 0,
      })
      .select("id, status, title")
      .single();

    if (desteHatasi) throw desteHatasi;

    return NextResponse.json({
      deckId: deste.id,
      status: deste.status,
      title: deste.title,
      cacheIsabeti,
      kalanHak: limit.kalan - 1,
    });
  } catch (hata) {
    return sunucuHatasi(hata);
  }
}
