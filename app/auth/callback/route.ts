import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Auth dönüş noktası. İki farklı akış buraya düşüyor:
 *
 *  1. Google (OAuth) → `code` parametresi gelir, oturuma çevrilir.
 *  2. E-posta ile kayıt doğrulaması → Supabase'in e-posta şablonuna göre
 *     ya `code` ya da `token_hash` + `type` gelir.
 *
 * İkisini de karşılıyoruz ki kullanıcı hangi yöntemle gelirse gelsin
 * "Giriş tamamlanamadı" ekranıyla karşılaşmasın.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const devam = searchParams.get("devam");

  // Açık yönlendirme (open redirect) koruması: sadece kendi sitemizdeki
  // göreli yollara dönüyoruz. "//evil.com" gibi protokolsüz mutlak URL'ler
  // de eleniyor.
  const hedef =
    devam && devam.startsWith("/") && !devam.startsWith("//") ? devam : "/panel";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/giris?hata=oturum`);
    }
    return NextResponse.redirect(`${origin}${hedef}`);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      return NextResponse.redirect(`${origin}/giris?hata=dogrulama`);
    }
    return NextResponse.redirect(`${origin}${hedef}`);
  }

  return NextResponse.redirect(`${origin}/giris?hata=kod_yok`);
}
