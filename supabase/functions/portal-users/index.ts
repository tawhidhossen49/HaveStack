// ===========================================================================
//  portal-users
//  Creates and manages shareholder portal sign ins, separately from the admin
//  panel's.
//
//  Why a portal account is its own Supabase Auth user
//  ---------------------------------------------------
//  Supabase Auth holds one user per address, and one password per user. The
//  admin panel already uses the Auth user for a person's real address. To let
//  the same person sign in to the portal with a different password, the
//  portal gives them a second Auth user whose sign in address is derived from
//  the real one: name+hsportal@domain. The person never types or sees it; the
//  portal's sign in page derives it from the address they do type. The two
//  users share nothing, so a password, a session or a reset for one never
//  touches the other.
//
//  Creating a user with a chosen password needs the secret key, which must
//  never reach a browser. So it happens here, and only for a caller who is:
//    - a portal administrator, for everything below, or
//    - an admin panel administrator, for "bootstrap" only, and only while the
//      portal has no administrator at all. That is how the first one is made,
//      and how access is recovered if every portal administrator is removed.
//
//  Deployed with verify_jwt off: the project uses Supabase's new API keys,
//  which the platform's built in JWT check does not understand. The check that
//  matters happens below, where the caller's token is resolved to a user and
//  that user is looked up in portal_accounts or admins.
// ===========================================================================
/// <reference types="https://esm.sh/@supabase/functions-js@2/src/edge-runtime.d.ts" />
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 10;
const FOREVER = "876000h";   // a hundred years: how Supabase spells "banned"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// New projects carry their secret keys as a JSON object keyed by name; older
// ones carry the legacy service role key. Accept either.
function secretKey(): string {
  const many = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (many) {
    try {
      const keys = JSON.parse(many) as Record<string, string>;
      if (keys.default) return keys.default;
      const first = Object.values(keys)[0];
      if (first) return first;
    } catch { /* fall back to the legacy key below */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

// The portal's own sign in address for a real one. Must stay identical to
// portalLoginEmail() in portal/js/portal-auth.js, which derives the same
// address at sign in.
function portalLoginEmail(real: string): string {
  const e = real.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  return e.slice(0, at) + "+hsportal" + e.slice(at);
}

type Account = {
  id: string;
  auth_user_id: string;
  email: string;
  role: string;
  status: string;
  shareholder_id: string | null;
};

type Outcome = { ok?: boolean; error?: string; status?: number; [k: string]: unknown };

async function activeAdminCount(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from("portal_accounts")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("status", "active");
  if (error) throw error;
  return count || 0;
}

// listUsers is paged; walk it rather than assuming the first page holds them.
async function findAuthUser(db: SupabaseClient, address: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === address);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function createAccount(
  db: SupabaseClient,
  input: Record<string, unknown>,
  actor: string,
): Promise<Outcome> {
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const fullName = String(input.full_name || "").trim();
  const role = input.role === "admin" ? "admin" : "holder";
  let shareholderId = input.shareholder_id ? String(input.shareholder_id) : null;

  if (!EMAIL_SHAPE.test(email)) {
    return { error: "That does not look like an email address.", status: 400 };
  }
  if (email.slice(0, email.lastIndexOf("@")).length > 55) {
    return { error: "That address is too long to use for the portal.", status: 400 };
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Use a password of at least ${MIN_PASSWORD} characters.`, status: 400 };
  }

  const { data: existing } = await db
    .from("portal_accounts").select("id").eq("email", email).maybeSingle();
  if (existing) return { error: "That address already has portal access.", status: 409 };

  // Which shareholder this account belongs to. Named explicitly, or found by
  // the address when the register already has somebody at it.
  if (shareholderId) {
    const { data: holder } = await db
      .from("shareholders").select("id,status").eq("id", shareholderId).maybeSingle();
    if (!holder) return { error: "No such shareholder.", status: 404 };
    if (holder.status !== "active") {
      return { error: "That shareholder is not active on the register.", status: 400 };
    }
    const { data: taken } = await db
      .from("portal_accounts").select("id").eq("shareholder_id", shareholderId).maybeSingle();
    if (taken) return { error: "That shareholder already has portal access.", status: 409 };
  } else {
    const { data: holder } = await db
      .from("shareholders").select("id,status").eq("user_email", email).maybeSingle();
    if (holder && holder.status === "active") {
      const { data: taken } = await db
        .from("portal_accounts").select("id").eq("shareholder_id", holder.id).maybeSingle();
      if (!taken) shareholderId = holder.id;
    }
  }
  if (role === "holder" && !shareholderId) {
    return {
      error: "A holder's sign in has to belong to someone on the register. Add them to the register first.",
      status: 400,
    };
  }

  const loginEmail = portalLoginEmail(email);
  let userId: string;
  let madeNewUser = false;

  const created = await db.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,                     // nothing to click; never emailed
    app_metadata: { portal: true },
    user_metadata: { full_name: fullName, portal_email: email },
  });

  if (created.error) {
    // An Auth user left over from an earlier attempt that never got its row.
    // Reclaim it rather than refusing forever.
    const stale = await findAuthUser(db, loginEmail);
    if (!stale) return { error: created.error.message, status: 400 };
    const reset = await db.auth.admin.updateUserById(stale.id, { password, ban_duration: "none" });
    if (reset.error) return { error: reset.error.message, status: 400 };
    userId = stale.id;
  } else {
    userId = created.data.user!.id;
    madeNewUser = true;
  }

  const { data: row, error: rowError } = await db
    .from("portal_accounts")
    .insert({
      auth_user_id: userId,
      email,
      login_email: loginEmail,
      full_name: fullName,
      role,
      shareholder_id: shareholderId,
      created_by: actor,
    })
    .select("id")
    .single();

  if (rowError) {
    // never leave a sign in behind with no account to govern it
    if (madeNewUser) await db.auth.admin.deleteUser(userId);
    return { error: rowError.message, status: 400 };
  }

  return { ok: true, account_id: row.id, email, role, shareholder_id: shareholderId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = secretKey();
  if (!url || !key) return json({ error: "The function is missing its server keys." }, 500);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const action = String(body.action || "");

  try {
    // ---- the only question anyone may ask without signing in ---------------
    // The sign in page uses it to decide whether to offer first time setup.
    if (action === "setup-state") {
      return json({ setup_required: (await activeAdminCount(db)) === 0 });
    }

    // ---- who is asking -------------------------------------------------------
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!bearer) return json({ error: "Not signed in." }, 401);
    const { data: who, error: whoError } = await db.auth.getUser(bearer);
    const caller = who?.user;
    if (whoError || !caller) return json({ error: "Not signed in." }, 401);

    const { data: me } = await db
      .from("portal_accounts")
      .select("id,email,role,status")
      .eq("auth_user_id", caller.id)
      .maybeSingle();
    const isPortalAdmin = !!me && me.role === "admin" && me.status === "active";

    const audit = (rowId: string, act: string, summary: string, actorEmail?: string) =>
      db.from("portal_audit").insert({
        actor_account_id: me?.id ?? null,
        actor_email: actorEmail || me?.email || "",
        table_name: "portal_accounts",
        row_id: rowId,
        action: act,
        summary,
      });

    // ---- first administrator ---------------------------------------------------
    if (action === "bootstrap") {
      const realAddress = (caller.email || "").toLowerCase();
      const { data: siteAdmin } = await db
        .from("admins").select("email").eq("email", realAddress).maybeSingle();
      if (!siteAdmin) {
        return json({
          error: "Only an admin panel administrator can set up the portal. Sign in with your admin panel account.",
        }, 403);
      }
      if ((await activeAdminCount(db)) > 0) {
        return json({
          error: "The portal already has an administrator. Ask them to give you access.",
        }, 409);
      }
      const out = await createAccount(db, { ...body, role: "admin" }, realAddress);
      if (out.error) return json({ error: out.error }, out.status || 400);
      await audit(String(out.account_id), "insert",
        `Set up the first portal administrator, ${out.email}.`, realAddress);
      return json(out);
    }

    if (!isPortalAdmin) {
      return json({ error: "Only a portal administrator can do that." }, 403);
    }

    // ---- everything else acts on an existing account --------------------------
    if (action === "create") {
      const out = await createAccount(db, body, me!.email);
      if (out.error) return json({ error: out.error }, out.status || 400);
      await audit(String(out.account_id), "insert",
        `Gave ${out.email} portal access as ${out.role === "admin" ? "an administrator" : "a holder"}.`);
      return json(out);
    }

    const accountId = String(body.account_id || "");
    const { data: target } = await db
      .from("portal_accounts")
      .select("id,auth_user_id,email,role,status,shareholder_id")
      .eq("id", accountId)
      .maybeSingle<Account>();
    if (!target) return json({ error: "No such portal account." }, 404);

    const isSelf = target.id === me!.id;
    const isLastAdmin = target.role === "admin" && target.status === "active" &&
      (await activeAdminCount(db)) <= 1;

    if (action === "set-password") {
      const password = String(body.password || "");
      if (password.length < MIN_PASSWORD) {
        return json({ error: `Use a password of at least ${MIN_PASSWORD} characters.` }, 400);
      }
      const { error } = await db.auth.admin.updateUserById(target.auth_user_id, { password });
      if (error) return json({ error: error.message }, 400);
      await audit(target.id, "update", `Set a new portal password for ${target.email}.`);
      return json({ ok: true });
    }

    if (action === "set-status") {
      const status = body.status === "disabled" ? "disabled" : "active";
      if (status === "disabled" && isSelf) {
        return json({ error: "You cannot switch off your own access." }, 400);
      }
      if (status === "disabled" && isLastAdmin) {
        return json({ error: "This is the only portal administrator. Make someone else an administrator first." }, 400);
      }
      if (status === "active" && target.shareholder_id) {
        const { data: holder } = await db
          .from("shareholders").select("status").eq("id", target.shareholder_id).maybeSingle();
        if (holder && holder.status !== "active") {
          return json({ error: "That shareholder is no longer active on the register, so their access stays off." }, 400);
        }
      }
      const { error: rowError } = await db
        .from("portal_accounts").update({ status }).eq("id", target.id);
      if (rowError) return json({ error: rowError.message }, 400);
      // A ban also stops the session they already have from being refreshed.
      const { error } = await db.auth.admin.updateUserById(target.auth_user_id, {
        ban_duration: status === "disabled" ? FOREVER : "none",
      });
      if (error) return json({ error: error.message }, 400);
      await audit(target.id, "update",
        status === "disabled" ? `Switched off portal access for ${target.email}.`
                              : `Switched portal access back on for ${target.email}.`);
      return json({ ok: true, status });
    }

    if (action === "set-role") {
      const role = body.role === "admin" ? "admin" : "holder";
      if (role === "holder" && !target.shareholder_id) {
        return json({ error: "This account is not linked to anyone on the register, so it can only be an administrator." }, 400);
      }
      if (role === "holder" && isLastAdmin) {
        return json({ error: "This is the only portal administrator. Make someone else an administrator first." }, 400);
      }
      const { error } = await db.from("portal_accounts").update({ role }).eq("id", target.id);
      if (error) return json({ error: error.message }, 400);
      await audit(target.id, "update",
        role === "admin" ? `Made ${target.email} a portal administrator.`
                         : `Made ${target.email} a holder, no longer an administrator.`);
      return json({ ok: true, role });
    }

    if (action === "delete") {
      if (isSelf) return json({ error: "You cannot remove your own access." }, 400);
      if (isLastAdmin) {
        return json({ error: "This is the only portal administrator. Make someone else an administrator first." }, 400);
      }
      const { error } = await db.auth.admin.deleteUser(target.auth_user_id);
      if (error) return json({ error: error.message }, 400);
      // the foreign key removes the row with the user; this covers the case
      // where the user was already gone
      await db.from("portal_accounts").delete().eq("id", target.id);
      await audit(target.id, "delete", `Removed portal access for ${target.email}. Their register record is unchanged.`);
      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Something went wrong." }, 500);
  }
});
