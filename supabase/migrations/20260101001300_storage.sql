-- ============================================================================
-- Uni Streak :: 0013 storage buckets and access rules
-- ============================================================================
-- Supabase Storage enforces access through RLS on `storage.objects`. The
-- convention every policy below relies on is that the first path segment is
-- the owning user's id, so `auth.uid()::text = (storage.foldername(name))[1]`
-- means "this file is mine".
--
-- On a plain PostgreSQL instance the `storage` schema does not exist, so the
-- whole migration is guarded and becomes a no-op locally.
-- ============================================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema absent (local run); skipping bucket setup';
    return;
  end if;

  -- Avatars and post media are world-readable within the app; message media
  -- and sounds are not, so they are served through signed URLs.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('avatars', 'avatars', true, 8388608,
     array['image/jpeg','image/png','image/webp','image/heic']),
    ('post-media', 'post-media', true, 52428800,
     array['image/jpeg','image/png','image/webp','image/heic','image/gif','video/mp4','video/quicktime']),
    ('message-media', 'message-media', false, 52428800,
     array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime',
           'audio/mp4','audio/mpeg','audio/wav','audio/x-caf']),
    ('sounds', 'sounds', false, 5242880,
     array['audio/mp4','audio/mpeg','audio/wav','audio/x-caf'])
  on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  -- Public read for the two public buckets.
  execute $p$
    create policy "public buckets are readable"
      on storage.objects for select
      using (bucket_id in ('avatars', 'post-media'));
  $p$;

  -- Private buckets: readable only by the owner. Message attachments are
  -- additionally served via signed URLs generated after a membership check.
  execute $p$
    create policy "own private objects are readable"
      on storage.objects for select to authenticated
      using (
        bucket_id in ('message-media', 'sounds')
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  $p$;

  -- Writes are always scoped to the caller's own folder.
  execute $p$
    create policy "users write their own folder"
      on storage.objects for insert to authenticated
      with check (
        bucket_id in ('avatars', 'post-media', 'message-media', 'sounds')
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  $p$;

  execute $p$
    create policy "users update their own folder"
      on storage.objects for update to authenticated
      using (auth.uid()::text = (storage.foldername(name))[1])
      with check (auth.uid()::text = (storage.foldername(name))[1]);
  $p$;

  execute $p$
    create policy "users delete their own folder"
      on storage.objects for delete to authenticated
      using (auth.uid()::text = (storage.foldername(name))[1]);
  $p$;

exception
  when duplicate_object then
    raise notice 'storage policies already present; skipping';
end $$;
