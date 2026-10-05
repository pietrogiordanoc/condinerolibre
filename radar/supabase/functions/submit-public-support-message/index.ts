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
    const { action, name, email, message, website, sessionId } = await req.json();
    if (action === "thread") {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(sessionId || ""))) {
        return response({ error: "Conversación no válida." }, 400, origin);
      }
      const { data: messages, error } = await supabase
        .from("user_support_messages")
        .select("id, message, created_at, admin_reply, replied_at, status")
        .eq("public_session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const messageIds = (messages || []).map((item) => item.id);
      const { error: presenceError } = await supabase
        .from("user_support_messages")
        .update({ guest_last_seen_at: new Date().toISOString() })
        .eq("public_session_id", sessionId)
        .is("user_id", null);
      if (presenceError) throw presenceError;
      const { data: replies, error: repliesError } = messageIds.length
        ? await supabase
          .from("user_support_message_chat_replies")
          .select("support_message_id, message, created_at")
          .in("support_message_id", messageIds)
          .order("created_at", { ascending: true })
        : { data: [], error: null };
      if (repliesError) throw repliesError;
      return new Response(JSON.stringify({ messages: messages || [], replies: replies || [] }), { headers: headers(origin) });
    }
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
    if ((count || 0) >= 50) {
      return response({ error: "Alcanzaste el límite de mensajes por ahora. Inténtalo de nuevo más tarde." }, 429, origin);
    }

    const publicSessionId = String(sessionId || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(publicSessionId)) {
      return response({ error: "No se pudo iniciar la conversación. Actualiza la página e inténtalo de nuevo." }, 400, origin);
    }
    const { error: insertError } = await supabase.from("user_support_messages").insert({
      user_id: null,
      guest_name: guestName,
      guest_email: guestEmail,
      message: supportMessage,
      public_session_id: publicSessionId,
    });
    if (insertError) throw insertError;

    return response({ message: "Mensaje enviado." }, 201, origin);
  } catch (error) {
    console.error("Public support message failed:", error);
    return response({ error: "No pudimos enviar tu mensaje. Inténtalo de nuevo." }, 500, origin);
  }
});
