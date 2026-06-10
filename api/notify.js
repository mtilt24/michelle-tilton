/* Raeve Marketing — email notifications (Vercel serverless function).
 *
 * Triggered by Supabase Database Webhooks on the `requests` table:
 *   - INSERT (new request)             -> email the admin
 *   - UPDATE status -> "review"        -> email the client (with link + note)
 *   - UPDATE status "review"->"in_progress" (client asked for changes) -> email admin
 *   - UPDATE status -> "done" (client approved)                        -> email admin
 *
 * Sends through Resend. Uses the Supabase SERVICE ROLE key to look up the
 * client's email. All secrets live in Vercel env, never the browser.
 *
 * Required Vercel env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, FROM_EMAIL, ADMIN_EMAIL
 * Optional: WEBHOOK_SECRET (set the same value as an "x-webhook-secret" header
 * on the Supabase webhook so only Supabase can call this).
 */
const { createClient } = require("@supabase/supabase-js");

const PORTAL_URL = "https://raevemarketing.com/portal/";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const expected = process.env.WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers["x-webhook-secret"] || req.headers["X-Webhook-Secret"];
    if (got !== expected) return res.status(401).json({ error: "bad secret" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  if (!RESEND_API_KEY || !FROM_EMAIL || !ADMIN_EMAIL || !SERVICE_KEY) {
    return res.status(200).json({ skipped: "email not configured" });
  }

  const payload = typeof req.body === "string" ? safeJson(req.body) : (req.body || {});
  const table = payload.table || "requests";  // requests | comments
  const type = payload.type;                 // INSERT | UPDATE | DELETE
  const rec = payload.record || {};
  const old = payload.old_record || {};

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  async function clientInfo(id) {
    if (!id) return {};
    const { data } = await admin.from("clients").select("name,email").eq("id", id).single();
    return data || {};
  }
  async function requestInfo(id) {
    if (!id) return {};
    const { data } = await admin.from("requests").select("title,client_id").eq("id", id).single();
    return data || {};
  }

  var jobs = [];

  // ---- replies on a request ----
  if (table === "comments" && type === "INSERT") {
    const r = await requestInfo(rec.request_id);
    const c = await clientInfo(r.client_id);
    if (rec.author_role === "admin" && c.email) {
      jobs.push({
        to: c.email,
        subject: `Michelle replied: ${r.title || "your request"}`,
        html: `<p>Hi ${esc(firstName(c.name))},</p>
               <p>Michelle left a note on <strong>${esc(r.title)}</strong>:</p>
               <blockquote>${esc(rec.body)}</blockquote>
               <p>Reply from <a href="${PORTAL_URL}">your portal</a>.</p>
               <p>&mdash; Raeve Marketing</p>`
      });
    } else if (rec.author_role === "client") {
      jobs.push({
        to: ADMIN_EMAIL,
        subject: `Reply from ${c.name || "a client"}: ${r.title || "a request"}`,
        html: `<p><strong>${esc(c.name)}</strong> replied on <strong>${esc(r.title)}</strong>:</p>
               <blockquote>${esc(rec.body)}</blockquote>
               <p><a href="${PORTAL_URL}">Open the portal</a></p>`
      });
    }
  } else if (table === "requests" && type === "INSERT") {
    const c = await clientInfo(rec.client_id);
    jobs.push({
      to: ADMIN_EMAIL,
      subject: `New request from ${c.name || "a client"}: ${rec.title}`,
      html: `<p><strong>${esc(c.name)}</strong> just submitted a request.</p>
             <p><strong>${esc(rec.title)}</strong><br>${esc(rec.type)} &middot; ${esc(rec.priority)} priority</p>
             ${rec.details ? `<p>${esc(rec.details)}</p>` : ""}
             <p><a href="${PORTAL_URL}">Open the portal</a></p>`
    });
  } else if (table === "requests" && type === "UPDATE") {
    const becameReview = rec.status === "review" && old.status !== "review";
    const noteChanged = (rec.review_note || "") !== (old.review_note || "")
                     || (rec.review_url || "") !== (old.review_url || "");
    // Email the client when it's handed to them for review, OR any time Michelle
    // adds / edits the note or link (so updates never go unnoticed).
    if (becameReview || noteChanged) {
      const c = await clientInfo(rec.client_id);
      if (c.email) jobs.push({
        to: c.email,
        subject: becameReview ? `Ready for your review: ${rec.title}` : `Update on: ${rec.title}`,
        html: `<p>Hi ${esc(firstName(c.name))},</p>
               <p>${becameReview
                    ? `Your request <strong>${esc(rec.title)}</strong> is ready for you to review.`
                    : `Michelle posted an update on <strong>${esc(rec.title)}</strong>.`}</p>
               ${rec.review_note ? `<p>${esc(rec.review_note)}</p>` : ""}
               <p>${becameReview
                    ? `Open <a href="${PORTAL_URL}">your portal</a> to see what changed, then approve it or ask for changes.`
                    : `Open <a href="${PORTAL_URL}">your portal</a> to see the details and reply.`}</p>
               <p>&mdash; Michelle, Raeve Marketing</p>`
      });
    }
    if (rec.status === "in_progress" && old.status === "review") {
      const c = await clientInfo(rec.client_id);
      jobs.push({
        to: ADMIN_EMAIL,
        subject: `Changes requested: ${rec.title}`,
        html: `<p><strong>${esc(c.name)}</strong> asked for changes on <strong>${esc(rec.title)}</strong>.</p>
               <p><a href="${PORTAL_URL}">Open the portal</a></p>`
      });
    }
    if (rec.status === "done" && old.status !== "done") {
      const c = await clientInfo(rec.client_id);
      jobs.push({
        to: ADMIN_EMAIL,
        subject: `Approved: ${rec.title}`,
        html: `<p><strong>${esc(c.name)}</strong> approved <strong>${esc(rec.title)}</strong>.</p>`
      });
    }
  }

  var sent = 0;
  for (var i = 0; i < jobs.length; i++) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM_EMAIL, to: jobs[i].to, subject: jobs[i].subject, html: jobs[i].html })
      });
      if (r.ok) sent++;
      else console.error("Resend error:", await r.text());
    } catch (e) { console.error("Resend send failed:", e && e.message); }
  }
  return res.status(200).json({ sent });
};

function firstName(n) { return (n || "").split(" ")[0] || n || "there"; }
function safeJson(s) { try { return JSON.parse(s || "{}"); } catch (e) { return {}; } }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
