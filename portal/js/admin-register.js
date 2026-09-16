/* admin-register: Register and access
   Who is on the share register, and who can sign in to the portal. The two
   are managed together here but kept apart underneath: a shareholder is a row
   on the register; portal access is a separate sign in with its own password,
   created by the portal-users edge function. Removing someone from the
   register switches their access off; removing access leaves the register
   untouched. */
(function () {
  "use strict";
  var P = window.Portal, A = window.PortalAdmin;

  PortalAuth.requirePortalAdmin().then(function (me) {
    var content = P.Shell("admin-register.html", "Register and access",
      "Shareholders on the register, and who can sign in to the portal.",
      '<button class="btn btn-key btn-sm" type="button" id="addHolder">' + P.svg(P.I.plus, 14) + "Add shareholder</button>",
      me);
    if (!content) return;

    var state = { register: [], loose: [], accounts: [], totals: null, capital: null };
    var TYPES = [{ value: "individual", label: "Individual" }, { value: "entity", label: "Entity" }, { value: "trust", label: "Trust" }];

    content.innerHTML =
      A.banner("Portal passwords are separate from admin panel passwords. Giving someone access creates " +
        "a portal sign in with the password you choose; tell them it directly. Removing a holder from " +
        "the register keeps their history and switches their portal access off, and is refused while " +
        "they still hold shares.") +
      '<div id="r-stats">' + P.loadingStats(4) + "</div>" +
      P.panel({
        title: "Share capital",
        note: "How many shares the company has in total. What is allotted to holders comes out of it, " +
          "and the rest is still to be issued. Every ownership percentage in the portal is worked out " +
          "against this number.",
        actions: '<button class="btn btn-sm" type="button" id="setCapital">Set the company total</button>',
        body: '<div id="r-capital">' + P.loadingLines(3) + "</div>"
      }) +
      P.panel({
        title: "Register",
        note: "Everyone who holds or has held shares, largest holding first.",
        flush: true,
        actions: '<div class="search">' + P.svg(P.I.search, 15) +
          '<input type="search" id="r-q" placeholder="Search" aria-label="Search the register" /></div>',
        body: '<div id="r-list">' + P.loadingLines(5) + "</div>"
      }) +
      P.panel({
        title: "Administrators without a holding",
        note: "Portal administrators who are not themselves on the register, such as a company secretary.",
        flush: true,
        actions: '<button class="btn btn-sm" type="button" id="addAdmin">' + P.svg(P.I.plus, 14) + "Add an administrator</button>",
        body: '<div id="r-loose">' + P.loadingLines(2) + "</div>"
      });

    /* ---- access, in words ------------------------------------------------ */
    function accessTag(role, status) {
      if (!role) return '<span class="muted">No access</span>';
      if (status !== "active") return P.tag("Switched off", "cancelled");
      return role === "admin" ? P.tag("Administrator", "admin") : P.tag("Holder", "live");
    }

    function render() {
      var q = A.val("r-q").toLowerCase();
      var list = state.register.slice().sort(function (a, b) {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        return Number(b.shares) - Number(a.shares);
      }).filter(function (h) {
        return !q || [h.full_name, h.investor_ref, h.user_email, h.country].join(" ").toLowerCase().indexOf(q) > -1;
      });

      var active = state.register.filter(function (h) { return h.status === "active"; });
      var issued = active.reduce(function (n, h) { return n + Number(h.shares); }, 0);
      var withAccess = state.accounts.filter(function (a) { return a.status === "active"; });
      var admins = withAccess.filter(function (a) { return a.role === "admin"; });
      document.getElementById("r-stats").innerHTML = '<div class="stats">' +
        P.statCard("Active holders", String(active.length), state.register.length - active.length
          ? (state.register.length - active.length) + " no longer active" : "Everyone on the register") +
        P.statCard("Shares in issue", P.shares(issued),
          state.totals && Number(state.totals.company_total) > 0
            ? P.shares(state.totals.unallocated) + " of " + P.shares(state.totals.company_total) + " not yet issued"
            : "Across every class") +
        P.statCard("Can sign in", String(withAccess.length), "Portal accounts switched on") +
        P.statCard("Administrators", String(admins.length), admins.length === 1 ? "Add a second so access is never lost" : "Can run the register") +
      "</div>";

      var box = document.getElementById("r-list");
      if (!state.register.length) {
        box.innerHTML = P.empty("Nobody on the register", "Add the first shareholder to start the register.");
      } else if (!list.length) {
        box.innerHTML = P.empty("Nothing matches", "No shareholder matches that search.");
      } else {
        box.innerHTML = P.table(["Holder", "Shares", "Ownership", "Standing", "Portal access", ""],
          list.map(function (h) {
            return '<tr' + (h.status !== "active" ? ' class="is-off"' : "") + ">" +
              "<td><b>" + P.escapeHtml(h.full_name) + "</b>" +
                '<div class="row-note">' + P.escapeHtml(h.investor_ref) + " · " + P.escapeHtml(h.user_email) + "</div></td>" +
              '<td class="money">' + P.shares(h.shares) + "</td>" +
              '<td class="money">' + (h.status === "active" ? P.pct(h.ownership_pct) : '<span class="muted">·</span>') + "</td>" +
              "<td>" + P.stateTag(h.status) + "</td>" +
              "<td>" + accessTag(h.account_role, h.account_status) +
                (h.last_sign_in_at ? '<div class="row-note">Last in ' + P.date(h.last_sign_in_at) + "</div>" : "") + "</td>" +
              '<td><div class="row-actions" style="justify-content:flex-end">' +
                '<button class="btn btn-sm" type="button" data-edit="' + h.id + '">Edit</button>' +
                '<button class="btn btn-sm" type="button" data-access="' + h.id + '">Access</button>' +
                (h.status === "active"
                  ? '<button class="btn btn-sm btn-danger" type="button" data-exit="' + h.id + '">Remove</button>'
                  : '<button class="btn btn-sm" type="button" data-back="' + h.id + '">Reinstate</button>') +
              "</div></td>" +
            "</tr>";
          }).join(""));
      }

      var loose = document.getElementById("r-loose");
      loose.innerHTML = !state.loose.length
        ? P.empty("None", "Every portal administrator is also on the register.")
        : P.table(["Administrator", "Access", "Last signed in", ""],
            state.loose.map(function (a) {
              return "<tr>" +
                "<td><b>" + P.escapeHtml(a.full_name || a.email) + "</b>" +
                  '<div class="row-note">' + P.escapeHtml(a.email) + (a.id === me.account_id ? "  (you)" : "") + "</div></td>" +
                "<td>" + accessTag(a.role, a.status) + "</td>" +
                '<td class="num">' + (a.last_sign_in_at ? P.dateTime(a.last_sign_in_at) : "Never") + "</td>" +
                '<td><div class="row-actions" style="justify-content:flex-end">' +
                  '<button class="btn btn-sm" type="button" data-loose="' + a.id + '">Access</button>' +
                "</div></td>" +
              "</tr>";
            }).join(""));
    }

    document.getElementById("r-q").addEventListener("input", render);

    function holder(id) { return state.register.filter(function (h) { return h.id === id; })[0]; }

    /* ---- passwords are asked for twice, and never shown ------------------ */
    function askPassword(title, note) {
      return P.modal({
        title: title, note: note, confirm: "Save",
        fields: [
          { name: "pw1", label: "Portal password", type: "password", autocomplete: "new-password",
            hint: "At least ten characters. Tell them directly, not by email." },
          { name: "pw2", label: "Portal password again", type: "password", autocomplete: "new-password" }
        ],
        validate: function (f) {
          if ((f.pw1 || "").length < 10) return "Use at least ten characters.";
          if (f.pw1 !== f.pw2) return "Those two passwords do not match.";
          return null;
        }
      }).then(function (f) { return f ? f.pw1 : null; });
    }

    function done(r, message) {
      if (r.error) { P.toast(r.error, true); return false; }
      P.toast(message);
      load();
      return true;
    }

    /* ---- what can be done about one person's access ----------------------- */
    function manageAccess(target) {
      // target: { account_id, role, status, email, name, shareholder_id, isSelf }
      if (!target.account_id) {
        return P.modal({
          title: "Give " + target.name + " portal access",
          note: "Creates a portal sign in for " + target.email + ", separate from any admin panel account.",
          confirm: "Continue",
          fields: [{ name: "role", label: "Access as", value: "holder",
            options: [{ value: "holder", label: "Holder: sees their own position" },
                      { value: "admin", label: "Administrator: also runs the register" }] }]
        }).then(function (f) {
          if (!f) return;
          return askPassword("Choose " + target.name + "'s portal password", "").then(function (pw) {
            if (!pw) return;
            return P.fn("create", {
              email: target.email, password: pw, full_name: target.name,
              role: f.role, shareholder_id: target.shareholder_id
            }).then(function (r) {
              done(r, target.name + " can now sign in to the portal" + (f.role === "admin" ? " as an administrator." : "."));
            });
          });
        });
      }

      var choices = [{ value: "password", label: "Set a new password" }];
      if (target.status === "active") {
        if (!target.isSelf) choices.push({ value: "off", label: "Switch their access off" });
        if (target.role === "admin" && target.shareholder_id) choices.push({ value: "holder", label: "Make them a holder, not an administrator" });
        if (target.role !== "admin") choices.push({ value: "admin", label: "Make them an administrator" });
      } else {
        choices.push({ value: "on", label: "Switch their access back on" });
      }
      if (!target.isSelf) choices.push({ value: "delete", label: "Remove their portal access entirely" });

      return P.modal({
        title: target.name + "'s portal access",
        note: target.email + ". Currently " + (target.status !== "active" ? "switched off" : target.role === "admin" ? "an administrator" : "a holder") + ".",
        confirm: "Continue",
        fields: [{ name: "act", label: "What would you like to do?", value: choices[0].value, options: choices }]
      }).then(function (f) {
        if (!f) return;
        if (f.act === "password") {
          return askPassword("New portal password for " + target.name,
            "Their current password stops working straight away.").then(function (pw) {
            if (!pw) return;
            return P.fn("set-password", { account_id: target.account_id, password: pw })
              .then(function (r) { done(r, "Password changed. Tell " + target.name + " the new one directly."); });
          });
        }
        if (f.act === "off" || f.act === "on") {
          var off = f.act === "off";
          return A.confirm(off ? "Switch access off" : "Switch access on",
            off ? "Stop <b>" + P.escapeHtml(target.name) + "</b> signing in to the portal? Any session they have open ends within the hour. Their register record is not changed."
                : "Let <b>" + P.escapeHtml(target.name) + "</b> sign in to the portal again with their existing password?",
            off ? "Switch it off" : "Switch it on"
          ).then(function (yes) {
            if (!yes) return;
            return P.fn("set-status", { account_id: target.account_id, status: off ? "disabled" : "active" })
              .then(function (r) { done(r, off ? "Access switched off." : "Access switched back on."); });
          });
        }
        if (f.act === "admin" || f.act === "holder") {
          var up = f.act === "admin";
          return A.confirm(up ? "Make an administrator" : "Remove administrator rights",
            up ? "Let <b>" + P.escapeHtml(target.name) + "</b> set the share price, change the register, declare dividends and give other people access?"
               : "<b>" + P.escapeHtml(target.name) + "</b> keeps their own portal access as a holder, and can no longer change anything.",
            up ? "Make administrator" : "Make holder"
          ).then(function (yes) {
            if (!yes) return;
            return P.fn("set-role", { account_id: target.account_id, role: f.act })
              .then(function (r) { done(r, up ? target.name + " is now an administrator." : target.name + " is now a holder."); });
          });
        }
        if (f.act === "delete") {
          return A.confirm("Remove portal access",
            "Delete <b>" + P.escapeHtml(target.name) + "</b>'s portal sign in? They can no longer sign in, and giving access again means choosing a new password. Their register record and history are not touched.",
            "Remove access"
          ).then(function (yes) {
            if (!yes) return;
            return P.fn("delete", { account_id: target.account_id })
              .then(function (r) { done(r, "Portal access removed."); });
          });
        }
      });
    }

    // the add button lives in the top bar, outside the content area
    document.getElementById("addHolder").addEventListener("click", function () { addHolder(); });

    /* ---- the company's total ---------------------------------------------- */
    function renderCapital() {
      var t = state.totals || {}, cap = state.capital || {};
      var total = Number(t.company_total) || 0;
      var allotted = Number(t.total_shares) || 0;
      document.getElementById("r-capital").innerHTML = total > 0
        ? P.kv([
            ["Shares in the company", P.shares(total)],
            ["Allotted to holders", P.shares(allotted) + P.bar(100 * allotted / total, true)],
            ["Still to be issued", P.shares(t.unallocated)],
            ["Note", cap.note ? P.escapeHtml(cap.note) : "·"],
            ["Last changed", cap.updated_at ? P.dateTime(cap.updated_at) : "·"]
          ])
        : P.empty("No company total set",
            "Percentages are being worked out against the " + P.shares(allotted) +
            " shares allotted to holders. Set the company total to count the shares not yet issued as well.");
    }

    document.getElementById("setCapital").addEventListener("click", function () {
      var t = state.totals || {}, cap = state.capital || {};
      var allotted = Number(t.total_shares) || 0;
      P.modal({
        title: "Set the company total",
        note: "Every ownership percentage in the portal is worked out against this number, and the " +
          "company valuation is the share price times it.",
        confirm: "Save",
        fields: [
          { name: "total", label: "Shares the company has in total", type: "number",
            value: Number(t.company_total) > 0 ? Number(t.company_total) : "",
            hint: P.shares(allotted) + " are allotted to holders at the moment. Leave it empty to go " +
                  "back to counting only what is allotted." },
          { name: "note", label: "Note", value: cap.note || "",
            hint: "For example the resolution that set it." }
        ],
        validate: function (f) {
          var n = String(f.total).trim() === "" ? 0 : Number(f.total);
          if (!isFinite(n) || n < 0 || n % 1) return "Enter a whole number of shares, or leave it empty.";
          if (n > 0 && n < allotted) {
            return "There are already " + P.shares(allotted) + " shares allotted to holders, so the " +
                   "company total cannot be less than that.";
          }
          return null;
        }
      }).then(function (f) {
        if (!f) return;
        var n = String(f.total).trim() === "" ? 0 : Number(f.total);
        A.confirm("Set the company total",
          n === 0
            ? "Stop stating a company total? Percentages go back to being worked out against the " +
              P.shares(allotted) + " shares allotted to holders."
            : "The company has <b>" + P.shares(n) + "</b> shares, <b>" + P.shares(n - allotted) +
              "</b> of them not yet issued? Every holder's ownership percentage is worked out again " +
              "straight away, and the company valuation becomes the share price times " + P.shares(n) + ".",
          "Save"
        ).then(function (yes) {
          if (!yes) return;
          PortalAuth.client().from("share_capital")
            .update({ total_shares: n, note: f.note.trim() }).eq("id", true)
            .then(function (r) {
              if (r.error) { P.toast(r.error.message, true); return; }
              P.toast(n === 0 ? "The company total is no longer stated."
                              : "The company now has " + P.shares(n) + " shares.");
              load();
            });
        });
      });
    });

    content.addEventListener("click", function (e) {
      if (e.target.closest("#addAdmin")) { addAdmin(); return; }

      var acc = e.target.closest("[data-access]");
      if (acc) {
        var h = holder(acc.getAttribute("data-access"));
        if (!h) return;
        if (h.status !== "active" && !h.account_id) {
          P.toast(h.full_name + " is no longer active on the register. Reinstate them before giving access.", true);
          return;
        }
        manageAccess({ account_id: h.account_id, role: h.account_role, status: h.account_status,
          email: h.user_email, name: h.full_name, shareholder_id: h.id, isSelf: h.account_id === me.account_id });
        return;
      }

      var lo = e.target.closest("[data-loose]");
      if (lo) {
        var a = state.loose.filter(function (x) { return x.id === lo.getAttribute("data-loose"); })[0];
        if (!a) return;
        manageAccess({ account_id: a.id, role: a.role, status: a.status, email: a.email,
          name: a.full_name || a.email, shareholder_id: null, isSelf: a.id === me.account_id });
        return;
      }

      var ed = e.target.closest("[data-edit]");
      if (ed) { editHolder(holder(ed.getAttribute("data-edit"))); return; }

      var ex = e.target.closest("[data-exit]");
      if (ex) {
        var x = holder(ex.getAttribute("data-exit"));
        if (!x) return;
        A.confirm("Remove " + x.full_name + " from the register",
          Number(x.shares) > 0
            ? "<b>" + P.escapeHtml(x.full_name) + "</b> still holds " + P.shares(x.shares) + " shares, so this will be refused. Transfer their shares to another holder first, under Share movements."
            : "Mark <b>" + P.escapeHtml(x.full_name) + "</b> as exited? Their history stays on the register, they leave the shareholder directory, and their portal access is switched off.",
          Number(x.shares) > 0 ? "Try anyway" : "Remove them"
        ).then(function (yes) {
          if (!yes) return;
          PortalAuth.client().from("shareholders").update({ status: "exited" }).eq("id", x.id).then(function (r) {
            if (r.error) { P.toast(r.error.message, true); return; }
            P.toast(x.full_name + " has been removed from the register and can no longer sign in.");
            load();
          });
        });
        return;
      }

      var bk = e.target.closest("[data-back]");
      if (bk) {
        var y = holder(bk.getAttribute("data-back"));
        if (!y) return;
        A.confirm("Reinstate " + y.full_name,
          "Put <b>" + P.escapeHtml(y.full_name) + "</b> back on the register as active? Their portal access stays off until you switch it back on.",
          "Reinstate"
        ).then(function (yes) {
          if (!yes) return;
          PortalAuth.client().from("shareholders").update({ status: "active" }).eq("id", y.id).then(function (r) {
            if (r.error) { P.toast(r.error.message, true); return; }
            P.toast(y.full_name + " is active on the register again.");
            load();
          });
        });
      }
    });

    /* ---- adding people ---------------------------------------------------- */
    function addHolder() {
      P.modal({
        title: "Add a shareholder",
        note: "Their investor reference is given automatically. Record their shares under Share movements.",
        confirm: "Add to the register",
        fields: [
          { name: "full_name", label: "Full name or entity name" },
          { name: "email", label: "Email", type: "email" },
          { name: "holder_type", label: "Type", value: "individual", options: TYPES },
          { name: "country", label: "Country", value: "Bangladesh" },
          { name: "joined_on", label: "On the register from", type: "date", value: A.today() },
          { name: "listed", label: "Name in the shareholder directory", value: "yes",
            options: [{ value: "yes", label: "Shown to other holders" }, { value: "no", label: "Withheld" }] },
          { name: "access", label: "Portal access", value: "holder",
            options: [{ value: "none", label: "Not yet" }, { value: "holder", label: "Holder" }, { value: "admin", label: "Administrator" }] },
          { name: "pw1", label: "Portal password", type: "password", autocomplete: "new-password",
            hint: "Only if giving access now. At least ten characters." }
        ],
        validate: function (f) {
          if (!f.full_name.trim()) return "Enter their name.";
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return "That does not look like an email address.";
          if (f.access !== "none" && (f.pw1 || "").length < 10) return "Choose a portal password of at least ten characters, or choose Not yet.";
          if (state.register.some(function (h) { return h.user_email === f.email.trim().toLowerCase(); })) return "Someone on the register already has that address.";
          return null;
        }
      }).then(function (f) {
        if (!f) return;
        PortalAuth.client().from("shareholders").insert({
          full_name: f.full_name.trim(), user_email: f.email.trim().toLowerCase(),
          holder_type: f.holder_type, country: f.country.trim(),
          joined_on: f.joined_on || A.today(), directory_opt_in: f.listed === "yes"
        }).select("id,investor_ref").single().then(function (r) {
          if (r.error) { P.toast(r.error.message, true); return; }
          if (f.access === "none") {
            P.toast(f.full_name.trim() + " added as " + r.data.investor_ref + ".");
            load();
            return;
          }
          P.fn("create", {
            email: f.email.trim().toLowerCase(), password: f.pw1, full_name: f.full_name.trim(),
            role: f.access, shareholder_id: r.data.id
          }).then(function (res) {
            if (res.error) {
              P.toast(f.full_name.trim() + " was added as " + r.data.investor_ref + ", but portal access was not: " + res.error, true);
            } else {
              P.toast(f.full_name.trim() + " added as " + r.data.investor_ref + " and can sign in to the portal.");
            }
            load();
          });
        });
      });
    }

    function addAdmin() {
      P.modal({
        title: "Add a portal administrator",
        note: "For someone who runs the register but holds no shares. If their address is on the register, the account is linked to their holding.",
        confirm: "Add administrator",
        fields: [
          { name: "full_name", label: "Name" },
          { name: "email", label: "Email", type: "email" },
          { name: "pw1", label: "Portal password", type: "password", autocomplete: "new-password", hint: "At least ten characters." },
          { name: "pw2", label: "Portal password again", type: "password", autocomplete: "new-password" }
        ],
        validate: function (f) {
          if (!f.full_name.trim()) return "Enter their name.";
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return "That does not look like an email address.";
          if ((f.pw1 || "").length < 10) return "Use at least ten characters.";
          if (f.pw1 !== f.pw2) return "Those two passwords do not match.";
          return null;
        }
      }).then(function (f) {
        if (!f) return;
        P.fn("create", { email: f.email.trim().toLowerCase(), password: f.pw1, full_name: f.full_name.trim(), role: "admin" })
          .then(function (r) { done(r, f.full_name.trim() + " is now a portal administrator."); });
      });
    }

    function editHolder(h) {
      if (!h) return;
      P.modal({
        title: "Edit " + h.full_name,
        note: h.investor_ref + ". Shares are changed under Share movements, not here.",
        confirm: "Save",
        fields: [
          { name: "full_name", label: "Full name or entity name", value: h.full_name },
          { name: "email", label: "Email", type: "email", value: h.user_email,
            hint: h.account_id ? "Their portal sign in keeps working with the address it was created with." : "" },
          { name: "holder_type", label: "Type", value: h.holder_type, options: TYPES },
          { name: "country", label: "Country", value: h.country },
          { name: "phone", label: "Phone", value: h.phone },
          { name: "address", label: "Address", value: h.address, multiline: true, rows: 2 },
          { name: "listed", label: "Name in the shareholder directory", value: h.directory_opt_in ? "yes" : "no",
            options: [{ value: "yes", label: "Shown to other holders" }, { value: "no", label: "Withheld" }] }
        ],
        validate: function (f) {
          if (!f.full_name.trim()) return "Enter their name.";
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return "That does not look like an email address.";
          return null;
        }
      }).then(function (f) {
        if (!f) return;
        PortalAuth.client().from("shareholders").update({
          full_name: f.full_name.trim(), user_email: f.email.trim().toLowerCase(), holder_type: f.holder_type,
          country: f.country.trim(), phone: f.phone.trim(), address: f.address.trim(),
          directory_opt_in: f.listed === "yes"
        }).eq("id", h.id).then(function (r) {
          if (r.error) { P.toast(r.error.message, true); return; }
          P.toast("Saved.");
          load();
        });
      });
    }

    function load() {
      return Promise.all([
        A.register(),
        PortalAuth.client().from("portal_accounts")
          .select("id,email,full_name,role,status,shareholder_id,last_sign_in_at")
          .order("created_at").then(function (r) { return r; }),
        A.totals(),
        PortalAuth.client().from("share_capital").select("*").maybeSingle()
          .then(function (r) { return r; })
      ]).then(function (res) {
        if (res[0].error) { document.getElementById("r-list").innerHTML = P.failed(res[0].error); return; }
        state.register = res[0].data || [];
        state.accounts = res[1].error ? [] : (res[1].data || []);
        state.loose = state.accounts.filter(function (a) { return !a.shareholder_id; });
        state.totals = res[2].error ? null : res[2].data;
        state.capital = res[3].error ? null : res[3].data;
        render();
        renderCapital();
      });
    }

    load();
  });
})();
