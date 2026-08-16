# Slayttan Quiz

Öğrenci ders slaytını (PDF) yükler; içerikten 20 çoktan seçmeli soru ve
flashcard üretilir. Quiz çözülür, yanlışlar 1/3/7 gün aralıklarla tekrar
karşıya çıkar, deste link ile paylaşılabilir.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind v4 · Supabase
(Postgres + Auth + Storage) · Anthropic API (`claude-sonnet-4-6`) · Vercel

---

## Kurulum

### 1. Bağımlılıklar

```bash
npm install
```

### 2. Supabase projesi

1. [supabase.com](https://supabase.com) üzerinde yeni proje aç.
2. **SQL Editor**'de `supabase/migrations/` altındaki dosyaları **sırayla**
   çalıştır:
   - `0001_init.sql` — tablolar, indeksler, trigger'lar
   - `0002_rls.sql` — Row Level Security politikaları
   - `0003_storage.sql` — `pdfs` bucket'ı ve erişim politikaları

> Supabase CLI kullanıyorsan `supabase db push` de aynı işi yapar.

### 3. Google ile giriş

1. Google Cloud Console → **APIs & Services → Credentials** → OAuth client ID
   (Web application).
2. **Authorized redirect URI** olarak şunu ekle:
   `https://<proje-ref>.supabase.co/auth/v1/callback`
3. Client ID ve Secret'ı Supabase Dashboard → **Authentication → Providers →
   Google** altına gir. (Bu değerler uygulama koduna girmez.)
4. Supabase → **Authentication → URL Configuration** → Site URL ve Redirect
   URLs'e uygulamanın adresini ekle (`http://localhost:3000` ve üretim adresi).

### 4. Ortam değişkenleri

```bash
cp .env.example .env.local
```

Sonra `.env.local` içindeki değerleri doldur. Hangi değerin nereden alındığı
`.env.example` içinde yazıyor.

> `SUPABASE_SERVICE_ROLE_KEY` RLS'i tamamen bypass eder. Asla `NEXT_PUBLIC_`
> yapma, asla tarayıcıya giden bir dosyadan import etme.

### 5. Çalıştır

```bash
npm run dev
```

---

## Testler

```bash
npm test        # birim testler (46 test): SRS aralıkları, üretim akışı,
                # maliyet hesabı, şema doğrulama, adım seçimi
npm run test:rls  # RLS politikalarını yerel Postgres'te doğrular
                  # (postgresql-16 gerekir; Supabase'e bağlanmaz)
```

`npm run test:rls` Supabase'e özgü parçaları taklit edip 15 senaryo
çalıştırır: kullanıcı izolasyonu, paylaşılan deste erişimi, storage klasör
sınırı, veritabanı kısıtları.

Elle test için örnek PDF üretmek istersen:

```bash
node scripts/test-pdf-uret.mjs /tmp/pdfler
```

30 sayfa sınırı, taranmış belge ve bozuk dosya senaryolarını denemek için
beş farklı PDF üretir.

---

## Vercel'e deploy

1. Repoyu Vercel'e bağla (Framework: Next.js, Root Directory: `./`).
2. `.env.local`'daki tüm değişkenleri **Settings → Environment Variables**'a
   gir. `NEXT_PUBLIC_SITE_URL` üretim adresi olmalı.
3. Deploy sonrası Supabase'in Redirect URL listesine üretim adresini eklemeyi
   unutma, yoksa Google girişi localhost'a döner.

---

## Mimari notlar

**Neden üretim parça parça?** Vercel Hobby planında bir istek 60 saniyede
kesiliyor. 20 soruyu tek Claude çağrısında üretmek ~2 dakika sürer ve
timeout'a düşer — token yanar, karşılığı alınmaz. Bu yüzden üretim 5'erli 4
soru partisi + 1 flashcard çağrısına bölündü ve tarayıcı adımları sırayla
tetikliyor. Pro plana geçersen `QUESTION_BATCH_SIZE=20` yapıp tek çağrıya
indirebilirsin.

**Neden PDF doğrudan Storage'a yükleniyor?** Vercel'in istek gövdesi limiti
~4.5 MB; 10 MB'lık PDF API route'undan geçemez. Tarayıcı dosyayı Supabase
Storage'a yükler, sunucuya sadece dosya yolu gider. Sunucu dosyayı indirip
hash'i **yeniden** hesaplar — istemciden gelen hash'e güvenilmez.

**Maliyet kontrolleri**
- Dosya hash'i (SHA-256) `source_documents.file_hash` üzerinde unique. Aynı
  PDF ikinci kez yüklenirse ne parse edilir ne de Claude'a gider; sorular
  mevcut desteden kopyalanır.
- Ders metni Claude'a `cache_control` ile gönderilir: 5 çağrıda bir kez tam
  fiyattan ödenir, kalanı ~1/10 fiyata okunur.
- Kullanıcı başına günde 3 yükleme (Türkiye saatiyle gün başına göre).
- Her çağrının token kullanımı ve tahmini maliyeti `llm_usage_logs`'a yazılır:
  ```sql
  select step, sum(estimated_cost_usd), sum(cache_read_input_tokens)
  from llm_usage_logs group by step;
  ```

**Neden `claude-sonnet-4-6` ile tool-use?** Bu model `output_config.format`
JSON modunu desteklemiyor. `tool_choice` ile bir araç zorunlu tutulduğunda
model şemaya uymak zorunda kalıyor; gelen veri ayrıca Zod ile doğrulanıyor.
Şema tutmazsa modele neyin bozuk olduğu söylenip bir kez daha deneniyor.

**Bilinçli ödünler**
- `correct_index` istemciye gidiyor; kararlı bir kullanıcı devtools'tan
  cevabı görebilir. Bu bir sınav sistemi değil, çalışma aracı.
- Aynı PDF'i yükleyen iki kişi aynı soruları görür (cache'in doğal sonucu).
  PDF'in kendisi paylaşılmaz.
- Taranmış/görüntü PDF'ler desteklenmiyor (OCR yok), net hata mesajıyla
  reddediliyor.
- Cache'ten gelen yükleme de günlük limitten düşer.

---

## Klasör yapısı

```
app/
  (panel)/          giriş zorunlu sayfalar (panel, deste, quiz, kartlar, tekrar)
  p/[slug]/         paylaşılan deste — giriş gerekmez
  api/              route handler'lar
components/         arayüz bileşenleri
lib/
  anthropic/        Claude çağrıları, promptlar, şemalar
  supabase/         tarayıcı / sunucu / service-role client'ları
  pdf/              metin çıkarma
  srs.ts            aralıklı tekrar mantığı (saf fonksiyonlar)
supabase/
  migrations/       şema ve RLS
  tests/            RLS doğrulama koşumu
tests/              birim testler
proxy.ts            oturum tazeleme + korumalı yollar (Next 16'da middleware)
```
