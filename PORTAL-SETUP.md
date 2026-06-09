# Raeve Marketing — Client Portal Setup

A login-protected portal at **raevemarketing.com/portal** where clients submit
website requests and pay invoices. Built with Supabase (login + database) and
Stripe (billing). One-time setup below; after that you run everything from the
Supabase and Stripe dashboards.

> Secret keys never go in the code. Public keys go in `portal/config.js`; secret
> keys go in Netlify environment variables only.

---

## 1. Supabase (login + database) — ~10 min

1. Create a free account at https://supabase.com and a new project.
   Pick a strong database password (save it in your password manager).
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`,
   and click **Run**. This creates the `clients` and `requests` tables with
   security rules.
3. Go to **Settings → API** and copy two values:
   - **Project URL**
   - **anon public** key
4. Paste both into `portal/config.js` (replacing the placeholders).
   These two are safe to commit — the security rules protect the data.
5. **Authentication → URL Configuration:** set **Site URL** to
   `https://raevemarketing.com` and add this to **Redirect URLs**:
   `https://raevemarketing.com/portal/reset.html` (makes the password-reset
   email link work).

## 2. Stripe (billing) — ~10 min

1. Create an account at https://stripe.com and finish business verification.
2. **Settings → Billing → Customer portal:** click **Activate** (lets clients
   view/pay invoices and update cards on Stripe-hosted pages).
3. **Developers → API keys:** copy the **Secret key** (`sk_live_...`, or
   `sk_test_...` while testing). Keep this private.

## 3. Vercel — deploy + environment variables — ~5 min

1. At https://vercel.com, **Add New → Project** and import the GitHub repo
   `mtilt24/michelle-tilton`. Framework preset: **Other** (it's a static site;
   the `api/` folder becomes serverless functions automatically). Deploy.
2. **Project → Settings → Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `SUPABASE_URL` | your Project URL (same as in config.js) |
   | `SUPABASE_ANON_KEY` | your anon public key (same as in config.js) |
   | `STRIPE_SECRET_KEY` | your Stripe secret key |

3. **Project → Settings → Domains:** add `raevemarketing.com` and follow
   Vercel's DNS instructions (point the domain at Vercel, remove it from the old
   host). Until DNS switches, you can test on the free `*.vercel.app` URL.
4. **Deployments → Redeploy** so the env vars take effect.

## 4. Add your first client (Andrea Lynn) — ~5 min

1. **Supabase → Authentication → Users → Add user.** Enter Andrea's email and a
   temporary password, tick **Auto Confirm User**, save. Copy her **User UID**.
2. **Stripe → Customers → Add customer.** Use her name/email. Copy the
   **customer id** (`cus_...`).
3. **Supabase → SQL Editor**, run (with the real values):

   ```sql
   insert into public.clients (user_id, name, company, email, stripe_customer_id)
   values ('PASTE-UID', 'Andrea Lynn', 'Andrea Lynn Coaching',
           'andrea@andrealynncoaching.com', 'cus_XXXX');
   ```

4. Send Andrea the temp password and the login link:
   **https://raevemarketing.com/portal/login.html** (she resets her password on
   first visit via "Forgot your password?").

## Day-to-day

- **See / work requests:** Supabase → Table editor → `requests`. Change a row's
  `status` to `in_progress`, `review`, or `done`. The client sees it update.
- **Send an invoice:** Stripe → Invoices → create one for the customer. It shows
  up under their **View invoices & pay** button.
- **Add another client:** repeat Step 4.

## Test it locally (optional)

```
npm install
npx vercel dev
```

Opens the site with the billing function running. (Requires the env vars set in
your shell or a local `.env`.)

---

# Phase 2 — Add Client page, email alerts, review flow

Adds: a one-form "Add Client" admin page, email alerts (new request -> you;
ready-to-review -> client), and an in-portal review/approve loop.

## 2a. Run the new SQL

Supabase → SQL Editor → paste `supabase/02-review-and-updates.sql` → Run.
(Adds review fields and lets clients approve/request-changes on their own
requests.)

## 2b. Give yourself an admin login

The "Add client" tools only appear for your email.
1. Supabase → Authentication → Users → Add user → your email
   (`michelle@raevemarketing.com`) + a password, tick Auto Confirm.
2. That email must match `ADMIN_EMAIL` in `portal/config.js` (already set) and
   the `ADMIN_EMAIL` env var below.
   When you sign in with it, an **Add client** button appears in the portal.

## 2c. Resend (email) — ~5 min

1. Sign up free at https://resend.com.
2. **Domains → Add domain** → `raevemarketing.com`, add the DNS records it shows
   you (at your domain registrar). This lets email come from your domain.
   *(To test before DNS is done, you can send from `onboarding@resend.dev` to
   your own address.)*
3. **API Keys → Create** → copy the key (`re_...`).

## 2d. New Vercel environment variables

Add these (Settings → Environment Variables), then redeploy:

| Key | Value |
|-----|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** key (secret!) |
| `ADMIN_EMAIL` | `michelle@raevemarketing.com` |
| `RESEND_API_KEY` | your Resend key (`re_...`) |
| `FROM_EMAIL` | `Raeve Marketing <notifications@raevemarketing.com>` (or `onboarding@resend.dev` while testing) |
| `WEBHOOK_SECRET` | make up any random string; you'll reuse it in the next step |

## 2e. Supabase webhook (fires the emails)

Supabase → **Database → Webhooks → Create a new hook**:
- Table: `requests`
- Events: **Insert** and **Update**
- Type: **HTTP Request**, method **POST**
- URL: `https://raevemarketing.com/api/notify`
  *(use your `…vercel.app/api/notify` URL until the domain is live)*
- HTTP Headers: add `x-webhook-secret` = the same value you used for
  `WEBHOOK_SECRET`.

## How the review loop works

1. Client submits a request → **you get an email**.
2. You do the work, then in Supabase → Table editor → `requests`, on that row set
   `status` = `review`, and fill in `review_url` (link to what changed) and
   `review_note`.
3. **Client gets an email** and sees an Approve / Request changes box on their
   dashboard.
4. They click **Approve** (→ `done`) or **Request changes** (→ back to
   `in_progress`) and **you get an email** either way.

---

## Files

- `portal/` — login, reset, dashboard, and **admin (Add Client)** pages (+ `config.js`, styles, logic)
- `api/billing-portal.js` — creates the Stripe billing link
- `api/add-client.js` — creates a client's login + Stripe customer + row in one step
- `api/notify.js` — sends the email alerts (via Resend, triggered by Supabase webhook)
- `vercel.json` — security headers
- `supabase/schema.sql` — database tables + security rules
- `supabase/02-review-and-updates.sql` — review fields + client update policy
- `package.json` — function dependencies (Vercel installs on deploy)
