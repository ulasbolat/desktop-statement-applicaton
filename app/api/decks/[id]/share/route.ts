import { customAlphabet } from "nanoid";
import { NextResponse } from "next/server";

import { govdeyiOku, girisGerekli, hataCevabi, sunucuHatasi } from "@/lib/api";
import { createClient, getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Karışabilecek karakterler (0/O, 1/l/I) çıkarıldı — link elle
// yazılabilir/okunabilir olsun.
const slugUret = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 10);

/**
 * Paylaşımı açar veya kapatır.
 *
 * Slug bir kez üretilip saklanıyor: kapatıp tekrar açınca aynı link
 * çalışsın diye. (Linki "iptal etmek" isteyen kullanıcı için ileride
 * yenileme seçeneği eklenebilir.)
 */
export async function POST(request: Request, ctx: RouteContext<"/api/decks/[id]/share">) {
  try {
    const { id } = await ctx.params;

    const user = await getUser();
    if (!user) return girisGerekli();

    const govde = await govdeyiOku(request);
    const acik =
      typeof govde === "object" &&
      govde !== null &&
      (govde as { acik?: unknown }).acik === true;

    const supabase = await createClient();

    // RLS: sadece kendi destesini görebilir/güncelleyebilir.
    const { data: deste } = await supabase
      .from("decks")
      .select("id, status, share_slug, is_public")
      .eq("id", id)
      .maybeSingle();

    if (!deste) return hataCevabi("Deste bulunamadı.", 404, "yok");

    if (acik && deste.status !== "ready") {
      return hataCevabi(
        "Deste henüz hazır değil, hazırlanınca paylaşabilirsin.",
        400,
        "hazir_degil",
      );
    }

    const slug = deste.share_slug ?? slugUret();

    const { error } = await supabase
      .from("decks")
      .update({ is_public: acik, share_slug: slug })
      .eq("id", id);

    if (error) return hataCevabi("Paylaşım güncellenemedi.", 400, "guncellenemedi");

    return NextResponse.json({ acik, slug });
  } catch (hata) {
    return sunucuHatasi(hata);
  }
}
