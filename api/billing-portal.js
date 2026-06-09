/* Raeve Marketing — Stripe billing portal session (Vercel serverless function).
 *
 * The client's browser calls this with their Supabase access token. We:
 *   1. verify the token (who is this logged-in user?)
 *   2. look up that user's Stripe customer id (under RLS, they only see their own)
 *   3. ask Stripe for a one-time billing-portal link and return it
 *
 * The Stripe SECRET key lives only in Vercel env vars, never in the browser.
 *
 * Required Vercel environment variables:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, STRIPE_SECRET_KEY
 */
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ error: "Not signed in." });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!supabaseUrl || !supabaseAnon || !stripeSecret) {
    return res.status(500).json({ error: "Billing is not configured yet." });
  }

  // Supabase client scoped to this user's token, so RLS applies.
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData || !userData.user) {
    return res.status(401).json({ error: "Your session expired. Sign in again." });
  }

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("stripe_customer_id")
    .eq("user_id", userData.user.id)
    .single();

  if (clientErr || !client || !client.stripe_customer_id) {
    return res.status(404).json({ error: "No billing account on file yet. Contact Raeve." });
  }

  const stripe = Stripe(stripeSecret);
  const origin = req.headers.origin || "https://raevemarketing.com";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: client.stripe_customer_id,
      return_url: `${origin}/portal/`
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(502).json({ error: "Could not open billing right now." });
  }
};
