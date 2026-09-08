import { createClient } from "npm:@supabase/supabase-js@2";

// Service-role client: bypasses RLS. Only ever used server-side, inside edge
// functions, and only for the specific rows a request has already proven it
// is allowed to touch (owner's JWT, or a matching public_token).
export function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

// Verifies the caller's JWT (forwarded automatically by supabase-js'
// `functions.invoke`) and returns their user id, or null if it's missing/invalid.
export async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } }
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
