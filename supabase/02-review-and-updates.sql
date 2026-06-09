-- Raeve Marketing portal — phase 2 additions (review flow).
-- Run once in Supabase SQL Editor, same as before. Safe to re-run.

-- When you mark a request "ready to review," you fill these in (Table editor):
--   review_url  = link to the page/preview you changed
--   review_note = a short note to the client
alter table public.requests add column if not exists review_url  text;
alter table public.requests add column if not exists review_note text;

-- Let a client update their OWN requests (so the Approve / Request changes
-- buttons work). RLS still limits them to their own rows only.
drop policy if exists "client updates own requests" on public.requests;
create policy "client updates own requests" on public.requests
  for update
  using      (client_id in (select id from public.clients where user_id = auth.uid()))
  with check (client_id in (select id from public.clients where user_id = auth.uid()));
