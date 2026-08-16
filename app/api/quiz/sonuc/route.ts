import { NextResponse } from "next/server";

import { govdeyiOku, girisGerekli, hataCevabi, sunucuHatasi } from "@/lib/api";
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
 * Quiz bitince çağrılır: denemeyi kaydeder.
 *
 * Kullanıcının kendi oturumuyla yazıyoruz — RLS başkası adına kayıt
 * atılmasını zaten engelliyor, ayrıca sahiplik kontrolü gerekmiyor.
 *
 * (Yanlış cevapların tekrar kuyruğuna eklenmesi Adım 6'da bu endpoint'e
 * eklenecek.)
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

    return NextResponse.json({ kaydedildi: true });
  } catch (hata) {
    return sunucuHatasi(hata);
  }
}
