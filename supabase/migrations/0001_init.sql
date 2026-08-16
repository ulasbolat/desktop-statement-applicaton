-- ============================================================================
-- 0001_init.sql — Tablolar, enum'lar, indeksler, trigger'lar
-- RLS politikaları ayrı dosyada (0002_rls.sql).
-- ============================================================================

-- ─── profiles ───────────────────────────────────────────────────────────────
-- auth.users'ın aynası. auth şemasına doğrudan RLS/join yazmak yerine
-- Supabase'in standart pratiği olan ayna tabloyu kullanıyoruz.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'auth.users aynası. Google''dan gelen ad/avatar burada tutulur.';

-- Yeni kullanıcı kaydolduğunda profil satırı otomatik açılsın.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── source_documents ───────────────────────────────────────────────────────
-- Cache'in kalbi: bir fiziksel dosya = bir satır.
-- Aynı PDF ikinci kez yüklenirse ne parse edilir ne de Claude çağrılır.

create table public.source_documents (
  id             uuid primary key default gen_random_uuid(),
  file_hash      text not null unique,
  storage_path   text not null,
  page_count     int  not null check (page_count > 0),
  char_count     int  not null check (char_count >= 0),
  extracted_text text not null,
  created_at     timestamptz not null default now()
);

comment on column public.source_documents.file_hash is
  'Dosya baytlarının SHA-256''sı (hex). Cache anahtarı.';


-- ─── decks ──────────────────────────────────────────────────────────────────

create type public.deck_status as enum (
  'pending',     -- oluşturuldu, henüz işlenmedi
  'extracting',  -- PDF'ten metin çıkarılıyor
  'generating',  -- Claude soru üretiyor
  'ready',       -- hazır
  'failed'       -- hata (error_message dolu)
);

create table public.decks (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles (id) on delete cascade,
  source_document_id uuid not null references public.source_documents (id) on delete restrict,
  title              text not null check (length(trim(title)) between 1 and 200),
  status             public.deck_status not null default 'pending',
  progress           int  not null default 0 check (progress between 0 and 100),
  error_message      text,
  is_public          boolean not null default false,
  share_slug         text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Paylaşıma açık bir destenin mutlaka linki olmalı.
  constraint public_deck_has_slug check (not is_public or share_slug is not null)
);

create index decks_owner_created_idx
  on public.decks (owner_id, created_at desc);

-- Günlük yükleme limiti sorgusu bu indeksi kullanır.
create index decks_owner_daily_idx
  on public.decks (owner_id, created_at);

-- Cache kontrolü: "bu kaynaktan hazır bir deste var mı?"
create index decks_source_ready_idx
  on public.decks (source_document_id)
  where status = 'ready';

create index decks_share_slug_idx
  on public.decks (share_slug)
  where share_slug is not null;

-- updated_at'i elle güncellemeyi unutmayalım diye trigger.
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger decks_touch_updated_at
  before update on public.decks
  for each row execute function public.touch_updated_at();


-- ─── questions ──────────────────────────────────────────────────────────────

-- CHECK kısıtı içinde subquery kullanılamıyor, o yüzden kontrolü immutable
-- bir fonksiyona alıyoruz.
create function public.gecerli_siklar(options jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(options) = 'array'
     and jsonb_array_length(options) = 4
     and not exists (
       select 1
       from jsonb_array_elements(options) as o
       where jsonb_typeof(o.value) <> 'string'
          or length(trim(o.value #>> '{}')) = 0
     );
$$;

comment on function public.gecerli_siklar(jsonb) is
  'Şık dizisi tam 4 elemanlı ve hepsi boş olmayan string mi?';

create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  deck_id       uuid not null references public.decks (id) on delete cascade,
  position      int  not null check (position > 0),
  stem          text not null check (length(trim(stem)) > 0),
  options       jsonb not null,
  correct_index int  not null check (correct_index between 0 and 3),
  explanation   text not null,
  created_at    timestamptz not null default now(),

  unique (deck_id, position),
  constraint options_dort_dolu_sik check (public.gecerli_siklar(options))
);

create index questions_deck_position_idx
  on public.questions (deck_id, position);


-- ─── flashcards ─────────────────────────────────────────────────────────────

create table public.flashcards (
  id         uuid primary key default gen_random_uuid(),
  deck_id    uuid not null references public.decks (id) on delete cascade,
  position   int  not null check (position > 0),
  front      text not null check (length(trim(front)) > 0),
  back       text not null check (length(trim(back)) > 0),
  created_at timestamptz not null default now(),

  unique (deck_id, position)
);

create index flashcards_deck_position_idx
  on public.flashcards (deck_id, position);


-- ─── reviews ────────────────────────────────────────────────────────────────
-- Aralıklı tekrar kuyruğu. Bir kullanıcı + bir soru = bir satır.
-- stage: 0 = yeni yanlış (+1 gün), 1 = +3 gün, 2 = +7 gün, 3 = tamamlandı

create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  question_id   uuid not null references public.questions (id) on delete cascade,
  deck_id       uuid not null references public.decks (id) on delete cascade,
  stage         int  not null default 0 check (stage between 0 and 3),
  due_at        timestamptz not null,
  wrong_count   int  not null default 1 check (wrong_count > 0),
  last_answered timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (user_id, question_id)
);

-- "Bugün tekrar edilecekler" sorgusunun indeksi.
create index reviews_due_idx
  on public.reviews (user_id, due_at)
  where stage < 3;

create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.touch_updated_at();


-- ─── attempts ───────────────────────────────────────────────────────────────
-- Quiz oturumu özeti. Anonim çözenler için kayıt tutulmuyor.

create table public.attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  deck_id       uuid not null references public.decks (id) on delete cascade,
  correct_count int  not null check (correct_count >= 0),
  total_count   int  not null check (total_count > 0),
  created_at    timestamptz not null default now(),

  constraint dogru_toplami_asamaz check (correct_count <= total_count)
);

create index attempts_user_created_idx
  on public.attempts (user_id, created_at desc);


-- ─── llm_usage_logs ─────────────────────────────────────────────────────────
-- Maliyet kuralı: her Claude çağrısının token kullanımı loglanır.

create table public.llm_usage_logs (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid references public.profiles (id) on delete set null,
  deck_id                     uuid references public.decks (id) on delete set null,
  step                        text not null,
  model                       text not null,
  input_tokens                int  not null default 0,
  output_tokens               int  not null default 0,
  cache_creation_input_tokens int  not null default 0,
  cache_read_input_tokens     int  not null default 0,
  estimated_cost_usd          numeric(10, 6) not null default 0,
  latency_ms                  int,
  created_at                  timestamptz not null default now()
);

comment on column public.llm_usage_logs.step is
  'Örn: questions_batch_1, flashcards. Hangi adımın ne kadara mal olduğunu görmek için.';

create index llm_usage_logs_user_created_idx
  on public.llm_usage_logs (user_id, created_at desc);

create index llm_usage_logs_deck_idx
  on public.llm_usage_logs (deck_id);
