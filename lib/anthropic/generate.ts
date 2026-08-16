import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { anthropicClient, anthropicModel } from "@/lib/anthropic/client";
import {
  KART_SISTEM_PROMPTU,
  SORU_SISTEM_PROMPTU,
  dersMetniBlogu,
  kartIstegi,
  soruIstegi,
} from "@/lib/anthropic/prompts";
import {
  KART_TOOL,
  SORU_TOOL,
  kartlarSemasi,
  siklarBenzersizMi,
  sorularSemasi,
  type UretilenKart,
  type UretilenSoru,
} from "@/lib/anthropic/schemas";
import { kullanimiLogla } from "@/lib/usage";
import type { Database } from "@/types/database";

export class UretimHatasi extends Error {
  // Not: TS'in "parameter property" kısayolu (constructor(readonly x))
  // bilerek kullanılmadı — düz tip sıyırma ile çalışan araçlar (Node'un
  // kendi TS desteği dahil) onu derleyemiyor.
  readonly kullaniciMesaji: string;

  constructor(message: string, kullaniciMesaji: string) {
    super(message);
    this.name = "UretimHatasi";
    this.kullaniciMesaji = kullaniciMesaji;
  }
}

/** Testte sahte client verilebilsin diye sadece kullandığımız kısmı tipliyoruz. */
export type MesajClient = Pick<Anthropic["messages"], "create">;

type CagriArgs<T> = {
  admin: SupabaseClient<Database>;
  userId: string;
  deckId: string;
  step: string;
  systemPrompt: string;
  dersMetni: string;
  istek: string;
  tool: typeof SORU_TOOL | typeof KART_TOOL;
  maxTokens: number;
  sema: z.ZodType<T>;
  client?: MesajClient;
};

/**
 * Tek bir Claude çağrısı: tool-use ile JSON al, doğrula, kullanımı logla.
 *
 * Şema tutmazsa BİR kez daha dener. İkisi de tutmazsa hata fırlatır —
 * sonsuz döngüye girip token yakmanın anlamı yok.
 */
async function cagir<T>({
  admin,
  userId,
  deckId,
  step,
  systemPrompt,
  dersMetni,
  istek,
  tool,
  maxTokens,
  sema,
  client: verilenClient,
}: CagriArgs<T>): Promise<T> {
  const client = verilenClient ?? anthropicClient().messages;
  const model = anthropicModel();

  let sonHata = "";

  for (let deneme = 1; deneme <= 2; deneme++) {
    const basla = Date.now();

    const cevap = await client.create({
      model,
      max_tokens: maxTokens,
      // Hız için düşünme kapalı: 60 sn'lik fonksiyon limitine sığmamız
      // gerekiyor. Soru kalitesi yetersiz gelirse ilk denenecek ayar
      // effort'u "high" yapmak, sonra thinking'i "adaptive"a çevirmek.
      thinking: { type: "disabled" },
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: systemPrompt },
        {
          type: "text",
          text: dersMetniBlogu(dersMetni),
          // Ders metni bütün partilerde aynı → ilk çağrıda cache'e yazılır,
          // sonrakilerde ~1/10 fiyatına okunur.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content:
            deneme === 1
              ? istek
              : `${istek}\n\nÖNEMLİ: Önceki denemende cevap beklenen biçimde değildi (${sonHata}). Aracın şemasına birebir uy.`,
        },
      ],
      tools: [tool],
      // Modeli düz metin yerine tool çağrısı üretmeye zorlar.
      tool_choice: { type: "tool", name: tool.name },
    });

    await kullanimiLogla(admin, {
      userId,
      deckId,
      step: deneme === 1 ? step : `${step}_tekrar`,
      model,
      usage: cevap.usage,
      latencyMs: Date.now() - basla,
    });

    const toolBlogu = cevap.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolBlogu) {
      sonHata = "araç çağrısı gelmedi";
      continue;
    }

    const dogrulama = sema.safeParse(toolBlogu.input);
    if (dogrulama.success) return dogrulama.data;

    sonHata = dogrulama.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
  }

  throw new UretimHatasi(
    `${step} için geçerli çıktı alınamadı: ${sonHata}`,
    "Sorular üretilirken beklenmeyen bir cevap alındı. Tekrar dene.",
  );
}

/** Bir parti çoktan seçmeli soru üretir. */
export async function sorulariUret(args: {
  admin: SupabaseClient<Database>;
  userId: string;
  deckId: string;
  partiNo: number;
  adet: number;
  dersMetni: string;
  oncekiSorular: string[];
  client?: MesajClient;
}): Promise<UretilenSoru[]> {
  const sonuc = await cagir({
    admin: args.admin,
    userId: args.userId,
    deckId: args.deckId,
    step: `questions_batch_${args.partiNo}`,
    systemPrompt: SORU_SISTEM_PROMPTU,
    dersMetni: args.dersMetni,
    istek: soruIstegi(args.adet, args.oncekiSorular),
    tool: SORU_TOOL,
    // Türkçe 5 soru + açıklama ~1.500 token; 4.000 rahat yeter.
    maxTokens: 4000,
    sema: sorularSemasi,
    client: args.client,
  });

  // Model bazen aynı şıkkı iki kez yazabiliyor; böyle soruları eliyoruz.
  // Az soruyla dönmek, bozuk soru göstermekten iyidir.
  return sonuc.sorular
    .filter((s) => siklarBenzersizMi(s.siklar))
    .slice(0, args.adet);
}

/** Flashcard üretir. */
export async function kartlariUret(args: {
  admin: SupabaseClient<Database>;
  userId: string;
  deckId: string;
  adet: number;
  dersMetni: string;
  client?: MesajClient;
}): Promise<UretilenKart[]> {
  const sonuc = await cagir({
    admin: args.admin,
    userId: args.userId,
    deckId: args.deckId,
    step: "flashcards",
    systemPrompt: KART_SISTEM_PROMPTU,
    dersMetni: args.dersMetni,
    istek: kartIstegi(args.adet),
    tool: KART_TOOL,
    maxTokens: 3000,
    sema: kartlarSemasi,
    client: args.client,
  });

  return sonuc.kartlar.slice(0, args.adet);
}
