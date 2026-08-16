import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Service role client'ı — RLS'i TAMAMEN bypass eder.
 *
 * Sadece kullanıcının kendi adına yapamayacağı işler için: PDF metni okuma,
 * üretilen soruları yazma, usage log'u yazma. Her kullanımda "bu kullanıcı
 * gerçekten bu destenin sahibi mi?" kontrolünü elle yapmak zorundasın —
 * çünkü veritabanı artık senin için kontrol etmiyor.
 *
 * `server-only` importu sayesinde bir client component bunu import ederse
 * build hata verir.
 */
export function createAdminClient() {
  return createSupabaseClient(
    publicEnv.supabaseUrl,
    serverEnv().supabaseServiceRoleKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
