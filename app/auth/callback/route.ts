import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Google'dan dönüş noktası. Supabase bize bir `code` verir, biz onu
 * oturum cookie'sine çeviririz.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const devam = searchParams.get("devam");

  // Açık yönlendirme (open redirect) koruması: sadece kendi sitemizdeki
  // göreli yollara dönüyoruz. "//evil.com" gibi protokolsüz mutlak URL'ler
  // de eleniyor.
  const hedef =
    devam && devam.startsWith("/") && !devam.startsWith("//") ? devam : "/panel";

  if (!code) {
    return NextResponse.redirect(`${origin}/giris?hata=kod_yok`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/giris?hata=oturum`);
  }

  return NextResponse.redirect(`${origin}${hedef}`);
}
