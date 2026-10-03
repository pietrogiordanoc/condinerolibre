import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const env = (name: string) => Deno.env.get(name) || "";
const supabaseAdmin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const PAYPAL_BASE = (env("PAYPAL_MODE") || env("PAYPAL_ENV")).toLowerCase() === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const PORTAL_URL = "https://condinerolibre.com/cdl-portal/dashboard/";

const ALLOWED_ORIGINS = new Set([
  "https://condinerolibre.com",
  "https://www.condinerolibre.com",
  "http://localhost:8888",
  "http://127.0.0.1:5500"
]);

const COURSE_OFFERS: Record<string, { title: string; amountCents: number }> = {
  "velas-japonesas": { title: "Velas Japonesas desde Cero", amountCents: 16500 },
  "tradingview-basico": { title: "TradingView Básico", amountCents: 16500 },
  "trading-prime": { title: "Trading Prime Elite Profesional", amountCents: 27000 },
  "master-pro": { title: "Master Pro Profesional Académico", amountCents: 35000 }
};

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://condinerolibre.com",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Vary": "Origin",
    "Content-Type": "application/json"
  };
}

let cachedToken: { value: string; expires: number } | null = null;

async function paypalToken() {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const credentials = btoa(`${env("PAYPAL_CLIENT_ID")}:${env("PAYPAL_CLIENT_SECRET")}`);
  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) throw new Error(`paypal_token_${response.status}`);
  const payload = await response.json();
  cachedToken = { value: payload.access_token, expires: Date.now() + Number(payload.expires_in || 300) * 1000 };
  return cachedToken.value;
}

async function paypalRequest(path: string, init: RequestInit = {}) {
  const token = await paypalToken();
  return fetch(`${PAYPAL_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) }
  });
}

function amountValue(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

serve(async (request) => {
  const headers = corsHeaders(request);
  const reply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed", code: "method_not_allowed" }, 405);

  try {
    if (!env("PAYPAL_CLIENT_ID") || !env("PAYPAL_CLIENT_SECRET")) return reply({ error: "PayPal is not configured", code: "paypal_not_configured" }, 503);
    const token = (request.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Unauthorized", code: "unauthorized" }, 401);

    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    const courseId = typeof body?.course_id === "string" ? body.course_id : "";
    if (action === "create") {
      const offer = COURSE_OFFERS[courseId];
      if (!offer) return reply({ error: "Course not available", code: "invalid_course" }, 400);
      const { data: course } = await supabaseAdmin.from("courses").select("id").eq("id", courseId).eq("active", true).maybeSingle();
      if (!course) return reply({ error: "Course not available", code: "course_inactive" }, 409);
      const { data: enrollment } = await supabaseAdmin.from("course_enrollments")
        .select("course_id").eq("user_id", authData.user.id).eq("course_id", courseId).maybeSingle();
      if (enrollment) return reply({ error: "Course already active", code: "already_enrolled" }, 409);

      const orderResponse = await paypalRequest("/v2/checkout/orders", {
        method: "POST",
        headers: { "PayPal-Request-Id": crypto.randomUUID() },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            reference_id: courseId,
            custom_id: authData.user.id,
            description: offer.title,
            amount: { currency_code: "USD", value: amountValue(offer.amountCents) }
          }],
          application_context: {
            brand_name: "Con Dinero Libre",
            landing_page: "LOGIN",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: PORTAL_URL,
            cancel_url: `${PORTAL_URL}#courses`
          }
        })
      });
      if (!orderResponse.ok) throw new Error(`paypal_order_create_${orderResponse.status}`);
      const order = await orderResponse.json();
      const approvalUrl = order.links?.find((link: { rel?: string }) => link.rel === "approve")?.href;
      if (!order.id || !approvalUrl) throw new Error("paypal_order_response_invalid");

      const { error: insertError } = await supabaseAdmin.from("course_purchase_orders").insert({
        paypal_order_id: order.id,
        user_id: authData.user.id,
        course_id: courseId,
        amount_cents: offer.amountCents
      });
      if (insertError) throw insertError;
      return reply({ approval_url: approvalUrl, order_id: order.id });
    }

    if (action === "capture") {
      const orderId = typeof body?.order_id === "string" ? body.order_id : "";
      const { data: pendingOrder } = await supabaseAdmin.from("course_purchase_orders")
        .select("paypal_order_id, status").eq("paypal_order_id", orderId).eq("user_id", authData.user.id).maybeSingle();
      if (!pendingOrder) return reply({ error: "Order not found", code: "order_not_found" }, 404);
      if (pendingOrder.status === "paid") return reply({ ok: true, status: "paid" });

      const captureResponse = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: "POST",
        headers: { "PayPal-Request-Id": crypto.randomUUID() }
      });
      if (!captureResponse.ok) throw new Error(`paypal_order_capture_${captureResponse.status}`);
      await supabaseAdmin.from("course_purchase_orders").update({ status: "approved", updated_at: new Date().toISOString() }).eq("paypal_order_id", orderId);
      return reply({ ok: true, status: "captured_pending_activation" });
    }

    return reply({ error: "Bad request", code: "bad_request" }, 400);
  } catch (error) {
    console.error("paypal-course-checkout failed:", error);
    return reply({ error: "Internal error", code: "internal_error" }, 500);
  }
});