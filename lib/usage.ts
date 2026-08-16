import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";

import type { Database } from "@/types/database";

/**
 * claude-sonnet-4-6 fiyatlandırması (milyon token başına USD).
 * Cache yazma girdinin 1.25 katı, cache okuma 0.1 katı.
 *
 * Model değişirse burayı da güncelle — yoksa maliyet raporu yanıltır.
 */
const FIYAT = {
  "claude-sonnet-4-6": { girdi: 3, cikti: 15 },
  "claude-sonnet-5": { girdi: 3, cikti: 15 },
  "claude-opus-5": { girdi: 5, cikti: 25 },
  "claude-haiku-4-5": { girdi: 1, cikti: 5 },
} as const satisfies Record<string, { girdi: number; cikti: number }>;

const VARSAYILAN_FIYAT = { girdi: 3, cikti: 15 };

export function maliyetHesapla(
  model: string,
  usage: Anthropic.Usage,
): number {
  const fiyat =
    (FIYAT as Record<string, { girdi: number; cikti: number }>)[model] ??
    VARSAYILAN_FIYAT;

  const girdi = usage.input_tokens ?? 0;
  const cikti = usage.output_tokens ?? 0;
  const cacheYazma = usage.cache_creation_input_tokens ?? 0;
  const cacheOkuma = usage.cache_read_input_tokens ?? 0;

  const toplam =
    girdi * fiyat.girdi +
    cacheYazma * fiyat.girdi * 1.25 +
    cacheOkuma * fiyat.girdi * 0.1 +
    cikti * fiyat.cikti;

  return toplam / 1_000_000;
}

export type KullanimKaydi = {
  userId: string;
  deckId: string;
  step: string;
  model: string;
  usage: Anthropic.Usage;
  latencyMs: number;
};

/**
 * Her Claude çağrısının token kullanımını yazar.
 *
 * Loglama başarısız olursa üretimi DURDURMUYORUZ — kullanıcının destesi
 * hazırken sırf log yazılamadı diye işi patlatmak yanlış olur. Hata
 * sunucu log'una düşer.
 */
export async function kullanimiLogla(
  admin: SupabaseClient<Database>,
  kayit: KullanimKaydi,
): Promise<void> {
  const { usage } = kayit;
  const { error } = await admin.from("llm_usage_logs").insert({
    user_id: kayit.userId,
    deck_id: kayit.deckId,
    step: kayit.step,
    model: kayit.model,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    estimated_cost_usd: Number(maliyetHesapla(kayit.model, usage).toFixed(6)),
    latency_ms: kayit.latencyMs,
  });

  if (error) console.error("[usage] log yazılamadı:", error.message);
}
