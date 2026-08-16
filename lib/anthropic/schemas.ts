import { z } from "zod";

/**
 * Claude'dan JSON almanın iki katmanı var:
 *
 * 1. Tool'un `input_schema`'sı — modele "cevabın şekli bu" der.
 *    (claude-sonnet-4-6 `output_config.format` JSON modunu desteklemiyor,
 *     o yüzden tool-use ile alıyoruz: tool_choice zorunlu tutulunca model
 *     düz metin yerine bu şemaya uygun bir tool çağrısı üretmek zorunda.)
 *
 * 2. Zod şeması — gelen veriyi biz de doğruluyoruz. Şema uyumu API
 *    tarafından garanti edilmiyor, veritabanına yazmadan önce kontrol şart.
 */

export const soruSemasi = z.object({
  soru: z.string().trim().min(10).max(500),
  siklar: z.array(z.string().trim().min(1).max(300)).length(4),
  dogru_sik: z.number().int().min(0).max(3),
  aciklama: z.string().trim().min(5).max(600),
});

export const sorularSemasi = z.object({
  sorular: z.array(soruSemasi).min(1),
});

export const kartSemasi = z.object({
  on: z.string().trim().min(3).max(200),
  arka: z.string().trim().min(3).max(500),
});

export const kartlarSemasi = z.object({
  kartlar: z.array(kartSemasi).min(1),
});

export type UretilenSoru = z.infer<typeof soruSemasi>;
export type UretilenKart = z.infer<typeof kartSemasi>;

/** Şıkların birbirinin aynısı olmadığını kontrol eder. */
export function siklarBenzersizMi(siklar: string[]): boolean {
  const normal = siklar.map((s) => s.trim().toLocaleLowerCase("tr"));
  return new Set(normal).size === normal.length;
}

export const SORU_TOOL = {
  name: "sorulari_kaydet",
  description:
    "Üretilen çoktan seçmeli soruları kaydeder. Her soru tam 4 şık içerir ve yalnızca biri doğrudur.",
  input_schema: {
    type: "object" as const,
    properties: {
      sorular: {
        type: "array",
        description: "Üretilen sorular",
        items: {
          type: "object",
          properties: {
            soru: {
              type: "string",
              description: "Soru kökü. Tek bir şeyi sorar, net ve nettir.",
            },
            siklar: {
              type: "array",
              description:
                "Tam 4 şık. Sadece şık metni — başına A) B) gibi harf ekleme.",
              items: { type: "string" },
              minItems: 4,
              maxItems: 4,
            },
            dogru_sik: {
              type: "integer",
              description: "Doğru şıkkın sıra numarası (0-3).",
              minimum: 0,
              maximum: 3,
            },
            aciklama: {
              type: "string",
              description:
                "Doğru cevabın neden doğru olduğunu anlatan 1-2 cümle.",
            },
          },
          required: ["soru", "siklar", "dogru_sik", "aciklama"],
        },
      },
    },
    required: ["sorular"],
  },
};

export const KART_TOOL = {
  name: "kartlari_kaydet",
  description: "Üretilen flashcard'ları kaydeder.",
  input_schema: {
    type: "object" as const,
    properties: {
      kartlar: {
        type: "array",
        description: "Üretilen flashcard'lar",
        items: {
          type: "object",
          properties: {
            on: {
              type: "string",
              description: "Kartın ön yüzü: terim, kavram ya da kısa soru.",
            },
            arka: {
              type: "string",
              description: "Kartın arka yüzü: kısa ve net karşılık.",
            },
          },
          required: ["on", "arka"],
        },
      },
    },
    required: ["kartlar"],
  },
};
