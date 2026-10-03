import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const portalUrl = "https://condinerolibre.com/cdl-portal/dashboard/";

const allowedOrigins = new Set([
  "https://condinerolibre.com",
  "https://www.condinerolibre.com",
  "https://admin.condinerolibre.com",
  "http://localhost:8888",
  "http://127.0.0.1:5500"
]);

function responseHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://condinerolibre.com",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Vary": "Origin",
    "Content-Type": "application/json"
  };
}

serve(async (request) => {
  const headers = responseHeaders(request);
  const reply = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });

  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const token = (request.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!token) return reply({ error: "Unauthorized" }, 401);

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Unauthorized" }, 401);

    const { data: adminUser } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (!adminUser) return reply({ error: "Forbidden" }, 403);

    const body = await request.json().catch(() => ({}));
    const targetUserId = typeof body?.target_user_id === "string" ? body.target_user_id : "";
    if (!targetUserId) return reply({ error: "Missing target_user_id" }, 400);

    const { data: target, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("id", targetUserId)
      .maybeSingle();
    if (targetError || !target?.email) return reply({ error: "Student not found" }, 404);

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: target.email
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error("Could not generate audit login link:", linkError);
      return reply({ error: "Could not generate the student session" }, 500);
    }

    const { error: auditError } = await supabaseAdmin.from("audit_events").insert({
      user_id: target.id,
      event_type: "Acceso de auditoría por administrador",
      metadata: {
        email: target.email,
        target_user_id: target.id,
        admin_user_id: authData.user.id,
        admin_email: authData.user.email,
        source: "admin_dashboard",
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    });
    if (auditError) console.error("Could not record audit login:", auditError);

    return reply({ ok: true, portal_url: portalUrl, token_hash: tokenHash });
  } catch (error) {
    console.error("admin-audit-login failed:", error);
    return reply({ error: "Internal error" }, 500);
  }
});