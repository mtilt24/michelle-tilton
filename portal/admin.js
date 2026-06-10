/* Raeve Marketing — admin dashboard logic (admin.html only).
 * Inbox / action-first view of EVERY client's requests, plus the two-way
 * reply thread and the "add client" tool. Admin-only: the RLS admin policies
 * (supabase/03-admin-and-comments.sql) are what actually let this read/write
 * across clients; the email check here just guards the page.
 */
(function () {
  var cfg = window.RAEVE_PORTAL || {};
  var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  function $(id) { return document.getElementById(id); }
  function show(el, text, type) { if (!el) return; el.textContent = text; el.className = "msg show " + (type || "error"); }
  function hide(el) { if (el) el.className = "msg"; }
  function fmtDate(s) {
    try { return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
    catch (e) { return s; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function statusLabel(s) { return (s || "new").replace("_", " "); }

  var adminEmail = "";
  var requests = [];          // each: row + .client (embedded) + .comments []
  var clients = [];
  var filterStatus = "all";
  var filterClient = "all";

  /* ----- guard: must be the admin ----- */
  sb.auth.getSession().then(function (res) {
    if (!res.data.session) { window.location.replace("login.html"); return; }
    adminEmail = (res.data.session.user && res.data.session.user.email || "").toLowerCase();
    if (!cfg.ADMIN_EMAIL || adminEmail !== String(cfg.ADMIN_EMAIL).toLowerCase()) {
      $("admin").innerHTML = '<div class="card"><p class="empty">This page is for Raeve admin only.</p></div>';
      return;
    }
    loadAll();
  });

  var signOut = $("signOutBtn");
  if (signOut) signOut.addEventListener("click", function () {
    sb.auth.signOut().then(function () { window.location.replace("login.html"); });
  });

  /* ----- load clients + requests + comments, stitch together ----- */
  function loadAll() {
    Promise.all([
      sb.from("clients").select("id,name,company,email").order("name"),
      sb.from("requests").select("*, client:clients(name,company,email)").order("created_at", { ascending: false }),
      sb.from("comments").select("*").order("created_at", { ascending: true })
    ]).then(function (r) {
      clients = (r[0].data) || [];
      requests = (r[1].data) || [];
      var comments = (r[2].data) || [];
      var byReq = {};
      comments.forEach(function (c) { (byReq[c.request_id] = byReq[c.request_id] || []).push(c); });
      requests.forEach(function (req) { req.comments = byReq[req.id] || []; });
      renderClientFilter();
      render();
    });
  }

  function lastComment(req) { return req.comments.length ? req.comments[req.comments.length - 1] : null; }

  // A request "needs you" if it's brand new, or the client sent the last reply.
  function needsYou(req) {
    if ((req.status || "new") === "new") return true;
    var lc = lastComment(req);
    return !!(lc && lc.author_role === "client");
  }

  function renderClientFilter() {
    var sel = $("fClient");
    if (!sel) return;
    sel.innerHTML = '<option value="all">All clients</option>' +
      clients.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join("");
    sel.value = filterClient;
  }

  function render() {
    var needs = requests.filter(needsYou);
    var rest = requests.filter(function (r) { return !needsYou(r); }).filter(function (r) {
      if (filterStatus !== "all" && (r.status || "new") !== filterStatus) return false;
      if (filterClient !== "all" && r.client_id !== filterClient) return false;
      return true;
    });

    $("needsCount").textContent = needs.length ? "(" + needs.length + ")" : "";
    $("needsList").innerHTML = needs.length
      ? needs.map(reqCard).join("")
      : '<p class="empty">All caught up. Nothing waiting on you.</p>';
    $("allList").innerHTML = rest.length
      ? rest.map(reqCard).join("")
      : '<p class="empty">Nothing here with these filters.</p>';
  }

  function commentsHtml(req) {
    if (!req.comments.length) return "";
    return '<div class="thread">' + req.comments.map(function (c) {
      var mine = c.author_role === "admin";
      return '<div class="bubble ' + (mine ? "bubble-me" : "bubble-them") + '">' +
        '<div class="bubble-who">' + esc(mine ? "You" : (req.client && req.client.name ? req.client.name.split(" ")[0] : "Client")) +
        ' &middot; ' + fmtDate(c.created_at) + '</div>' +
        '<div class="bubble-body">' + esc(c.body) + '</div>' +
      '</div>';
    }).join("") + '</div>';
  }

  function reqCard(r) {
    var st = (r.status || "new");
    var cname = (r.client && r.client.name) || "Unknown client";
    var opts = ["new", "in_progress", "review", "done"].map(function (s) {
      return '<option value="' + s + '"' + (s === st ? " selected" : "") + '>' + statusLabel(s) + '</option>';
    }).join("");
    return '<div class="req" data-id="' + esc(r.id) + '">' +
      '<div class="req-top">' +
        '<span class="req-title">' + esc(r.title) + '</span>' +
        '<span class="status status-' + esc(st) + '">' + esc(statusLabel(st)) + '</span>' +
      '</div>' +
      '<div class="req-meta"><span class="client-tag">' + esc(cname) + '</span> &middot; ' +
        esc(r.type || "Request") + ' &middot; ' + esc(r.priority || "normal") + ' priority &middot; ' + fmtDate(r.created_at) + '</div>' +
      (r.details ? '<div class="req-details">' + esc(r.details) + '</div>' : '') +
      commentsHtml(r) +
      '<div class="admin-edit">' +
        '<div class="ae-row">' +
          '<label class="ae-field"><span class="field-label">Status</span>' +
            '<select data-f="status">' + opts + '</select></label>' +
          '<label class="ae-field"><span class="field-label">Review link</span>' +
            '<input type="url" data-f="review_url" placeholder="https://…" value="' + esc(r.review_url || "") + '"></label>' +
        '</div>' +
        '<label class="ae-field"><span class="field-label">Review note (client sees this when status is Review)</span>' +
          '<textarea data-f="review_note" rows="2" placeholder="What changed / what to look at">' + esc(r.review_note || "") + '</textarea></label>' +
        '<button class="btn btn-sm" data-act="save">Save</button>' +
        '<span class="save-msg mono"></span>' +
      '</div>' +
      '<div class="reply">' +
        '<textarea data-f="reply" rows="2" placeholder="Reply to ' + esc((r.client && r.client.name ? r.client.name.split(" ")[0] : "client")) + '…"></textarea>' +
        '<button class="btn btn-ghost btn-sm" data-act="reply">Send reply</button>' +
      '</div>' +
    '</div>';
  }

  /* ----- actions (event delegation across both lists) ----- */
  function findReq(id) { for (var i = 0; i < requests.length; i++) if (requests[i].id === id) return requests[i]; return null; }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-act]");
    if (!btn) return;
    var card = btn.closest(".req");
    if (!card) return;
    var id = card.getAttribute("data-id");
    var act = btn.getAttribute("data-act");

    if (act === "save") {
      var payload = {
        status: card.querySelector('[data-f="status"]').value,
        review_url: card.querySelector('[data-f="review_url"]').value.trim() || null,
        review_note: card.querySelector('[data-f="review_note"]').value.trim() || null
      };
      var msg = card.querySelector(".save-msg");
      btn.disabled = true; btn.textContent = "Saving…";
      sb.from("requests").update(payload).eq("id", id).then(function (res) {
        btn.disabled = false; btn.textContent = "Save";
        if (res.error) { msg.textContent = res.error.message; return; }
        msg.textContent = "Saved";
        var req = findReq(id); if (req) { req.status = payload.status; req.review_url = payload.review_url; req.review_note = payload.review_note; }
        setTimeout(render, 500);
      });
    }

    if (act === "reply") {
      var ta = card.querySelector('[data-f="reply"]');
      var body = ta.value.trim();
      if (!body) return;
      btn.disabled = true; btn.textContent = "Sending…";
      sb.from("comments").insert({ request_id: id, author_email: adminEmail, author_role: "admin", body: body })
        .then(function (res) {
          btn.disabled = false; btn.textContent = "Send reply";
          if (res.error) return;
          ta.value = "";
          loadAll();
        });
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target.id === "fStatus") { filterStatus = e.target.value; render(); }
    if (e.target.id === "fClient") { filterClient = e.target.value; render(); }
  });

  /* ----- add client (collapsible) ----- */
  var addToggle = $("addToggle");
  if (addToggle) addToggle.addEventListener("click", function () {
    var c = $("addClientCard");
    c.style.display = c.style.display === "none" ? "block" : "none";
  });

  var addForm = $("addClientForm");
  if (addForm) addForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var adminMsg = $("adminMsg");
    hide(adminMsg);
    $("result").style.display = "none";
    var btn = $("addClientBtn");
    btn.disabled = true; btn.textContent = "Creating…";
    sb.auth.getSession().then(function (res) {
      var token = res.data.session && res.data.session.access_token;
      return fetch("/api/add-client", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: $("cName").value.trim(),
          company: $("cCompany").value.trim(),
          email: $("cEmail").value.trim()
        })
      });
    }).then(function (r) { return r.json(); }).then(function (data) {
      btn.disabled = false; btn.textContent = "Create client";
      if (data && data.ok) {
        addForm.reset();
        $("tempPw").textContent = data.tempPassword;
        $("result").style.display = "block";
        show(adminMsg, "Client created.", "success");
        loadAll();
      } else {
        show(adminMsg, (data && data.error) || "Could not add client.", "error");
      }
    }).catch(function () {
      btn.disabled = false; btn.textContent = "Create client";
      show(adminMsg, "Something went wrong. Try again.", "error");
    });
  });
})();
