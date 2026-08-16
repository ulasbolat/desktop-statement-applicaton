import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";

/** Tarayıcı tarafı Supabase client'ı. RLS anon key üzerinden uygulanır. */
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
