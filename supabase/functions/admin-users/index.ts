// ===========================================================================
//  admin-users
//  Creates, re-passwords and removes admin accounts on behalf of a signed in
//  admin.
//
//  Why this exists at all: creating a user with a chosen password needs the
//  service role key, and that key must never reach a browser. Anyone holding
//  it can read and write every table regardless of row level security. So the
//  key stays here, on the server, and the panel asks this function to act.
//
//  Every request is checked twice before anything happens:
//    1. the caller's token has to resolve to a real user
//    2. that user's address has to be in public.admins
//  The function is deployed with JWT verification off, like portal-users,
//  because it does its own: getUser() below rejects anything that is not a
//  real signed in user, and the allowlist lookup is the check that matters.
//
//  It must be deployed under the exact name admin-users, because that is the
//  address the admin panel calls. SUPABASE_URL and the secret key are injected
//  for you; there is nothing to set.
// ===========================================================================
// Editors that check this with the Node TypeScript server report "cannot find
// module" on the URL import below and "cannot find name Deno" further down.
// Both are wrong here: this file is compiled by Deno on Supabase, where URL
// imports and the Deno global are native. The reference line pulls in the edge
// runtime types so an editor with the Deno extension resolves them properly.
/// <reference types="https://esm.sh/@supabase/functions-js@2/src/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// New projects carry their secret keys as a JSON object keyed by name; older
// ones carry the legacy service role key. Accept either, the same way
// portal-users does.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = secretKey();
  if (!url || !serviceKey) return json({ error: "The server is missing its keys." }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // ---- who is asking -------------------------------------------------------
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Not signed in." }, 401);

  const { data: userData, error: userErr } = await admin.auth.getUser(bearer);
  const caller = userData?.user;
  if (userErr || !caller?.email) return json({ error: "Not signed in." }, 401);

  const callerEmail = caller.email.toLowerCase();
  const { data: callerRow } = await admin
    .from("admins").select("email").eq("email", callerEmail).maybeSingle();
  if (!callerRow) return json({ error: "You are not an admin." }, 403);

  // ---- what are they asking for -------------------------------------------
  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { return json({ error: "Bad request." }, 400); }

  const action = String(body.action || "");
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const fullName = String(body.full_name || "").trim();

  const looksLikeEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  if (!looksLikeEmail) return json({ error: "That does not look like an address." }, 400);
  if ((action === "create" || action === "set-password") && password.length < 8) {
    return json({ error: "Use a password of at least eight characters." }, 400);
  }

  // find any existing auth user for this address
  async function findUser(addr: string) {
    // listUsers is paged; walk it rather than assuming the first page has them
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const hit = data.users.find((u) => (u.email || "").toLowerCase() === addr);
      if (hit) return hit;
      if (data.users.length < 200) return null;
    }
    return null;
  }

  try {
    if (action === "create") {
      let user = await findUser(email);

      if (user) {
        // the account already exists, so set the password they chose instead of
        // failing. This is what someone means by "add them" either way.
        const { error } = await admin.auth.admin.updateUserById(user.id, { password });
        if (error) return json({ error: error.message }, 400);
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,          // no confirmation mail to click
          user_metadata: fullName ? { full_name: fullName } : {},
        });
        if (error) return json({ error: error.message }, 400);
        user = data.user;
      }

      const { error: rowErr } = await admin
        .from("admins")
        .upsert({ email, full_name: fullName || null, added_by: callerEmail },
                { onConflict: "email" });
      if (rowErr) return json({ error: rowErr.message }, 400);

      return json({ ok: true, email, created: true });
    }

    if (action === "set-password") {
      const user = await findUser(email);
      if (!user) return json({ error: "No account for that address." }, 404);
      const { error } = await admin.auth.admin.updateUserById(user.id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, email });
    }

    if (action === "remove") {
      if (email === callerEmail) {
        return json({ error: "You cannot remove yourself." }, 400);
      }
      const user = await findUser(email);
      if (user) {
        const { error } = await admin.auth.admin.deleteUser(user.id);
        if (error) return json({ error: error.message }, 400);
      }
      const { error: rowErr } = await admin.from("admins").delete().eq("email", email);
      if (rowErr) return json({ error: rowErr.message }, 400);
      return json({ ok: true, email });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Something went wrong." }, 500);
  }
});
