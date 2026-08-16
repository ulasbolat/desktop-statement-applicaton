/**
 * Dosya hash'i — cache anahtarımız.
 *
 * Web Crypto hem tarayıcıda hem Node 22'de var, yani aynı fonksiyon
 * iki tarafta da çalışıyor. Tarayıcı hash'i hesaplayıp gönderiyor,
 * sunucu dosyayı indirip TEKRAR hesaplıyor ve karşılaştırıyor —
 * istemciden gelen hash'e güvenmiyoruz, yoksa biri başkasının
 * hash'ini gönderip onun sorularına erişebilirdi.
 */
export async function sha256Hex(data: ArrayBuffer | Uint8Array<ArrayBuffer>) {
  const buffer = data instanceof Uint8Array ? data.buffer : data;

  // Boş girdi = ya gerçekten boş dosya ya da detach edilmiş bir buffer
  // (pdf.js buffer'ı sahiplenir). İkisi de sessizce "e3b0c442..." üretip
  // bütün dosyaları aynı cache anahtarına düşürür — yüksek sesle patlasın.
  if (buffer.byteLength === 0) {
    throw new Error(
      "sha256Hex: girdi boş. Buffer başka bir yerde tüketilmiş (detached) olabilir.",
    );
  }

  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash 64 karakterlik hex mi? (Storage yolu bundan üretildiği için önemli.) */
export function gecerliHashMi(deger: unknown): deger is string {
  return typeof deger === "string" && /^[0-9a-f]{64}$/.test(deger);
}
