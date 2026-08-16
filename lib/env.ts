/**
 * Ortam değişkenleri tek yerden okunur.
 *
 * İki incelik var:
 *
 * 1. NEXT_PUBLIC_* değişkenleri build sırasında paketin içine gömülebilmesi
 *    için `process.env.X` şeklinde birebir yazılmak zorunda — dinamik
 *    anahtarla (process.env[ad]) okunursa tarayıcıda undefined gelir.
 *
 * 2. Doğrulama modül yüklenirken değil, değere ERİŞİLDİĞİNDE yapılıyor
 *    (getter). Aksi halde `next build` sırasında sayfa modülleri import
 *    edilirken hata fırlar ve build kırılır.
 */

function zorunlu(deger: string | undefined, ad: string): string {
  if (!deger) {
    throw new Error(
      `Ortam değişkeni eksik: ${ad}. .env.local dosyanı kontrol et (örnek için .env.example).`,
    );
  }
  return deger;
}

/** Tarayıcıda da sunucuda da kullanılabilir. */
export const publicEnv = {
  get supabaseUrl() {
    return zorunlu(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL",
    );
  },
  get supabaseAnonKey() {
    return zorunlu(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  },
  get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
};

/**
 * SADECE sunucuda çağır. Service role anahtarı asla tarayıcıya gitmemeli.
 */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() tarayıcıda çağrılamaz.");
  }
  return {
    get supabaseServiceRoleKey() {
      return zorunlu(
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        "SUPABASE_SERVICE_ROLE_KEY",
      );
    },
    get anthropicApiKey() {
      return zorunlu(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY");
    },
    anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    dailyUploadLimit: Number(process.env.DAILY_UPLOAD_LIMIT ?? "3"),
    questionBatchSize: Number(process.env.QUESTION_BATCH_SIZE ?? "5"),
  };
}

/** Uygulama genelinde sabitler. */
export const LIMITS = {
  maxFileBytes: 10 * 1024 * 1024, // 10 MB
  maxPageCount: 30,
  totalQuestions: 20,
  totalFlashcards: 15,
  /** Bu karakterin altında metin çıkarsa PDF taranmış görüntüdür. */
  minExtractedChars: 500,
} as const;
