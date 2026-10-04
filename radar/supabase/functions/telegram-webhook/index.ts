// Telegram Bot Webhook - Conecta usuarios con CDL Radar
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";

// Límite diario gratuito de CDLRadar (debe coincidir con la Edge Function radar-access)
const RADAR_FREE_DAILY_LIMIT_MINUTES = 10;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  try {
    // Solo aceptar POST de Telegram
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (!TELEGRAM_WEBHOOK_SECRET || req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== TELEGRAM_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const update = await req.json();
    console.log("Telegram update:", update);

    // Extraer mensaje
    const message = update.message;
    if (!message || !message.text) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const chatId = message.chat.id;
    const text = message.text;
    const replyToMessageId = message.reply_to_message?.message_id;

    if (replyToMessageId) {
      const { data: alert, error: alertError } = await supabase
        .from("user_support_message_telegram_alerts")
        .select("support_message_id, admin_user_id")
        .eq("telegram_chat_id", chatId.toString())
        .eq("telegram_message_id", replyToMessageId)
        .maybeSingle();

      if (alertError) throw alertError;
      if (alert) {
        const { data: connection, error: connectionError } = await supabase
          .from("telegram_connections")
          .select("user_id")
          .eq("user_id", alert.admin_user_id)
          .eq("telegram_chat_id", chatId.toString())
          .maybeSingle();
        if (connectionError) throw connectionError;
        if (!connection) {
          await sendTelegramMessage(chatId, "⛔ Esta cuenta de Telegram no está autorizada para responder mensajes de soporte.");
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        const adminReply = text.trim();
        if (!adminReply) {
          await sendTelegramMessage(chatId, "✍️ Escribe una respuesta para publicar en el chat del usuario.");
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        const { data: updatedMessage, error: replyError } = await supabase
          .from("user_support_messages")
          .update({
            admin_reply: adminReply,
            replied_at: new Date().toISOString(),
            replied_by: alert.admin_user_id,
            status: "completed",
            completed_at: new Date().toISOString(),
            completed_by: alert.admin_user_id,
          })
          .eq("id", alert.support_message_id)
          .is("admin_reply", null)
          .select("id")
          .maybeSingle();
        if (replyError) throw replyError;

        await sendTelegramMessage(
          chatId,
          updatedMessage
            ? "✅ Respuesta publicada. El usuario la verá de inmediato en su Centro de Mensajes."
            : "ℹ️ Este mensaje ya fue respondido desde Admin o Telegram."
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
    }

    // Comando /start con userId
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      
      if (parts.length < 2) {
        // Sin parámetro - mensaje de bienvenida
        await sendTelegramMessage(
          chatId,
          "👋 Bienvenido a CDL Radar Alerts\n\nPara conectar tu cuenta, presiona el botón 'Conectar Telegram' en el Radar y escanea el código QR."
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Decodificar userId del parámetro
      const encodedUserId = parts[1];
      if (encodedUserId.startsWith("admin_")) {
        const token = encodedUserId.slice("admin_".length);
        const { data: connectionToken, error: tokenError } = await supabase
          .from("telegram_admin_connection_tokens")
          .select("admin_user_id, expires_at, consumed_at")
          .eq("token", token)
          .maybeSingle();
        if (tokenError) throw tokenError;
        if (!connectionToken || connectionToken.consumed_at || new Date(connectionToken.expires_at) <= new Date()) {
          await sendTelegramMessage(chatId, "❌ Este enlace de conexión ya venció. Genera uno nuevo desde Admin.");
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        const { data: consumedToken, error: consumeError } = await supabase
          .from("telegram_admin_connection_tokens")
          .update({ consumed_at: new Date().toISOString() })
          .eq("token", token)
          .is("consumed_at", null)
          .select("admin_user_id")
          .maybeSingle();
        if (consumeError) throw consumeError;
        if (!consumedToken) {
          await sendTelegramMessage(chatId, "❌ Este enlace de conexión ya fue utilizado. Genera uno nuevo desde Admin.");
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        const { error: connectionError } = await supabase
          .from("telegram_connections")
          .upsert({
            user_id: consumedToken.admin_user_id,
            telegram_chat_id: chatId.toString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        if (connectionError) throw connectionError;

        await sendTelegramMessage(
          chatId,
          "✅ Telegram conectado a tu cuenta Admin de CDL.\n\nRecibirás los mensajes nuevos del Centro de Mensajes aquí. Responde directamente al aviso para publicar tu respuesta en el chat del usuario."
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      let userId: string;
      
      try {
        userId = atob(encodedUserId);
      } catch {
        await sendTelegramMessage(chatId, "❌ Código QR inválido. Genera uno nuevo desde el Radar.");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      const { data: adminUser, error: adminLookupError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (adminLookupError) throw adminLookupError;
      if (adminUser) {
        await sendTelegramMessage(chatId, "⛔ Las cuentas Admin deben conectarse desde el botón Conectar Telegram del panel Admin.");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Guardar chat_id en Supabase (upsert para crear o actualizar)
      const { error } = await supabase
        .from("telegram_connections")
        .upsert(
          { 
            user_id: userId, 
            telegram_chat_id: chatId.toString(),
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error("Error saving connection:", error);
        await sendTelegramMessage(chatId, "❌ Error al conectar. Intenta nuevamente.");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Obtener información del usuario si está autenticado
      let userName = "";
      let userEmail = "";
      let isPaid = false;
      
      // Si el userId es un UUID (usuario autenticado), obtener sus datos
      if (userId.length === 36 && userId.includes('-')) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, plan")
          .eq("id", userId)
          .single();
        
        if (profile) {
          userEmail = profile.email || "";
          isPaid = profile.plan === 'paid';
          // Extraer nombre del email (parte antes del @)
          userName = userEmail ? userEmail.split('@')[0] : "";
        }
      }

      // Mensaje personalizado de bienvenida
      let greeting = "👋 *¡Hola";
      if (userName) {
        greeting += `, ${userName}`;
      }
      greeting += "!*\n\n";
      
      if (userEmail) {
        greeting += `📧 Cuenta: ${userEmail}\n\n`;
      }
      
      // Mensaje específico según plan
      let planMessage = "";
      
      if (isPaid) {
        // MENSAJE PREMIUM
        planMessage = 
          "⚠️ *IMPORTANTE - PLAN PREMIUM:*\n" +
          "✅ Tu conexión permanece activa aunque cierres el navegador\n" +
          "✅ Recibirás alertas 24/7 sin límites\n" +
          "✅ Acceso ilimitado al Radar\n\n" +
          "💎 Mantén el Radar abierto (puede estar en background) para recibir señales en tiempo real.";
      } else {
        // MENSAJE FREEMIUM
        planMessage = 
          "🔴🔴🔴 *MODO ESPÍA ACTIVADO* 🔴🔴🔴\n\n" +
          "✅ Este mensaje confirma que el Edge Function está ACTUALIZADO\n" +
          "✅ La consulta a profiles funciona correctamente\n" +
          "✅ userId: " + userId + "\n" +
          "✅ userName: " + (userName || "VACÍO") + "\n" +
          "✅ userEmail: " + (userEmail || "VACÍO") + "\n" +
          "✅ isPaid: " + isPaid + "\n\n" +
          "⚠️ *IMPORTANTE - PLAN GRATUITO:*\n" +
          "🔄 Al cerrar el navegador, tu conexión se desconecta automáticamente\n" +
          "⏰ Tu cuota diaria se renueva a medianoche (00:00 UTC)\n" +
          `⏱️ Tienes ${RADAR_FREE_DAILY_LIMIT_MINUTES} minutos de señales por día\n\n` +
          "💡 *OPTIMIZA TU TIEMPO:*\n" +
          "• Tu tiempo empieza a contar cuando abres el Radar\n" +
          "• Abre a la hora que más te convenga (no desperdicies tu cuota)\n" +
          `• Puedes fraccionar tus ${RADAR_FREE_DAILY_LIMIT_MINUTES} minutos en varias conexiones durante el día\n` +
          "• Cada día a medianoche se renueva tu cuota completa\n\n" +
          "💎 *¿Quieres alertas ilimitadas 24/7?* Hazte Premium.";
      }
      
      // Confirmación con instrucciones completas
      await sendTelegramMessage(
        chatId,
        greeting +
        "✅ *Bienvenido a CDL Radar Alerts*\n\n" +
        "Ahora recibirás alertas de trading en tiempo real directamente en Telegram.\n\n" +
        "📢 *CONFIGURA UN SONIDO ESPECIAL:*\n" +
        "1️⃣ Toca mi nombre arriba\n" +
        "2️⃣ Notificaciones → Sonido\n" +
        "3️⃣ Elige un tono único\n\n" +
        "Así no confundirás las alertas de trading con otros mensajes.\n\n" +
        planMessage + "\n\n" +
        "🚀 ¡Listo! Espera la próxima señal NOW.\n\n" +
        "📈 *¡Felices operaciones!* 💰\n\n" +
        "🌐 www.condinerolibre.com",
        true
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});

// Enviar mensaje a Telegram
async function sendTelegramMessage(chatId: number, text: string, markdown = false) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: markdown ? "Markdown" : undefined,
    }),
  });
}
