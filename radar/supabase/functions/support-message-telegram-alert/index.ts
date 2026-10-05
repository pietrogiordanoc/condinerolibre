import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const WEBHOOK_SECRET = Deno.env.get("SUPPORT_MESSAGE_WEBHOOK_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendTelegramMessage(chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: { force_reply: true, input_field_placeholder: "Escribe tu respuesta para el usuario..." },
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok || !payload.result?.message_id) {
    throw new Error(`Telegram sendMessage failed: ${JSON.stringify(payload)}`);
  }
  return payload.result.message_id as number;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!WEBHOOK_SECRET || req.headers.get("x-support-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { record } = await req.json();
    if (!record?.id || !record?.message || (!record?.user_id && !record?.guest_email)) {
      return new Response(JSON.stringify({ delivered: 0 }), { headers: { "Content-Type": "application/json" } });
    }

    const profileRequest = record.user_id
      ? supabase.from("profiles").select("full_name, email").eq("id", record.user_id).maybeSingle()
      : Promise.resolve({ data: null, error: null });
    const [{ data: profile, error: profileError }, { data: administrators, error: adminError }] = await Promise.all([
      profileRequest,
      supabase.from("admin_users").select("user_id"),
    ]);
    if (profileError) throw profileError;
    if (adminError) throw adminError;

    const administratorIds = (administrators || []).map((administrator) => administrator.user_id);
    if (!administratorIds.length) {
      return new Response(JSON.stringify({ delivered: 0 }), { headers: { "Content-Type": "application/json" } });
    }

    const { data: connections, error: connectionsError } = await supabase
      .from("telegram_connections")
      .select("user_id, telegram_chat_id")
      .in("user_id", administratorIds)
      .not("telegram_chat_id", "is", null);
    if (connectionsError) throw connectionsError;

    const isGuest = !record.user_id;
    const sender = record.guest_name || profile?.full_name || profile?.email || "Usuario CDL";
    const email = record.guest_email || profile?.email || "Sin email";
    const text = [
      "Nuevo mensaje · Centro de Mensajes",
      isGuest ? "Origen: VISITANTE WEB" : "Origen: USUARIO REGISTRADO",
      "",
      `Usuario: ${sender}`,
      `Email: ${email}`,
      "",
      record.message,
      "",
      "Responde a este mensaje para publicar tu respuesta en el chat del usuario.",
    ].join("\n").slice(0, 4096);

    let delivered = 0;
    for (const connection of connections || []) {
      const telegramMessageId = await sendTelegramMessage(connection.telegram_chat_id, text);
      const { error: alertError } = await supabase
        .from("user_support_message_telegram_alerts")
        .upsert({
          support_message_id: record.id,
          admin_user_id: connection.user_id,
          telegram_chat_id: connection.telegram_chat_id,
          telegram_message_id: telegramMessageId,
        }, { onConflict: "support_message_id,admin_user_id" });
      if (alertError) throw alertError;
      delivered += 1;
    }

    return new Response(JSON.stringify({ delivered }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Support message Telegram alert failed:", error);
    return new Response("Unable to deliver Telegram alert.", { status: 500 });
  }
});
