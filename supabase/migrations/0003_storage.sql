-- ============================================================================
-- 0003_storage.sql — PDF bucket'ı ve erişim politikaları
--
-- Bucket private. Dosya yolu şeması: {user_id}/{sha256}.pdf
-- Kullanıcı sadece kendi klasörüne yazabilir ve kendi klasörünü okuyabilir.
-- Paylaşılan şey sorular; PDF'in kendisi hiçbir zaman public olmuyor.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pdfs',
  'pdfs',
  false,
  10485760,               -- 10 MB, uygulamadaki LIMITS.maxFileBytes ile aynı
  array['application/pdf']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- storage.foldername(name)[1] → yoldaki ilk klasör, yani {user_id}.
create policy "pdf kendi klasörüne yükler"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "pdf kendi klasörünü okur"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "pdf kendi klasöründen siler"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'pdfs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
