import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
  if (!TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Falta configurar TELEGRAM_WEBHOOK_SECRET.", { status: 500, headers: corsHeaders });
  }

  const botResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
  const bot = await botResponse.json();
  if (!botResponse.ok || !bot.ok || !bot.result?.username) {
    console.error("Telegram getMe failed:", bot);
    return new Response("No se pudo obtener el bot de Telegram.", { status: 502, headers: corsHeaders });
  }

  const webhookResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${SUPABASE_URL}/functions/v1/telegram-webhook`,
      secret_token: TELEGRAM_WEBHOOK_SECRET,
    }),
  });
  const webhook = await webhookResponse.json();
  if (!webhookResponse.ok || !webhook.ok) {
    console.error("Telegram setWebhook failed:", webhook);
    return new Response("No se pudo configurar el webhook de Telegram.", { status: 502, headers: corsHeaders });
  }

  const connectionToken = crypto.randomUUID();
  const { error: tokenError } = await supabase
    .from("telegram_admin_connection_tokens")
    .insert({
      token: connectionToken,
      admin_user_id: user.id,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  if (tokenError) {
    console.error("Could not create Telegram admin connection token:", tokenError);
    return new Response("No se pudo preparar la conexión con Telegram.", { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    url: `https://t.me/${bot.result.username}?start=admin_${connectionToken}`,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
