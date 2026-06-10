/* Raeve Marketing — admin dashboard logic (admin.html only).
 * Support-inbox view: every client's requests grouped by status as compact
 * rows; click a ticket to open its detail, thread, attachments, and controls.
 * Changing a status moves the ticket. Admin-only (RLS admin policies enforce it
 * server-side; the email check here just guards the page).
 */
(function () {
  var cfg = window.RAEVE_PORTAL || {};
  var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  var BUCKET = "request-files";

  // The status pipeline, in order. key = stored value, label = what you see.
  var STATUSES = [
    { key: "new",         label: "New" },
    { key: "in_progress", label: "In progress" },
    { key: "review",      label: "In review" },
    { key: "done",        label: "Complete" }
  ];
  function statusLabel(s) {
    for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].key === s) return STATUSES[i].label;
    return (s || "new").replace("_", " ");
  }

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

  var adminEmail = "";
  var requests = [];          // each: row + .client + .comments[] + .attachments[]
  var clients = [];
  var filterClient = "all";
  var expanded = {};          // request id -> true when opened

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

  /* ----- load clients + requests + comments + attachments ----- */
  function loadAll() {
    Promise.all([
      sb.from("clients").select("id,name,company,email").order("name"),
      sb.from("requests").select("*, client:clients(name,company,email), comments(*), attachments(*)").order("created_at", { ascending: false })
    ]).then(function (r) {
      clients = (r[0].data) || [];
      requests = (r[1].data) || [];
      requests.forEach(function (req) {
        (req.comments || []).sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      });
      renderClientFilter();
      // Sign all attachment URLs in one batch, then render.
      var paths = [];
      requests.forEach(function (req) { (req.attachments || []).forEach(function (f) { paths.push(f.path); }); });
      if (!paths.length) { render(); return; }
      sb.storage.from(BUCKET).createSignedUrls(paths, 3600).then(function (sres) {
        var map = {};
        (sres.data || []).forEach(function (s) { if (s && s.path) map[s.path] = s.signedUrl; });
        requests.forEach(function (req) { (req.attachments || []).forEach(function (f) { f.signedUrl = map[f.path]; }); });
        render();
      });
    });
  }

  function lastComment(req) { return req.comments.length ? req.comments[req.comments.length - 1] : null; }
  function needsReply(req) { var lc = lastComment(req); return !!(lc && lc.author_role === "client"); }

  function renderClientFilter() {
    var sel = $("fClient");
    if (!sel) return;
    sel.innerHTML = '<option value="all">All clients</option>' +
      clients.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join("");
    sel.value = filterClient;
  }

  function render() {
    var board = $("board");
    var visible = requests.filter(function (r) {
      return filterClient === "all" || r.client_id === filterClient;
    });
    board.innerHTML = STATUSES.map(function (st) {
      var inCol = visible.filter(function (r) { return (r.status || "new") === st.key; });
      var attention = inCol.filter(needsReply).length;
      return '<section class="status-group">' +
        '<h3 class="group-title">' + esc(st.label) +
          ' <span class="group-count">' + inCol.length + '</span>' +
          (attention ? ' <span class="group-flag">' + attention + ' need you</span>' : '') +
        '</h3>' +
        (inCol.length ? inCol.map(ticket).join("") : '<p class="empty group-empty">Nothing here.</p>') +
      '</section>';
    }).join("");
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

  function attachmentsHtml(files) {
    if (!files || !files.length) return "";
    return '<div class="attach">' + files.map(function (f) {
      var isImg = (f.content_type || "").indexOf("image/") === 0;
      if (isImg && f.signedUrl) {
        return '<a class="att-img" href="' + esc(f.signedUrl) + '" target="_blank" rel="noopener">' +
          '<img src="' + esc(f.signedUrl) + '" alt="' + esc(f.name || "image") + '" loading="lazy"></a>';
      }
      return '<a class="att-file" href="' + esc(f.signedUrl || "#") + '" target="_blank" rel="noopener">&#128206; ' + esc(f.name || "file") + '</a>';
    }).join("") + '</div>';
  }

  function ticket(r) {
    var st = (r.status || "new");
    var open = !!expanded[r.id];
    var cname = (r.client && r.client.name) || "Unknown client";
    var nFiles = (r.attachments || []).length;
    var opts = STATUSES.map(function (s) {
      return '<option value="' + s.key + '"' + (s.key === st ? " selected" : "") + '>' + s.label + '</option>';
    }).join("");
    var body =
      (r.details ? '<div class="req-details">' + esc(r.details) + '</div>' : '') +
      attachmentsHtml(r.attachments) +
      commentsHtml(r) +
      '<div class="reply">' +
        '<textarea data-f="reply" rows="2" placeholder="Reply to ' + esc((r.client && r.client.name ? r.client.name.split(" ")[0] : "client")) + '…"></textarea>' +
        '<button class="btn btn-ghost btn-sm" data-act="reply">Send reply</button>' +
      '</div>' +
      '<div class="admin-edit">' +
        '<label class="ae-field"><span class="field-label">Move to</span>' +
          '<select data-f="status">' + opts + '</select>' +
          '<span class="save-msg mono"></span></label>' +
        '<label class="ae-field"><span class="field-label">Review link (the client sees this + your note)</span>' +
          '<input type="url" data-f="review_url" placeholder="https://…" value="' + esc(r.review_url || "") + '"></label>' +
        '<label class="ae-field"><span class="field-label">Note to client</span>' +
          '<textarea data-f="review_note" rows="2" placeholder="What changed / what to look at">' + esc(r.review_note || "") + '</textarea></label>' +
        '<button class="btn btn-sm" data-act="save">Save link &amp; note</button>' +
        '<span class="save-msg2 mono"></span>' +
      '</div>';
    return '<div class="ticket' + (open ? " open" : "") + (needsReply(r) ? " ticket-flag" : "") + '" data-id="' + esc(r.id) + '">' +
      '<button class="ticket-row" type="button">' +
        '<span class="t-main">' +
          '<span class="t-title">' + esc(r.title) +
            (needsReply(r) ? ' <span class="t-flag">new reply</span>' : '') + '</span>' +
          '<span class="t-sub"><strong>' + esc(cname) + '</strong> &middot; ' + esc(r.type || "Request") +
            ' &middot; ' + esc(r.priority || "normal") + ' &middot; ' + fmtDate(r.created_at) +
            (nFiles ? ' &middot; &#128206; ' + nFiles : '') + '</span>' +
        '</span>' +
        '<span class="t-chev">&#9662;</span>' +
      '</button>' +
      '<div class="ticket-body">' + body + '</div>' +
    '</div>';
  }

  function findReq(id) { for (var i = 0; i < requests.length; i++) if (requests[i].id === id) return requests[i]; return null; }

  /* ----- open/close + status change + save + reply ----- */
  document.addEventListener("change", function (e) {
    if (e.target.id === "fClient") { filterClient = e.target.value; render(); return; }
    if (e.target.getAttribute && e.target.getAttribute("data-f") === "status") {
      var card = e.target.closest(".ticket");
      if (!card) return;
      var id = card.getAttribute("data-id");
      var newStatus = e.target.value;
      var msg = card.querySelector(".save-msg");
      if (msg) msg.textContent = "Saving…";
      sb.from("requests").update({ status: newStatus }).eq("id", id).then(function (res) {
        if (res.error) { if (msg) msg.textContent = res.error.message; return; }
        var req = findReq(id); if (req) req.status = newStatus;
        render();
      });
    }
  });

  document.addEventListener("click", function (e) {
    // open/close a ticket (ignore clicks that land on a control inside the row, though there are none)
    var row = e.target.closest && e.target.closest(".ticket-row");
    if (row) {
      var tk = row.closest(".ticket");
      var tid = tk.getAttribute("data-id");
      if (tk.classList.contains("open")) { tk.classList.remove("open"); delete expanded[tid]; }
      else { tk.classList.add("open"); expanded[tid] = true; }
      return;
    }

    var btn = e.target.closest && e.target.closest("[data-act]");
    if (!btn) return;
    var card = btn.closest(".ticket");
    if (!card) return;
    var id = card.getAttribute("data-id");
    var act = btn.getAttribute("data-act");

    if (act === "save") {
      var payload = {
        review_url: card.querySelector('[data-f="review_url"]').value.trim() || null,
        review_note: card.querySelector('[data-f="review_note"]').value.trim() || null
      };
      var msg2 = card.querySelector(".save-msg2");
      btn.disabled = true; btn.textContent = "Saving…";
      sb.from("requests").update(payload).eq("id", id).then(function (res) {
        btn.disabled = false; btn.textContent = "Save link & note";
        if (res.error) { msg2.textContent = res.error.message; return; }
        msg2.textContent = "Saved";
        var req = findReq(id); if (req) { req.review_url = payload.review_url; req.review_note = payload.review_note; }
        setTimeout(function () { msg2.textContent = ""; }, 1500);
      });
    }

    if (act === "reply") {
      var ta = card.querySelector('[data-f="reply"]');
      var bodyTxt = ta.value.trim();
      if (!bodyTxt) return;
      btn.disabled = true; btn.textContent = "Sending…";
      sb.from("comments").insert({ request_id: id, author_email: adminEmail, author_role: "admin", body: bodyTxt })
        .then(function (res) {
          btn.disabled = false; btn.textContent = "Send reply";
          if (res.error) return;
          ta.value = "";
          expanded[id] = true;
          loadAll();
        });
    }
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
