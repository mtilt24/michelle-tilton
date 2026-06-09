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

## 3. Netlify environment variables — ~3 min

In your Netlify site: **Site configuration → Environment variables**, add:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | your Project URL (same as in config.js) |
| `SUPABASE_ANON_KEY` | your anon public key (same as in config.js) |
| `STRIPE_SECRET_KEY` | your Stripe secret key |

Then **trigger a deploy** so the billing function picks them up.

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
npx netlify dev
```

Opens the site with the billing function running. (Requires the env vars set in
your shell or a local `.env`.)

## Files

- `portal/` — login, password reset, and dashboard pages (+ `config.js`, styles, logic)
- `netlify/functions/billing-portal.js` — creates the Stripe billing link
- `supabase/schema.sql` — database tables + security rules
- `package.json` — function dependencies (Netlify installs on deploy)
