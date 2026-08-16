-- RLS doğrulama testi. Beklenen çıktıyı her satırda "beklenen=" ile yazdım.
\set ON_ERROR_STOP off
\pset format aligned

-- ── Hazırlık (service role gibi davranıyoruz: superuser, RLS bypass) ────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ayse@example.com', '{"full_name":"Ayşe"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'burak@example.com', '{"full_name":"Burak"}');

insert into public.source_documents (id, file_hash, storage_path, page_count, char_count, extracted_text)
values ('dddddddd-0000-0000-0000-000000000001', 'hash-abc', 'aaaaaaaa-0000-0000-0000-000000000001/hash-abc.pdf', 12, 9000, 'ders metni...');

insert into public.decks (id, owner_id, source_document_id, title, status) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'Ayşe''nin destesi', 'ready'),
  ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 'Burak''ın destesi', 'ready');

insert into public.questions (deck_id, position, stem, options, correct_index, explanation) values
  ('11111111-0000-0000-0000-000000000001', 1, 'Ayşe sorusu?', '["a","b","c","d"]', 0, 'çünkü'),
  ('22222222-0000-0000-0000-000000000002', 1, 'Burak sorusu?', '["a","b","c","d"]', 1, 'çünkü');

insert into public.llm_usage_logs (user_id, deck_id, step, model, input_tokens, output_tokens, estimated_cost_usd)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'questions_batch_1', 'claude-sonnet-4-6', 5000, 1200, 0.033);

\echo '=== TEST 1: Ayşe kendi destesini görür, Burak''ınkini GÖRMEZ (beklenen: 1 satır, Ayşe) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';
  select count(*) as gorunen_deste, min(title) as baslik from public.decks;
commit;

\echo '=== TEST 2: Burak kendi destesini görür (beklenen: 1 satır, Burak) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002"}';
  select count(*) as gorunen_deste, min(title) as baslik from public.decks;
commit;

\echo '=== TEST 3: Ayşe sadece kendi sorusunu görür (beklenen: 1, "Ayşe sorusu?") ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';
  select count(*) as gorunen_soru, min(stem) as soru from public.questions;
commit;

\echo '=== TEST 4: source_documents kimseye açık değil (beklenen: 0) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';
  select count(*) as gorunen_dokuman from public.source_documents;
commit;

\echo '=== TEST 5: Anonim kullanıcı hiçbir deste göremez (beklenen: 0) ==='
begin;
  set local role anon;
  select count(*) as gorunen_deste from public.decks;
commit;

\echo '=== TEST 6: Burak, Ayşe''nin destesini GÜNCELLEYEMEZ (beklenen: 0 satır etkilendi) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002"}';
  update public.decks set title = 'ELE GEÇİRİLDİ' where id = '11111111-0000-0000-0000-000000000001';
commit;
select title as ayse_destesi_basligi from public.decks where id = '11111111-0000-0000-0000-000000000001';

\echo '=== TEST 7: Burak, kendi adına Ayşe''nin id''siyle deste açamaz (beklenen: HATA) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002"}';
  savepoint s1;
  insert into public.decks (owner_id, source_document_id, title)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'sahte');
  rollback to s1;
commit;

\echo '=== TEST 8: Deste paylaşıma açılınca anonim görebilir (beklenen: 1 deste, 1 soru) ==='
update public.decks set is_public = true, share_slug = 'abc123xyz0'
  where id = '11111111-0000-0000-0000-000000000001';
begin;
  set local role anon;
  select
    (select count(*) from public.decks) as gorunen_deste,
    (select count(*) from public.questions) as gorunen_soru;
commit;

\echo '=== TEST 9: Anonim, paylaşılan desteyi DEĞİŞTİREMEZ (beklenen: 0 satır / hata) ==='
begin;
  set local role anon;
  savepoint s2;
  update public.decks set title = 'anon değiştirdi' where is_public = true;
  rollback to s2;
commit;
select title as paylasilan_baslik from public.decks where id = '11111111-0000-0000-0000-000000000001';

\echo '=== TEST 10: Ayşe kendi kullanım logunu görür, Burak görmez (beklenen: 1 ve 0) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';
  select count(*) as ayse_log from public.llm_usage_logs;
commit;
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002"}';
  select count(*) as burak_log from public.llm_usage_logs;
commit;

\echo '=== TEST 11: profiles trigger''ı çalıştı mı? (beklenen: 2 profil) ==='
select count(*) as profil_sayisi from public.profiles;

\echo '=== TEST 12: Bozuk şık dizisi reddedilmeli (beklenen: 3 HATA) ==='
begin;
savepoint t12a;
insert into public.questions (deck_id, position, stem, options, correct_index, explanation)
  values ('11111111-0000-0000-0000-000000000001', 90, 'üç şık', '["a","b","c"]', 0, 'x');
rollback to t12a;
savepoint t12b;
insert into public.questions (deck_id, position, stem, options, correct_index, explanation)
  values ('11111111-0000-0000-0000-000000000001', 91, 'boş şık', '["a","","c","d"]', 0, 'x');
rollback to t12b;
savepoint t12c;
insert into public.questions (deck_id, position, stem, options, correct_index, explanation)
  values ('11111111-0000-0000-0000-000000000001', 92, 'aralık dışı', '["a","b","c","d"]', 7, 'x');
rollback to t12c;
commit;

\echo '=== TEST 13: is_public true iken share_slug zorunlu (beklenen: HATA) ==='
begin;
savepoint t13;
update public.decks set is_public = true, share_slug = null
  where id = '22222222-0000-0000-0000-000000000002';
rollback to t13;
commit;

\echo '=== TEST 14: Ayşe başkasının adına tekrar kaydı ekleyemez (beklenen: HATA) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}';
  savepoint t14;
  insert into public.reviews (user_id, question_id, deck_id, due_at)
  select 'bbbbbbbb-0000-0000-0000-000000000002', id, deck_id, now()
  from public.questions limit 1;
  rollback to t14;
commit;

\echo '=== TEST 15: Storage — kullanıcı başkasının klasörüne yükleyemez (beklenen: HATA) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002"}';
  savepoint t15a;
  insert into storage.objects (bucket_id, name)
    values ('pdfs', 'aaaaaaaa-0000-0000-0000-000000000001/calinti.pdf');
  rollback to t15a;
  \echo '--- kendi klasörüne yükleyebilmeli (beklenen: INSERT 0 1) ---'
  insert into storage.objects (bucket_id, name)
    values ('pdfs', 'bbbbbbbb-0000-0000-0000-000000000002/kendi.pdf');
commit;
