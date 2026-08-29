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
//  Supabase verifies the token is signed by this project before the function
//  runs, but the anon key is also such a token, so that check alone would let
//  anybody through. The allowlist lookup below is the one that matters.
//
//  Deploy from the dashboard: Edge Functions, new function named
//  admin-users, paste this in, Deploy. SUPABASE_URL and
//  SUPABASE_SERVICE_ROLE_KEY are injected for you; there is nothing to set.
// ===========================================================================
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
