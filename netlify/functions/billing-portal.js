/* Raeve Marketing — Stripe billing portal session.
 *
 * The client's browser calls this with their Supabase access token. We:
 *   1. verify the token (who is this logged-in user?)
 *   2. look up that user's Stripe customer id (under RLS, they only see their own)
 *   3. ask Stripe for a one-time billing-portal link and return it
 *
 * The Stripe SECRET key lives only in Netlify env vars, never in the browser.
 *
 * Required Netlify environment variables:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, STRIPE_SECRET_KEY
 */
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Not signed in." });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!supabaseUrl || !supabaseAnon || !stripeSecret) {
    return json(500, { error: "Billing is not configured yet." });
  }

  // Supabase client scoped to this user's token, so RLS applies.
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData || !userData.user) {
    return json(401, { error: "Your session expired. Sign in again." });
  }

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("stripe_customer_id")
    .eq("user_id", userData.user.id)
    .single();

  if (clientErr || !client || !client.stripe_customer_id) {
    return json(404, { error: "No billing account on file yet. Contact Raeve." });
  }

  const stripe = Stripe(stripeSecret);
  const origin = event.headers.origin || "https://raevemarketing.com";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: client.stripe_customer_id,
      return_url: `${origin}/portal/`
    });
    return json(200, { url: session.url });
  } catch (e) {
    return json(502, { error: "Could not open billing right now." });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}
