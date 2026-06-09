/* Raeve Marketing — client portal config.
 *
 * These two values are PUBLIC and safe to commit. The anon key only works
 * within the rules set by Supabase Row Level Security, so a client can never
 * see another client's data with it.
 *
 * Fill these in from your Supabase project:  Settings  >  API
 *   Project URL   ->  SUPABASE_URL
 *   anon public   ->  SUPABASE_ANON_KEY
 *
 * Secret keys (Stripe secret, Supabase service role) NEVER go in this file.
 * Those live in Netlify environment variables. See PORTAL-SETUP.md.
 */
window.RAEVE_PORTAL = {
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-SUPABASE-ANON-KEY"
};
