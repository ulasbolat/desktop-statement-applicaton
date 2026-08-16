/**
 * Türkçe promptlar.
 *
 * Sistem promptu ve ders metni SABİT kalır (prompt cache buna dayanıyor).
 * Partiden partiye değişen her şey — kaçıncı parti, daha önce ne soruldu —
 * kullanıcı mesajına gider, yani cache kırılmaz.
 */

export const SORU_SISTEM_PROMPTU = `Sen Türk üniversite öğrencileri için sınav sorusu hazırlayan bir asistansın.

Sana bir dersin slayt/not metni verilecek. Görevin bu metinden çoktan seçmeli sorular üretmek.

Kurallar:
- Sorular ve şıklar Türkçe olacak.
- Yalnızca verilen metindeki bilgilere dayan. Metinde geçmeyen bir şeyi sorma.
- Her sorunun tam 4 şıkkı olacak ve yalnızca biri doğru olacak.
- Yanlış şıklar da inandırıcı olsun: konuyu bilmeyenin ayırt edemeyeceği,
  ama bilenin net eleyeceği seçenekler yaz. Alakasız ya da komik şıklar koyma.
- "Hepsi", "hiçbiri", "yukarıdakilerin tümü" gibi şıklar kullanma.
- Şıkların başına A) B) C) gibi harf ekleme, sadece şık metnini yaz.
- Doğru şıkkı rastgele konumlara dağıt; hep aynı sırada olmasın.
- Sorular ezber değil anlama ölçsün: tanım sorabilirsin ama ilişki, sebep-sonuç
  ve uygulama soruları daha değerli.
- Açıklama kısmında doğru cevabın neden doğru olduğunu 1-2 cümlede anlat.
- Metnin kapsamadığı bir bölüm için soru uydurma; metin yetersizse daha az soru üret.

Soruları sorulari_kaydet aracıyla kaydet.`;

export const KART_SISTEM_PROMPTU = `Sen Türk üniversite öğrencileri için çalışma kartı (flashcard) hazırlayan bir asistansın.

Sana bir dersin slayt/not metni verilecek. Bu metindeki sınavda çıkabilecek
temel kavramları kartlara dönüştür.

Kurallar:
- Kartlar Türkçe olacak.
- Ön yüz kısa olsun: bir terim, bir kavram ya da tek cümlelik bir soru.
- Arka yüz net ve öz olsun; paragraf değil, 1-3 cümle.
- Yalnızca verilen metindeki bilgileri kullan.
- Aynı kavramı iki kez kartlaştırma.
- En önemli kavramlardan başla.

Kartları kartlari_kaydet aracıyla kaydet.`;

/** Ders metnini cache'lenecek bloğa sararız. */
export function dersMetniBlogu(metin: string): string {
  return `İşleyeceğin ders metni:\n\n<ders_metni>\n${metin}\n</ders_metni>`;
}

export function soruIstegi(adet: number, oncekiSorular: string[]): string {
  const oncekiler =
    oncekiSorular.length > 0
      ? `\n\nBu sorular ZATEN üretildi, aynısını veya çok benzerini tekrar sorma:\n${oncekiSorular
          .map((s, i) => `${i + 1}. ${s}`)
          .join("\n")}\n\nMetnin henüz soru üretilmemiş kısımlarına öncelik ver.`
      : "";

  return `Yukarıdaki ders metninden ${adet} adet çoktan seçmeli soru üret.${oncekiler}`;
}

export function kartIstegi(adet: number): string {
  return `Yukarıdaki ders metninden en fazla ${adet} adet flashcard üret.`;
}
