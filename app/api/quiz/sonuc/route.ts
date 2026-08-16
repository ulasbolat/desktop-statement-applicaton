import { NextResponse } from "next/server";

import { govdeyiOku, girisGerekli, hataCevabi, sunucuHatasi } from "@/lib/api";
import { ilkYanlis } from "@/lib/srs";
import { createClient, getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Govde = {
  deckId: string;
  dogruSayisi: number;
  toplamSoru: number;
  yanlisSoruIdleri: string[];
};

function govdeyiDogrula(ham: unknown): Govde | null {
  if (typeof ham !== "object" || ham === null) return null;
  const { deckId, dogruSayisi, toplamSoru, yanlisSoruIdleri } = ham as Record<
    string,
    unknown
  >;

  if (typeof deckId !== "string" || deckId.length === 0) return null;
  if (!Number.isInteger(dogruSayisi) || (dogruSayisi as number) < 0) return null;
  if (!Number.isInteger(toplamSoru) || (toplamSoru as number) <= 0) return null;
  if ((dogruSayisi as number) > (toplamSoru as number)) return null;
  if (
    !Array.isArray(yanlisSoruIdleri) ||
    yanlisSoruIdleri.some((x) => typeof x !== "string")
  ) {
    return null;
  }

  return {
    deckId,
    dogruSayisi: dogruSayisi as number,
    toplamSoru: toplamSoru as number,
    yanlisSoruIdleri: yanlisSoruIdleri as string[],
  };
}

/**
 * Quiz bitince çağrılır: denemeyi kaydeder ve yanlışları tekrar kuyruğuna
 * ekler.
 *
 * Kullanıcının kendi oturumuyla yazıyoruz — RLS başkası adına kayıt
 * atılmasını zaten engelliyor, ayrıca sahiplik kontrolü gerekmiyor.
 */
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return girisGerekli();

    const govde = govdeyiDogrula(await govdeyiOku(request));
    if (!govde) return hataCevabi("Geçersiz istek.", 400, "gecersiz_govde");

    const supabase = await createClient();

    const { error } = await supabase.from("attempts").insert({
      user_id: user.id,
      deck_id: govde.deckId,
      correct_count: govde.dogruSayisi,
      total_count: govde.toplamSoru,
    });

    if (error) {
      // Deste kullanıcıya ait değilse RLS burada devreye girer.
      return hataCevabi("Sonuç kaydedilemedi.", 400, "kaydedilemedi");
    }

    // ── Yanlışları tekrar kuyruğuna al ─────────────────────────────────
    let kuyrugaEklenen = 0;

    if (govde.yanlisSoruIdleri.length > 0) {
      // Soruların gerçekten bu desteye ait olduğunu doğruluyoruz; istemciden
      // gelen id listesine olduğu gibi güvenmiyoruz.
      const { data: gecerliSorular } = await supabase
        .from("questions")
        .select("id")
        .eq("deck_id", govde.deckId)
        .in("id", govde.yanlisSoruIdleri);

      const idler = (gecerliSorular ?? []).map((s) => s.id);

      if (idler.length > 0) {
        const { stage, dueAt } = ilkYanlis();

        // Kaç kez yanlış yapıldığını sayabilmek için mevcut kayıtları
        // okuyoruz. Upsert'te belirtmezsek sayaç hiç artmaz, belirtip sabit
        // değer yazarsak da geçmiş kaybolur.
        const { data: mevcutlar } = await supabase
          .from("reviews")
          .select("question_id, wrong_count")
          .eq("user_id", user.id)
          .in("question_id", idler);

        const yanlisSayaci = new Map(
          (mevcutlar ?? []).map((m) => [m.question_id, m.wrong_count]),
        );

        // Soru zaten kuyruktaysa üzerine yazıyoruz: tekrar yanlış yapıldıysa
        // en baştan (1 gün) başlaması doğru davranış.
        const { error: tekrarHatasi } = await supabase.from("reviews").upsert(
          idler.map((questionId) => ({
            user_id: user.id,
            question_id: questionId,
            deck_id: govde.deckId,
            stage,
            due_at: dueAt.toISOString(),
            wrong_count: (yanlisSayaci.get(questionId) ?? 0) + 1,
            last_answered: new Date().toISOString(),
          })),
          { onConflict: "user_id,question_id" },
        );

        if (tekrarHatasi) {
          console.error("[quiz] tekrar kuyruğu yazılamadı:", tekrarHatasi.message);
        } else {
          kuyrugaEklenen = idler.length;
        }
      }
    }

    return NextResponse.json({ kaydedildi: true, kuyrugaEklenen });
  } catch (hata) {
    return sunucuHatasi(hata);
  }
}
