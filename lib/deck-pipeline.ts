import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { LIMITS, serverEnv } from "@/lib/env";
import type { Database, DeckStatus } from "@/types/database";

export type DesteDurumu = {
  status: DeckStatus;
  progress: number;
  soruSayisi: number;
  kartSayisi: number;
  errorMessage: string | null;
};

/**
 * İlerleme yüzdesi. Sorular işin büyük kısmı (%80), flashcard'lar kalanı.
 * Kullanıcı çubuğun ilerlediğini görsün diye her parti sonrası artıyor.
 */
export function ilerlemeHesapla(soruSayisi: number, kartSayisi: number) {
  const soruPayi = Math.round(
    (Math.min(soruSayisi, LIMITS.totalQuestions) / LIMITS.totalQuestions) * 80,
  );
  const kartPayi = kartSayisi > 0 ? 20 : 0;
  return Math.min(100, soruPayi + kartPayi);
}

export type SonrakiAdim =
  | { tur: "sorular"; partiNo: number; adet: number }
  | { tur: "kartlar" }
  | { tur: "bitti" };

export function sonrakiAdim(
  soruSayisi: number,
  kartSayisi: number,
): SonrakiAdim {
  const partiBoyu = Math.max(1, serverEnv().questionBatchSize);

  if (soruSayisi < LIMITS.totalQuestions) {
    return {
      tur: "sorular",
      partiNo: Math.floor(soruSayisi / partiBoyu) + 1,
      adet: Math.min(partiBoyu, LIMITS.totalQuestions - soruSayisi),
    };
  }

  if (kartSayisi === 0) return { tur: "kartlar" };

  return { tur: "bitti" };
}

/**
 * Aynı PDF'ten daha önce hazırlanmış bir deste varsa soruları oradan
 * kopyalar — tek bir Claude çağrısı bile yapılmaz.
 *
 * Not: iki kullanıcı aynı dosyayı neredeyse aynı anda yüklerse ikisi de
 * üretim yapabilir (henüz "hazır" bir kardeş deste yoktur). V1 için kabul
 * edilebilir; kalıcı çözüm üretimi deste değil kaynak doküman bazında
 * kilitlemek olurdu.
 */
export async function cacheDenKopyala(
  admin: SupabaseClient<Database>,
  deck: { id: string; source_document_id: string },
): Promise<boolean> {
  const { data: kaynak } = await admin
    .from("decks")
    .select("id")
    .eq("source_document_id", deck.source_document_id)
    .eq("status", "ready")
    .neq("id", deck.id)
    .limit(1)
    .maybeSingle();

  if (!kaynak) return false;

  const [{ data: sorular }, { data: kartlar }] = await Promise.all([
    admin
      .from("questions")
      .select("position, stem, options, correct_index, explanation")
      .eq("deck_id", kaynak.id)
      .order("position"),
    admin
      .from("flashcards")
      .select("position, front, back")
      .eq("deck_id", kaynak.id)
      .order("position"),
  ]);

  if (!sorular || sorular.length === 0) return false;

  const { error: soruHatasi } = await admin
    .from("questions")
    .insert(sorular.map((s) => ({ ...s, deck_id: deck.id })));
  if (soruHatasi) throw soruHatasi;

  if (kartlar && kartlar.length > 0) {
    const { error: kartHatasi } = await admin
      .from("flashcards")
      .insert(kartlar.map((k) => ({ ...k, deck_id: deck.id })));
    if (kartHatasi) throw kartHatasi;
  }

  return true;
}
