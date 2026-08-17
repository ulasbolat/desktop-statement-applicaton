/**
 * Supabase Auth hatalarını Türkçe, kullanıcıya gösterilebilir cümlelere
 * çevirir.
 *
 * Öncelik `code` alanında: mesaj metni sürümden sürüme değişebiliyor ama
 * kod sabit. Kod gelmezse (eski sunucular) mesaj metnine, o da tutmazsa
 * HTTP durumuna bakıyoruz.
 */

export type AuthHatasi = {
  code?: string;
  message?: string;
  status?: number;
};

const KODA_GORE: Record<string, string> = {
  invalid_credentials: "E-posta veya şifre hatalı.",
  email_not_confirmed:
    "E-posta adresini henüz doğrulamamışsın. Gelen kutuna gönderdiğimiz linke tıkla.",
  user_already_exists: "Bu e-posta zaten kayıtlı. Giriş yapmayı dene.",
  email_exists: "Bu e-posta zaten kayıtlı. Giriş yapmayı dene.",
  weak_password: "Şifre çok zayıf. En az 6 karakter olmalı.",
  same_password: "Yeni şifre eskisiyle aynı olamaz.",
  over_request_rate_limit:
    "Çok fazla deneme yaptın. Birkaç dakika bekleyip tekrar dene.",
  over_email_send_rate_limit:
    "Çok fazla e-posta gönderildi. Birkaç dakika bekleyip tekrar dene.",
  validation_failed: "Girdiğin bilgiler geçersiz. E-posta ve şifreyi kontrol et.",
  signup_disabled: "Yeni kayıtlar şu an kapalı.",
  email_provider_disabled:
    "E-posta ile giriş bu projede kapalı. Google ile devam edebilirsin.",
  user_banned: "Bu hesap askıya alınmış.",
  otp_expired:
    "Bağlantının süresi dolmuş. Yeniden kayıt olup yeni link isteyebilirsin.",
  user_not_found: "Böyle bir hesap bulunamadı.",
};

/** Kod gelmediğinde mesaj metninden yakalamaya çalışıyoruz. */
const METNE_GORE: [RegExp, string][] = [
  [/invalid login credentials/i, "E-posta veya şifre hatalı."],
  [
    /email not confirmed/i,
    "E-posta adresini henüz doğrulamamışsın. Gelen kutuna gönderdiğimiz linke tıkla.",
  ],
  [/user already registered/i, "Bu e-posta zaten kayıtlı. Giriş yapmayı dene."],
  [/password should be at least/i, "Şifre en az 6 karakter olmalı."],
  [/unable to validate email address/i, "Geçerli bir e-posta adresi gir."],
  [
    /for security purposes|rate limit/i,
    "Çok fazla deneme yaptın. Birkaç dakika bekleyip tekrar dene.",
  ],
];

export function authHataMesaji(hata: AuthHatasi | null | undefined): string {
  if (!hata) return "Beklenmeyen bir hata oldu. Tekrar dene.";

  if (hata.code && KODA_GORE[hata.code]) return KODA_GORE[hata.code];

  if (hata.message) {
    for (const [kalip, mesaj] of METNE_GORE) {
      if (kalip.test(hata.message)) return mesaj;
    }
  }

  if (hata.status === 429) {
    return "Çok fazla deneme yaptın. Birkaç dakika bekleyip tekrar dene.";
  }

  if (hata.status && hata.status >= 500) {
    return "Sunucuya ulaşılamadı. Birazdan tekrar dene.";
  }

  return "Beklenmeyen bir hata oldu. Tekrar dene.";
}

/** Formu göndermeden önceki basit kontroller. */
export function formHatasi(eposta: string, sifre: string): string | null {
  if (!eposta.trim()) return "E-posta adresini gir.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta.trim())) {
    return "Geçerli bir e-posta adresi gir.";
  }
  if (sifre.length < 6) return "Şifre en az 6 karakter olmalı.";
  return null;
}
