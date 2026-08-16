/**
 * Aralıklı tekrar mantığı — saf fonksiyonlar, yan etkisi yok.
 *
 * Kurallar (V1):
 *   stage 0 → yanlış yapıldı, 1 gün sonra sorulur
 *   stage 1 → doğru cevaplandı, 3 gün sonra sorulur
 *   stage 2 → doğru cevaplandı, 7 gün sonra sorulur
 *   stage 3 → tamamlandı, bir daha çıkmaz
 *
 * Tekrarda YANLIŞ yapılırsa stage 0'a döner (1 gün sonra tekrar).
 */

/** Her aşamadan sonra kaç gün beklenecek. İndeks = yeni stage. */
const ARALIK_GUN = [1, 3, 7] as const;

export const TAMAMLANDI_STAGE = 3;

const GUN_MS = 24 * 60 * 60 * 1000;

export type TekrarDurumu = {
  stage: number;
  dueAt: Date;
};

/**
 * Bir soru quizde İLK KEZ yanlış yapıldığında kuyruğa nasıl girer.
 */
export function ilkYanlis(simdi: Date = new Date()): TekrarDurumu {
  return { stage: 0, dueAt: new Date(simdi.getTime() + ARALIK_GUN[0] * GUN_MS) };
}

/**
 * Kuyruktaki bir soru cevaplandığında sıradaki durum.
 *
 * @param mevcutStage 0-3 arası
 * @param dogruMu     kullanıcı doğru cevapladı mı
 */
export function sonrakiTekrar(
  mevcutStage: number,
  dogruMu: boolean,
  simdi: Date = new Date(),
): TekrarDurumu {
  if (!dogruMu) {
    // Yanlışta en başa dönüyoruz: bilinmeyen bir şeyi 7 gün sonraya
    // ertelemek öğrenmeye yaramaz.
    return ilkYanlis(simdi);
  }

  const yeniStage = Math.min(mevcutStage + 1, TAMAMLANDI_STAGE);

  if (yeniStage >= TAMAMLANDI_STAGE) {
    // Artık kuyrukta değil. due_at NOT NULL olduğu için bir değer
    // koymak zorundayız; sorgular zaten stage < 3 filtreliyor.
    return { stage: TAMAMLANDI_STAGE, dueAt: new Date(simdi.getTime()) };
  }

  return {
    stage: yeniStage,
    dueAt: new Date(simdi.getTime() + ARALIK_GUN[yeniStage] * GUN_MS),
  };
}

/** Kuyruktan çıkmış mı? */
export function tamamlandiMi(stage: number): boolean {
  return stage >= TAMAMLANDI_STAGE;
}

/** "3 gün sonra", "yarın" gibi kullanıcıya dönük metin. */
export function tekrarZamaniMetni(
  stage: number,
  simdi: Date = new Date(),
  dueAt?: Date,
): string {
  if (tamamlandiMi(stage)) return "Bu soruyu öğrendin";

  if (!dueAt) {
    const gun = ARALIK_GUN[Math.min(stage, ARALIK_GUN.length - 1)];
    return gun === 1 ? "Yarın tekrar çıkacak" : `${gun} gün sonra tekrar çıkacak`;
  }

  const farkGun = Math.ceil((dueAt.getTime() - simdi.getTime()) / GUN_MS);
  if (farkGun <= 0) return "Şimdi tekrar edilebilir";
  if (farkGun === 1) return "Yarın tekrar çıkacak";
  return `${farkGun} gün sonra tekrar çıkacak`;
}
