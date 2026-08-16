-- ============================================================================
-- 0002_rls.sql — Row Level Security
--
-- Kural: her tabloda RLS AÇIK ve varsayılan olarak hiçbir şey açık değil.
-- Sonra tek tek izin veriyoruz. Politikası olmayan bir işlem = yasak.
--
-- Service role (SUPABASE_SERVICE_ROLE_KEY) bu politikaların hepsini bypass
-- eder — üretilen soruları yazmak, PDF metnini okumak gibi işler onunla
-- yapılıyor. Orada "bu kullanıcı gerçekten sahibi mi?" kontrolünü kod
-- yapmak zorunda.
-- ============================================================================

alter table public.profiles         enable row level security;
alter table public.source_documents enable row level security;
alter table public.decks            enable row level security;
alter table public.questions        enable row level security;
alter table public.flashcards       enable row level security;
alter table public.reviews          enable row level security;
alter table public.attempts         enable row level security;
alter table public.llm_usage_logs   enable row level security;


-- ─── profiles ───────────────────────────────────────────────────────────────
-- Kullanıcı sadece kendi profilini görür ve düzenler.
-- INSERT yok: profil satırını trigger (security definer) açıyor.

create policy "profil kendi okur"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profil kendi günceller"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));


-- ─── source_documents ───────────────────────────────────────────────────────
-- Hiçbir politika YOK — yani anon/authenticated hiçbir şey yapamaz.
-- Ham ders metni sadece service role tarafından okunur/yazılır.
-- (RLS açık + politika yok = herkese kapalı.)


-- ─── decks ──────────────────────────────────────────────────────────────────
-- Okuma: kendi destelerin VEYA paylaşıma açılmış herhangi bir deste.
-- Paylaşılan desteler giriş yapmamış kullanıcıya da açık (anon rolü).

create policy "deste sahibi okur"
  on public.decks for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "paylaşılan deste herkese açık"
  on public.decks for select
  to anon, authenticated
  using (is_public = true);

create policy "deste sahibi oluşturur"
  on public.decks for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "deste sahibi günceller"
  on public.decks for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "deste sahibi siler"
  on public.decks for delete
  to authenticated
  using (owner_id = (select auth.uid()));


-- ─── questions / flashcards ─────────────────────────────────────────────────
-- Görünürlük tamamen bağlı olduğu desteden türer. Yazma yok: soruları
-- sadece service role (üretim adımı) yazar.
--
-- NOT: correct_index ve explanation da istemciye gidiyor. Bu bilinçli bir
-- tercih — cevabı devtools'tan görmek mümkün. Bu bir sınav sistemi değil,
-- çalışma aracı. Gerekirse ileride cevap kontrolü sunucuya taşınır.

create policy "soru görünür deste üzerinden"
  on public.questions for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.decks d
      where d.id = questions.deck_id
        and (d.is_public = true or d.owner_id = (select auth.uid()))
    )
  );

create policy "kart görünür deste üzerinden"
  on public.flashcards for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.decks d
      where d.id = flashcards.deck_id
        and (d.is_public = true or d.owner_id = (select auth.uid()))
    )
  );


-- ─── reviews ────────────────────────────────────────────────────────────────
-- Tekrar kuyruğu tamamen kişiye özel.

create policy "tekrar kendi okur"
  on public.reviews for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "tekrar kendi ekler"
  on public.reviews for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "tekrar kendi günceller"
  on public.reviews for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "tekrar kendi siler"
  on public.reviews for delete
  to authenticated
  using (user_id = (select auth.uid()));


-- ─── attempts ───────────────────────────────────────────────────────────────

create policy "deneme kendi okur"
  on public.attempts for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "deneme kendi ekler"
  on public.attempts for insert
  to authenticated
  with check (user_id = (select auth.uid()));


-- ─── llm_usage_logs ─────────────────────────────────────────────────────────
-- Kullanıcı kendi harcamasını görebilir; yazma sadece service role.

create policy "kullanım kendi okur"
  on public.llm_usage_logs for select
  to authenticated
  using (user_id = (select auth.uid()));
