import { NextResponse } from "next/server";

import { girisGerekli, hataCevabi, sunucuHatasi } from "@/lib/api";
import { createClient, getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Destenin güncel durumu. Polling ekranı bunu okur.
 *
 * Kullanıcının kendi oturumuyla (service role değil) sorguluyoruz —
 * RLS başkasının destesini zaten göstermez, ekstra kontrol gerekmiyor.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/decks/[id]/status">) {
  try {
    const { id } = await ctx.params;

    const user = await getUser();
    if (!user) return girisGerekli();

    const supabase = await createClient();

    const { data: deste } = await supabase
      .from("decks")
      .select("id, status, progress, error_message")
      .eq("id", id)
      .maybeSingle();

    if (!deste) return hataCevabi("Deste bulunamadı.", 404, "yok");

    const [{ count: soruSayisi }, { count: kartSayisi }] = await Promise.all([
      supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("deck_id", id),
      supabase
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("deck_id", id),
    ]);

    return NextResponse.json({
      status: deste.status,
      progress: deste.progress,
      errorMessage: deste.error_message,
      soruSayisi: soruSayisi ?? 0,
      kartSayisi: kartSayisi ?? 0,
    });
  } catch (hata) {
    return sunucuHatasi(hata);
  }
}
