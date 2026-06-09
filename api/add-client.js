/* Raeve Marketing — add a client in one step (Vercel serverless function).
 *
 * Called from portal/admin.html by the admin (Michelle). It:
 *   1. verifies the caller is the admin (token email === ADMIN_EMAIL)
 *   2. creates the Supabase login (auth user)
 *   3. creates the Stripe customer
 *   4. inserts the clients row linking them
 * and returns a temporary password to hand the client.
 *
 * Uses the Supabase SERVICE ROLE key (full admin) — server-side only.
 *
 * Required Vercel env vars:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *   STRIPE_SECRET_KEY, ADMIN_EMAIL
 */
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.headers.authorization || req.headers.Authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ error: "Not signed in." });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  if (!SUPABASE_URL || !SERVICE_KEY || !STRIPE_SECRET_KEY || !ADMIN_EMAIL) {
    return res.status(500).json({ error: "Admin tools are not configured yet." });
  }

  // 1. verify the caller is the admin
  const asUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: u, error: uErr } = await asUser.auth.getUser(token);
  if (uErr || !u || !u.user) return res.status(401).json({ error: "Your session expired. Sign in again." });
  if ((u.user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: "Not authorized." });
  }

  const body = typeof req.body === "string" ? safeJson(req.body) : (req.body || {});
  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const company = (body.company || "").trim();
  if (!name || !email) return res.status(400).json({ error: "Name and email are required." });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const stripe = Stripe(STRIPE_SECRET_KEY);

  try {
    const tempPassword = "Raeve-" + crypto.randomBytes(5).toString("hex");

    // 2. create the login
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true
    });
    if (cErr) return res.status(400).json({ error: cErr.message });
    const userId = created.user.id;

    // 3. create the Stripe customer
    const customer = await stripe.customers.create({ name, email });

    // 4. link them in the clients table
    const { error: insErr } = await admin.from("clients").insert({
      user_id: userId, name, company: company || null, email, stripe_customer_id: customer.id
    });
    if (insErr) {
      // roll back the auth user so a retry is clean
      await admin.auth.admin.deleteUser(userId).catch(function () {});
      return res.status(400).json({ error: insErr.message });
    }

    return res.status(200).json({ ok: true, tempPassword });
  } catch (e) {
    return res.status(502).json({ error: (e && e.message) || "Could not add client." });
  }
};

function safeJson(s) { try { return JSON.parse(s || "{}"); } catch (e) { return {}; } }
