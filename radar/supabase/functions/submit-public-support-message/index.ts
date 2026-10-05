import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const allowedOrigins = new Set(["https://condinerolibre.com", "https://www.condinerolibre.com"]);

function headers(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://condinerolibre.com",
    "Access-Control-Allow-Headers": "content-type",
    "Content-Type": "application/json",
  };
}

function response(body: Record<string, string>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "POST") return response({ error: "Método no permitido." }, 405, origin);
  if (!origin || !allowedOrigins.has(origin)) return response({ error: "Origen no permitido." }, 403, origin);

  try {
    const { name, email, message, website } = await req.json();
    const guestName = String(name || "").trim();
    const guestEmail = String(email || "").trim().toLowerCase();
    const supportMessage = String(message || "").trim();

    if (website) return response({ error: "No se pudo enviar el mensaje." }, 400, origin);
    if (!guestName || guestName.length > 100) return response({ error: "Escribe tu nombre." }, 400, origin);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail) || guestEmail.length > 254) {
      return response({ error: "Escribe un correo válido." }, 400, origin);
    }
    if (!supportMessage || supportMessage.length > 3000) {
      return response({ error: "Escribe un mensaje de hasta 3000 caracteres." }, 400, origin);
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("user_support_messages")
      .select("id", { count: "exact", head: true })
      .eq("guest_email", guestEmail)
      .gte("created_at", oneHourAgo);
    if (countError) throw countError;
    if ((count || 0) >= 3) {
      return response({ error: "Ya recibimos varios mensajes tuyos. Inténtalo de nuevo más tarde." }, 429, origin);
    }

    const { error: insertError } = await supabase.from("user_support_messages").insert({
      user_id: null,
      guest_name: guestName,
      guest_email: guestEmail,
      message: supportMessage,
    });
    if (insertError) throw insertError;

    return response({ message: "Mensaje enviado. Recibirás la respuesta en tu correo." }, 201, origin);
  } catch (error) {
    console.error("Public support message failed:", error);
    return response({ error: "No pudimos enviar tu mensaje. Inténtalo de nuevo." }, 500, origin);
  }
});
