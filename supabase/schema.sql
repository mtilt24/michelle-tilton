-- Raeve Marketing client portal — database schema.
-- Run this once in your Supabase project:  SQL Editor  >  New query  >  paste  >  Run.
-- Re-running is safe.

-- ---------- clients: one row per client account, tied to a login ----------
create table if not exists public.clients (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  company            text,
  email              text,
  stripe_customer_id text,
  created_at         timestamptz not null default now()
);

create unique index if not exists clients_user_id_key on public.clients(user_id);

-- ---------- requests: website requests submitted by a client ----------
create table if not exists public.requests (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  title      text not null,
  type       text,
  priority   text not null default 'normal',
  details    text,
  status     text not null default 'new',   -- new | in_progress | review | done
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists requests_client_id_idx on public.requests(client_id);

-- ---------- Row Level Security ----------
-- With RLS on, the public anon key can ONLY reach rows these policies allow.
-- You (via the Supabase dashboard / service role) bypass RLS and see everything.

alter table public.clients  enable row level security;
alter table public.requests enable row level security;

-- a client can read and update only their own client record
drop policy if exists "client reads own record"   on public.clients;
create policy "client reads own record" on public.clients
  for select using (auth.uid() = user_id);

drop policy if exists "client updates own record" on public.clients;
create policy "client updates own record" on public.clients
  for update using (auth.uid() = user_id);

-- a client can read and create only their own requests
drop policy if exists "client reads own requests" on public.requests;
create policy "client reads own requests" on public.requests
  for select using (
    client_id in (select id from public.clients where user_id = auth.uid())
  );

drop policy if exists "client creates own requests" on public.requests;
create policy "client creates own requests" on public.requests
  for insert with check (
    client_id in (select id from public.clients where user_id = auth.uid())
  );

-- ---------- How to add a client (example: Andrea Lynn) ----------
-- 1) Authentication > Users > Add user  (email + a temporary password, tick "Auto Confirm").
--    Copy the new user's UID.
-- 2) Create her Stripe customer (Stripe dashboard) and copy the customer id (cus_...).
-- 3) Run, with the real values:
--
-- insert into public.clients (user_id, name, company, email, stripe_customer_id)
-- values ('PASTE-AUTH-USER-UID', 'Andrea Lynn', 'Andrea Lynn Coaching',
--         'andrea@andrealynncoaching.com', 'cus_XXXXXXXX');
--
-- To work a request: Table editor > requests > change `status` to
-- in_progress / review / done. The client sees it update on their dashboard.
