import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";

/** Giriş zorunlu olan yollar. */
const KORUMALI_YOLLAR = ["/panel", "/deste", "/tekrar"];

/**
 * Next 16'da bu dosya `middleware.ts` değil `proxy.ts`, fonksiyon adı da
 * `proxy`. Görevi: her istekte Supabase oturum cookie'sini tazelemek ve
 * giriş yapmamış kullanıcıyı korumalı sayfalardan çevirmek.
 *
 * NOT: Buradaki yönlendirme bir güvenlik sınırı değil, sadece kullanıcı
 * deneyimi. Asıl koruma RLS'te ve sayfaların kendi kontrolünde.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() token'ı sunucuda doğrular ve gerekirse tazeler.
  // getSession() yerine bunu kullan — o sadece cookie'ye bakar, doğrulamaz.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const yol = request.nextUrl.pathname;
  const korumali = KORUMALI_YOLLAR.some(
    (p) => yol === p || yol.startsWith(`${p}/`),
  );

  if (korumali && !user) {
    const girisUrl = request.nextUrl.clone();
    girisUrl.pathname = "/giris";
    girisUrl.searchParams.set("devam", yol);
    return NextResponse.redirect(girisUrl);
  }

  if (yol === "/giris" && user) {
    const panelUrl = request.nextUrl.clone();
    panelUrl.pathname = "/panel";
    panelUrl.search = "";
    return NextResponse.redirect(panelUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Statik dosyalar ve resim optimizasyonu hariç her yol.
     * Paylaşım linkleri (/p/...) de buradan geçiyor ama korumalı değil —
     * oturum cookie'si varsa tazelensin diye.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
