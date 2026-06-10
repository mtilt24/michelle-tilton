-- Raeve Marketing portal — phase 3 additions.
-- Run once in Supabase SQL Editor (same as the earlier files). Safe to re-run.
--
-- Adds:
--   1. must_reset flag  -> forces a new client off their temp password on first login
--   2. comments table   -> the two-way reply thread on a request
--   3. is_admin()        -> single source of truth for "this is Michelle"
--   4. admin RLS policies -> so the admin dashboard can see/work EVERY client's data
--      straight from the browser (no more editing rows in the Supabase dashboard).

-- ---------- 1. force password reset on first login ----------
alter table public.clients add column if not exists must_reset boolean not null default true;

-- ---------- 2. comments: reply thread on a request ----------
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests(id) on delete cascade,
  author_email text not null,
  author_role text not null,        -- 'admin' | 'client'
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists comments_request_id_idx on public.comments(request_id);
alter table public.comments enable row level security;

-- ---------- 3. who is the admin ----------
-- Matches ADMIN_EMAIL in portal/config.js. Change the email in BOTH places if it ever moves.
create or replace function public.is_admin() returns boolean
  language sql stable as $$
    select coalesce((auth.jwt() ->> 'email') = 'michelle@raevemarketing.com', false)
  $$;

-- ---------- 4. admin can see / work everything ----------
-- clients: admin reads all
drop policy if exists "admin reads all clients" on public.clients;
create policy "admin reads all clients" on public.clients
  for select using (public.is_admin());

-- requests: admin reads + updates all (status, review_url, review_note)
drop policy if exists "admin reads all requests" on public.requests;
create policy "admin reads all requests" on public.requests
  for select using (public.is_admin());

drop policy if exists "admin updates all requests" on public.requests;
create policy "admin updates all requests" on public.requests
  for update using (public.is_admin()) with check (public.is_admin());

-- comments: client reads + writes on their OWN requests; admin reads + writes all
drop policy if exists "client reads own comments" on public.comments;
create policy "client reads own comments" on public.comments
  for select using (
    request_id in (
      select r.id from public.requests r
      join public.clients c on c.id = r.client_id
      where c.user_id = auth.uid()
    )
  );

drop policy if exists "client writes own comments" on public.comments;
create policy "client writes own comments" on public.comments
  for insert with check (
    author_role = 'client'
    and request_id in (
      select r.id from public.requests r
      join public.clients c on c.id = r.client_id
      where c.user_id = auth.uid()
    )
  );

drop policy if exists "admin reads all comments" on public.comments;
create policy "admin reads all comments" on public.comments
  for select using (public.is_admin());

drop policy if exists "admin writes all comments" on public.comments;
create policy "admin writes all comments" on public.comments
  for insert with check (public.is_admin());
