import { NextResponse } from "next/server";

import { govdeyiOku, girisGerekli, hataCevabi, sunucuHatasi } from "@/lib/api";
import { sonrakiTekrar } from "@/lib/srs";
import { createClient, getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Govde = { questionId: string; dogruMu: boolean };

function govdeyiDogrula(ham: unknown): Govde | null {
  if (typeof ham !== "object" || ham === null) return null;
  const { questionId, dogruMu } = ham as Record<string, unknown>;
  if (typeof questionId !== "string" || questionId.length === 0) return null;
  if (typeof dogruMu !== "boolean") return null;
  return { questionId, dogruMu };
}

/**
 * Tekrar kuyruğundaki bir soru cevaplandığında sıradaki tarihi hesaplar.
 *
 * Aralıklar lib/srs.ts'te: doğru → 3, 7 gün ve tamamlandı; yanlış → başa
 * dön (1 gün).
 */
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return girisGerekli();

    const govde = govdeyiDogrula(await govdeyiOku(request));
    if (!govde) return hataCevabi("Geçersiz istek.", 400, "gecersiz_govde");

    const supabase = await createClient();

    // RLS zaten başkasının kaydını göstermez.
    const { data: kayit } = await supabase
      .from("reviews")
      .select("id, stage, wrong_count")
      .eq("question_id", govde.questionId)
      .maybeSingle();

    if (!kayit) {
      return hataCevabi("Bu soru tekrar kuyruğunda değil.", 404, "yok");
    }

    const { stage, dueAt } = sonrakiTekrar(kayit.stage, govde.dogruMu);

    const { error } = await supabase
      .from("reviews")
      .update({
        stage,
        due_at: dueAt.toISOString(),
        last_answered: new Date().toISOString(),
        wrong_count: govde.dogruMu ? kayit.wrong_count : kayit.wrong_count + 1,
      })
      .eq("id", kayit.id);

    if (error) return hataCevabi("Kayıt güncellenemedi.", 400, "guncellenemedi");

    return NextResponse.json({ stage, dueAt: dueAt.toISOString() });
  } catch (hata) {
    return sunucuHatasi(hata);
  }
}
