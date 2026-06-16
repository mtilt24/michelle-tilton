/* Raeve Marketing — client portal logic.
 * Shared across login.html, reset.html and index.html (the dashboard).
 * Each page only runs the code for the elements it actually contains.
 */
(function () {
  var cfg = window.RAEVE_PORTAL || {};
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf("YOUR-PROJECT") === 0) {
    console.warn("Portal not configured yet — edit portal/config.js with your Supabase keys.");
  }
  var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  function $(id) { return document.getElementById(id); }
  function show(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = "msg show " + (type || "error");
  }
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

  /* ============================ LOGIN ============================ */
  var loginForm = $("loginForm");
  if (loginForm) {
    var loginMsg = $("loginMsg");

    // Already signed in? Go straight to the dashboard.
    sb.auth.getSession().then(function (res) {
      if (res.data.session) window.location.replace("/portal");
    });

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      hide(loginMsg);
      var btn = $("loginBtn");
      btn.disabled = true; btn.textContent = "Signing in…";
      sb.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value
      }).then(function (res) {
        if (res.error) {
          show(loginMsg, res.error.message || "Could not sign in.", "error");
          btn.disabled = false; btn.textContent = "Sign in";
        } else {
          window.location.replace("/portal");
        }
      });
    });

    var forgot = $("forgotLink");
    if (forgot) {
      forgot.addEventListener("click", function (e) {
        e.preventDefault();
        var email = $("email").value.trim();
        if (!email) { show(loginMsg, "Enter your email above first, then click reset.", "error"); return; }
        sb.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/portal/reset"
        }).then(function (res) {
          if (res.error) show(loginMsg, res.error.message, "error");
          else show(loginMsg, "Check your email for a reset link.", "success");
        });
      });
    }
  }

  /* ========================== RESET PW ========================== */
  var resetForm = $("resetForm");
  if (resetForm) {
    var resetMsg = $("resetMsg");

    // First-login forced reset: friendlier subtitle so it doesn't feel like an error.
    if (/[?&]first=1/.test(window.location.search)) {
      var sub = document.querySelector(".sub");
      if (sub) sub.textContent = "Welcome — set your own password to finish setting up your account.";
    }

    resetForm.addEventListener("submit", function (e) {
      e.preventDefault();
      hide(resetMsg);
      var pw = $("newPassword").value;
      if (pw.length < 8) { show(resetMsg, "Use at least 8 characters.", "error"); return; }
      var btn = $("resetBtn");
      btn.disabled = true; btn.textContent = "Saving…";
      sb.auth.updateUser({ password: pw }).then(function (res) {
        if (res.error) {
          show(resetMsg, res.error.message, "error");
          btn.disabled = false; btn.textContent = "Set new password";
        } else {
          // Clear the first-login flag (best effort; RLS limits it to their own row).
          sb.auth.getSession().then(function (s) {
            var uid = s.data.session && s.data.session.user && s.data.session.user.id;
            var done = function () {
              show(resetMsg, "Password updated. Redirecting…", "success");
              setTimeout(function () { window.location.replace("/portal"); }, 1200);
            };
            if (uid) sb.from("clients").update({ must_reset: false }).eq("user_id", uid).then(done);
            else done();
          });
        }
      });
    });
  }

  /* ========================= DASHBOARD ========================= */
  var dash = $("dash");
  if (dash) {
    var client = null;
    var userEmail = "";
    var isAdmin = false;

    sb.auth.getSession().then(function (res) {
      if (!res.data.session) { window.location.replace("/portal/login"); return; }
      userEmail = (res.data.session.user && res.data.session.user.email || "").toLowerCase();
      isAdmin = cfg.ADMIN_EMAIL && userEmail === String(cfg.ADMIN_EMAIL).toLowerCase();
      // Admin's home is the dashboard, not the client view — send them there.
      if (isAdmin) { window.location.replace("/portal/admin"); return; }
      loadClient();
    });

    var signOut = $("signOutBtn");
    if (signOut) signOut.addEventListener("click", function () {
      // Always leave for the login page, even if signOut errors on a stale session.
      function done() { window.location.replace("/portal/login"); }
      sb.auth.signOut().then(done, done);
    });

    function loadClient() {
      sb.from("clients").select("*").single().then(function (res) {
        if (res.error || !res.data) {
          if (isAdmin) {
            $("welcome").innerHTML = "Raeve <span class=\"accent\">admin.</span>";
            $("welcomeNote").innerHTML = "You're signed in as admin. <a class=\"muted-link\" href=\"/portal/admin\">Add a client &rarr;</a>";
          } else {
            $("welcome").textContent = "Welcome";
            $("welcomeNote").textContent = "Your account isn't fully set up yet. Email michelle@raevemarketing.com.";
          }
          return;
        }
        client = res.data;
        // First login on a temp password: send them to set their own first.
        if (client.must_reset) { window.location.replace("/portal/reset?first=1"); return; }
        $("welcome").innerHTML = "Welcome, <span class=\"accent\">" + esc((client.name || "").split(" ")[0] || client.name) + ".</span>";
        $("welcomeNote").textContent = client.company ? client.company : "";
        loadRequests();
      });
    }

    // Client-facing status groups, shown in this order (actionable first).
    var CLIENT_STATUSES = [
      { key: "review",      label: "Ready for your review" },
      { key: "in_progress", label: "In progress" },
      { key: "new",         label: "Submitted" },
      { key: "done",        label: "Complete" }
    ];
    function statusLabel(s) {
      for (var i = 0; i < CLIENT_STATUSES.length; i++) if (CLIENT_STATUSES[i].key === s) return CLIENT_STATUSES[i].label;
      return (s || "new").replace("_", " ");
    }

    var BUCKET = "request-files";
    var expanded = {};   // request id -> true when the client has opened that ticket

    function threadHtml(r) {
      var comments = (r.comments || []).slice().sort(function (a, b) {
        return new Date(a.created_at) - new Date(b.created_at);
      });
      var bubbles = comments.map(function (c) {
        var mine = c.author_role === "client";
        return '<div class="bubble ' + (mine ? "bubble-me" : "bubble-them") + '">' +
          '<div class="bubble-who">' + (mine ? "You" : "Michelle") + ' &middot; ' + fmtDate(c.created_at) + '</div>' +
          '<div class="bubble-body">' + esc(c.body) + '</div>' +
        '</div>';
      }).join("");
      return (bubbles ? '<div class="thread">' + bubbles + '</div>' : "") +
        '<div class="reply">' +
          '<textarea data-reply-input="' + esc(r.id) + '" rows="2" placeholder="Add a note for Michelle…"></textarea>' +
          '<button class="btn btn-ghost btn-sm" data-reply="' + esc(r.id) + '">Send</button>' +
        '</div>';
    }

    function attachmentsHtml(files) {
      if (!files || !files.length) return "";
      return '<div class="attach">' + files.map(function (f) {
        var isImg = (f.content_type || "").indexOf("image/") === 0;
        if (isImg && f.signedUrl) {
          return '<a class="att-img" href="' + esc(f.signedUrl) + '" target="_blank" rel="noopener">' +
            '<img src="' + esc(f.signedUrl) + '" alt="' + esc(f.name || "image") + '" loading="lazy"></a>';
        }
        return '<a class="att-file" href="' + esc(f.signedUrl || "#") + '" target="_blank" rel="noopener">' +
          '&#128206; ' + esc(f.name || "file") + '</a>';
      }).join("") + '</div>';
    }

    function reqCard(r) {
      var st = (r.status || "new");
      var open = expanded[r.id] || st === "review";   // review items auto-open (they need action)
      var update = "";
      if (r.review_note || r.review_url || st === "review") {
        update = '<div class="review-box">' +
          '<div class="mono">' + (st === "review" ? "Ready for your review" : "Update from Michelle") + '</div>' +
          (r.review_note ? '<p class="review-note">' + esc(r.review_note) + '</p>' : '') +
          (r.review_url ? '<a class="review-link" href="' + esc(r.review_url) + '" target="_blank" rel="noopener">See what changed &rarr;</a>' : '') +
          (st === "review" ?
            '<div class="review-actions">' +
              '<button class="btn btn-sm" data-approve="' + esc(r.id) + '">Approve</button>' +
              '<button class="btn btn-ghost btn-sm" data-changes="' + esc(r.id) + '">Request changes</button>' +
            '</div>' : '') +
        '</div>';
      }
      var nFiles = (r.attachments || []).length;
      var body =
        (r.details ? '<div class="req-details">' + esc(r.details) + '</div>' : '') +
        attachmentsHtml(r.attachments) +
        update +
        threadHtml(r);
      return '<div class="ticket' + (open ? " open" : "") + '" data-id="' + esc(r.id) + '">' +
        '<button class="ticket-row" type="button">' +
          '<span class="t-main">' +
            '<span class="t-title">' + esc(r.title) +
              (st === "review" ? ' <span class="t-flag">action needed</span>' : '') + '</span>' +
            '<span class="t-sub">' + esc(r.type || "Request") + ' &middot; ' + fmtDate(r.created_at) +
              (nFiles ? ' &middot; &#128206; ' + nFiles : '') + '</span>' +
          '</span>' +
          '<span class="t-chev">&#9662;</span>' +
        '</button>' +
        '<div class="ticket-body">' + body + '</div>' +
      '</div>';
    }

    function renderGroups(rows, list) {
      list.innerHTML = CLIENT_STATUSES.map(function (g) {
        var inGroup = rows.filter(function (r) { return (r.status || "new") === g.key; });
        if (!inGroup.length) return "";
        return '<div class="status-group">' +
          '<h3 class="group-title">' + esc(g.label) + ' <span class="group-count">' + inGroup.length + '</span></h3>' +
          inGroup.map(reqCard).join("") +
        '</div>';
      }).join("");
    }

    function loadRequests() {
      var list = $("reqList");
      sb.from("requests").select("*, comments(*), attachments(*)").order("created_at", { ascending: false }).then(function (res) {
        if (res.error) { list.innerHTML = '<p class="empty">Could not load requests.</p>'; return; }
        var rows = res.data || [];
        if (!rows.length) { list.innerHTML = '<p class="empty">No requests yet. Submit your first one.</p>'; return; }
        // Sign every attachment URL in one batch, then render.
        var paths = [];
        rows.forEach(function (r) { (r.attachments || []).forEach(function (f) { paths.push(f.path); }); });
        if (!paths.length) { renderGroups(rows, list); return; }
        sb.storage.from(BUCKET).createSignedUrls(paths, 3600).then(function (sres) {
          var map = {};
          (sres.data || []).forEach(function (s) { if (s && s.path) map[s.path] = s.signedUrl; });
          rows.forEach(function (r) { (r.attachments || []).forEach(function (f) { f.signedUrl = map[f.path]; }); });
          renderGroups(rows, list);
        });
      });
    }

    // Expand/collapse, Approve, Request changes, Reply (delegated on the list)
    var reqListEl = $("reqList");
    if (reqListEl) reqListEl.addEventListener("click", function (e) {
      var t = e.target;

      // open/close a ticket
      var row = t.closest && t.closest(".ticket-row");
      if (row) {
        var ticket = row.closest(".ticket");
        var tid = ticket.getAttribute("data-id");
        if (ticket.classList.contains("open")) { ticket.classList.remove("open"); delete expanded[tid]; }
        else { ticket.classList.add("open"); expanded[tid] = true; }
        return;
      }

      if (!t.getAttribute) return;

      var replyId = t.getAttribute("data-reply");
      if (replyId) {
        var ta = reqListEl.querySelector('[data-reply-input="' + replyId + '"]');
        var body = ta && ta.value.trim();
        if (!body) return;
        t.disabled = true; t.textContent = "…";
        sb.from("comments").insert({
          request_id: replyId,
          author_email: userEmail,
          author_role: "client",
          body: body
        }).then(function (res) {
          if (res.error) { t.disabled = false; t.textContent = "Send"; return; }
          expanded[replyId] = true;
          loadRequests();
        });
        return;
      }

      var approveId = t.getAttribute("data-approve");
      var changesId = t.getAttribute("data-changes");
      var id = approveId || changesId;
      if (!id) return;
      var newStatus = approveId ? "done" : "in_progress";
      t.disabled = true; t.textContent = "…";
      sb.from("requests").update({ status: newStatus }).eq("id", id).then(function (res) {
        if (res.error) { t.disabled = false; t.textContent = approveId ? "Approve" : "Request changes"; return; }
        loadRequests();
      });
    });

    // show chosen file names under the file input
    var rFiles = $("rFiles");
    if (rFiles) rFiles.addEventListener("change", function () {
      var names = Array.prototype.slice.call(rFiles.files).map(function (f) { return f.name; }).join(", ");
      if ($("rFileList")) $("rFileList").textContent = names;
    });

    var reqForm = $("reqForm");
    if (reqForm) reqForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var reqMsg = $("reqMsg");
      hide(reqMsg);
      if (!client) { show(reqMsg, "Account still loading, try again in a moment.", "error"); return; }
      var btn = $("reqBtn");
      btn.disabled = true; btn.textContent = "Sending…";
      var files = (rFiles && rFiles.files) ? Array.prototype.slice.call(rFiles.files) : [];

      sb.from("requests").insert({
        client_id: client.id,
        title: $("rTitle").value.trim(),
        type: $("rType").value,
        priority: $("rPriority").value,
        details: $("rDetails").value.trim()
      }).select().single().then(function (res) {
        if (res.error || !res.data) {
          btn.disabled = false; btn.textContent = "Submit request";
          show(reqMsg, (res.error && res.error.message) || "Could not submit.", "error"); return;
        }
        var newReq = res.data;

        // Upload any files one at a time, then record each in the attachments table.
        var i = 0;
        function next() {
          if (i >= files.length) { finish(); return; }
          var file = files[i++];
          var clean = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
          var path = client.id + "/" + newReq.id + "/" + Date.now() + "-" + clean;
          sb.storage.from(BUCKET).upload(path, file).then(function (up) {
            if (up.error) { next(); return; }
            sb.from("attachments").insert({
              request_id: newReq.id, client_id: client.id, path: path,
              name: file.name, size: file.size, content_type: file.type || null, uploaded_by: "client"
            }).then(next, next);
          }, next);
        }
        function finish() {
          btn.disabled = false; btn.textContent = "Submit request";
          reqForm.reset();
          if ($("rFileList")) $("rFileList").textContent = "";
          show(reqMsg, "Request submitted. Michelle will be in touch.", "success");
          loadRequests();
        }
        next();
      });
    });

    var billBtn = $("billBtn");
    if (billBtn) billBtn.addEventListener("click", function () {
      var billMsg = $("billMsg");
      hide(billMsg);
      billBtn.disabled = true; billBtn.textContent = "Opening…";
      sb.auth.getSession().then(function (res) {
        var token = res.data.session && res.data.session.access_token;
        return fetch("/api/billing-portal", {
          method: "POST",
          headers: { "Authorization": "Bearer " + token }
        });
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data && data.url) { window.location.href = data.url; }
        else {
          show(billMsg, (data && data.error) || "Billing isn't set up yet. Contact Raeve.", "error");
          billBtn.disabled = false; billBtn.textContent = "View invoices & pay";
        }
      }).catch(function () {
        show(billMsg, "Something went wrong. Try again.", "error");
        billBtn.disabled = false; billBtn.textContent = "View invoices & pay";
      });
    });
  }

  /* The admin dashboard (add client, all requests, replies) lives in admin.js. */
})();
