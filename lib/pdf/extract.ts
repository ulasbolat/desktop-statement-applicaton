import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

import { LIMITS } from "@/lib/env";

export type CikarmaSonucu =
  | { ok: true; text: string; pageCount: number; charCount: number }
  | { ok: false; kod: CikarmaHataKodu; mesaj: string };

export type CikarmaHataKodu =
  | "okunamadi"
  | "cok_uzun"
  | "metin_yok";

/**
 * PDF'ten metin çıkarır ve V1 kurallarını uygular.
 *
 * Dönen `mesaj` doğrudan kullanıcıya gösterilir, o yüzden Türkçe ve
 * ne yapması gerektiğini söyleyen bir cümle.
 */
export async function pdfMetniCikar(
  bytes: Uint8Array,
): Promise<CikarmaSonucu> {
  let pdf;
  try {
    // DİKKAT: pdf.js kendisine verilen typed array'in buffer'ını DETACH eder
    // (byteLength 0'a düşer). Çağıranın elindeki veriyi bozmamak için kopya
    // veriyoruz — aksi halde bu fonksiyondan sonra aynı bytes'tan hesaplanan
    // hash, boş girdinin hash'i çıkar ve bütün dosyalar aynı cache anahtarına
    // düşer.
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch {
    return {
      ok: false,
      kod: "okunamadi",
      mesaj:
        "PDF açılamadı. Dosya bozuk ya da parola korumalı olabilir; başka bir kopyasını dene.",
    };
  }

  const pageCount = pdf.numPages;

  if (pageCount > LIMITS.maxPageCount) {
    return {
      ok: false,
      kod: "cok_uzun",
      mesaj: `PDF ${pageCount} sayfa. Şimdilik en fazla ${LIMITS.maxPageCount} sayfa işleyebiliyoruz — dosyayı bölüp tekrar dene.`,
    };
  }

  let text: string;
  try {
    const sonuc = await extractText(pdf, { mergePages: true });
    text = normalizeMetin(
      Array.isArray(sonuc.text) ? sonuc.text.join("\n") : sonuc.text,
    );
  } catch {
    return {
      ok: false,
      kod: "okunamadi",
      mesaj:
        "PDF'in içeriği okunamadı. Dosya bozuk olabilir; başka bir kopyasını dene.",
    };
  }

  if (text.length < LIMITS.minExtractedChars) {
    return {
      ok: false,
      kod: "metin_yok",
      mesaj:
        "Bu PDF'te okunabilir metin bulunamadı. Taranmış (fotoğraf) bir belge olabilir — şimdilik sadece metin içeren PDF'ler destekleniyor.",
    };
  }

  return { ok: true, text, pageCount, charCount: text.length };
}

/**
 * Slaytlardan gelen metin bol boşluklu oluyor. Bunları temizlemek hem
 * Claude'a giden token sayısını hem de maliyeti düşürüyor.
 */
function normalizeMetin(ham: string): string {
  return ham
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
