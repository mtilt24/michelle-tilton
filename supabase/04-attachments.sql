-- Raeve Marketing portal — phase 4: file attachments on requests.
-- Safe to re-run. Sets up a private Storage bucket + an attachments table so
-- clients can add images/files to a request and you can see them.

-- ---------- private storage bucket ----------
insert into storage.buckets (id, name, public)
values ('request-files', 'request-files', false)
on conflict (id) do nothing;

-- ---------- attachments table (links a stored file to a request) ----------
create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.requests(id) on delete cascade,
  client_id    uuid not null references public.clients(id)  on delete cascade,
  path         text not null,            -- storage object path: <client_id>/<request_id>/<file>
  name         text,
  size         bigint,
  content_type text,
  uploaded_by  text not null default 'client',   -- 'client' | 'admin'
  created_at   timestamptz not null default now()
);
create index if not exists attachments_request_id_idx on public.attachments(request_id);
alter table public.attachments enable row level security;

-- attachments rows: client reads/writes their own (by request ownership); admin all
drop policy if exists "client reads own attachments" on public.attachments;
create policy "client reads own attachments" on public.attachments
  for select using (
    request_id in (
      select r.id from public.requests r
      join public.clients c on c.id = r.client_id
      where c.user_id = auth.uid()
    )
  );

drop policy if exists "client writes own attachments" on public.attachments;
create policy "client writes own attachments" on public.attachments
  for insert with check (
    uploaded_by = 'client'
    and request_id in (
      select r.id from public.requests r
      join public.clients c on c.id = r.client_id
      where c.user_id = auth.uid()
    )
  );

drop policy if exists "admin reads all attachments" on public.attachments;
create policy "admin reads all attachments" on public.attachments
  for select using (public.is_admin());

drop policy if exists "admin writes all attachments" on public.attachments;
create policy "admin writes all attachments" on public.attachments
  for insert with check (public.is_admin());

-- ---------- storage object access (bucket 'request-files') ----------
-- Path convention: the first folder in the object name is the client's id, so a
-- client only ever touches files under their own folder; admin sees all.
drop policy if exists "client uploads own files" on storage.objects;
create policy "client uploads own files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'request-files'
    and (storage.foldername(name))[1] in (select id::text from public.clients where user_id = auth.uid())
  );

drop policy if exists "client reads own files" on storage.objects;
create policy "client reads own files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'request-files'
    and (
      (storage.foldername(name))[1] in (select id::text from public.clients where user_id = auth.uid())
      or public.is_admin()
    )
  );

drop policy if exists "admin manages all files" on storage.objects;
create policy "admin manages all files" on storage.objects
  for all to authenticated
  using      (bucket_id = 'request-files' and public.is_admin())
  with check (bucket_id = 'request-files' and public.is_admin());
