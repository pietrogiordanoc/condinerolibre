import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "CDL <onboarding@resend.dev>";
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://condinerolibre.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character] || character));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const { data: administrator, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (adminError || !administrator) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  try {
    const { messageId, reply } = await req.json();
    const adminReply = String(reply || "").trim();
    if (!messageId || !adminReply || adminReply.length > 3000) {
      return new Response(JSON.stringify({ error: "Respuesta inválida." }), { status: 400, headers: corsHeaders });
    }

    const { data: supportMessage, error: messageError } = await supabase
      .from("user_support_messages")
      .select("guest_name, guest_email")
      .eq("id", messageId)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!supportMessage?.guest_email) {
      return new Response(JSON.stringify({ sent: false }), { headers: corsHeaders });
    }
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured.");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [supportMessage.guest_email],
        subject: "Respuesta de ConDineroLibre",
        html: `<p>Hola ${escapeHtml(supportMessage.guest_name || "")},</p><p>${escapeHtml(adminReply).replace(/\n/g, "<br>")}</p><p>Equipo ConDineroLibre</p>`,
      }),
    });
    if (!response.ok) throw new Error(`Resend failed: ${await response.text()}`);

    return new Response(JSON.stringify({ sent: true }), { headers: corsHeaders });
  } catch (error) {
    console.error("Public support reply email failed:", error);
    return new Response(JSON.stringify({ error: "No se pudo enviar el email al visitante." }), { status: 500, headers: corsHeaders });
  }
});
