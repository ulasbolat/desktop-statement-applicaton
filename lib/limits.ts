import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Türkiye saatiyle günün başlangıcı.
 *
 * Türkiye 2016'dan beri sabit UTC+3 (yaz saati uygulaması yok), o yüzden
 * offset'i sabit alabiliyoruz. Bu değişirse burası güncellenmeli.
 */
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

export function istanbulGunBaslangici(simdi: Date = new Date()): Date {
  const trZamani = simdi.getTime() + TR_OFFSET_MS;
  const gunBasiTr = Math.floor(trZamani / 86_400_000) * 86_400_000;
  return new Date(gunBasiTr - TR_OFFSET_MS);
}

export type LimitDurumu = {
  kullanilan: number;
  limit: number;
  kalan: number;
  asildi: boolean;
};

/**
 * Kullanıcının bugün kaç yükleme yaptığını sayar.
 *
 * Cache'ten gelen (yani Claude'a hiç gitmeyen) yüklemeler de sayılıyor:
 * kural "günde 3 yükleme". Sadece maliyetli olanları saymak isterseniz
 * buraya `.neq("status", ...)` benzeri bir filtre eklemek yeterli.
 */
export async function gunlukLimitDurumu(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<LimitDurumu> {
  const limit = serverEnv().dailyUploadLimit;

  const { count, error } = await admin
    .from("decks")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .gte("created_at", istanbulGunBaslangici().toISOString());

  if (error) throw new Error(`Günlük limit sorgulanamadı: ${error.message}`);

  const kullanilan = count ?? 0;
  return {
    kullanilan,
    limit,
    kalan: Math.max(0, limit - kullanilan),
    asildi: kullanilan >= limit,
  };
}
