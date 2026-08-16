import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Server component / route handler için Supabase client'ı.
 * Kullanıcının oturumunu cookie'den okur, yani RLS kullanıcı adına çalışır.
 *
 * Next 16'da cookies() async — bu yüzden fonksiyon await'lenmeli.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server component içinden cookie yazılamaz. Oturum yenilemesini
            // zaten proxy.ts yapıyor, burada sessizce geçmek güvenli.
          }
        },
      },
    },
  );
}

/** Oturum açmış kullanıcıyı döner, yoksa null. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
