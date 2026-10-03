import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Una sola función con dos entradas: webhook firmado de PayPal y confirmación del portal (con sesión).
const env = (name: string) => Deno.env.get(name) || "";
const supabaseAdmin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const PAYPAL_BASE = (env("PAYPAL_MODE") || env("PAYPAL_ENV")).toLowerCase() === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

const ALLOWED_ORIGINS = new Set([
  "https://condinerolibre.com",
  "https://www.condinerolibre.com",
  "http://localhost:8888",
  "http://127.0.0.1:5500"
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://condinerolibre.com",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Vary": "Origin",
    "Content-Type": "application/json"
  };
}

type Subscription = {
  id: string;
  status: string;
  plan_id: string;
  custom_id?: string;
  billing_info?: { next_billing_time?: string; last_payment?: { time?: string; amount?: { value?: string } } };
};

type Capture = {
  id?: string;
  status?: string;
  amount?: { currency_code?: string; value?: string };
  supplementary_data?: { related_ids?: { order_id?: string } };
};

let cachedToken: { value: string; expires: number } | null = null;

function paypalConfigured() {
  return Boolean(env("PAYPAL_CLIENT_ID") && env("PAYPAL_CLIENT_SECRET") && env("PAYPAL_ACADEMY_PLAN_ID"));
}

async function paypalToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const credentials = btoa(`${env("PAYPAL_CLIENT_ID")}:${env("PAYPAL_CLIENT_SECRET")}`);
  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) throw new Error(`paypal_token_${response.status}`);
  const json = await response.json();
  cachedToken = { value: json.access_token, expires: Date.now() + Number(json.expires_in || 300) * 1000 };
  return cachedToken.value;
}

async function paypalRequest(path: string, init: RequestInit = {}) {
  const token = await paypalToken();
  return fetch(`${PAYPAL_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) }
  });
}

async function fetchSubscription(subscriptionId: string): Promise<Subscription | null> {
  const response = await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`paypal_subscription_${response.status}`);
  return await response.json();
}

async function fetchOrder(orderId: string): Promise<Record<string, unknown> | null> {
  const response = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`paypal_order_${response.status}`);
  return await response.json();
}

async function verifyWebhookSignature(request: Request, event: unknown): Promise<boolean> {
  const header = (name: string) => request.headers.get(name) || "";
  const response = await paypalRequest("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: header("paypal-auth-algo"),
      cert_url: header("paypal-cert-url"),
      transmission_id: header("paypal-transmission-id"),
      transmission_sig: header("paypal-transmission-sig"),
      transmission_time: header("paypal-transmission-time"),
      webhook_id: env("PAYPAL_WEBHOOK_ID"),
      webhook_event: event
    })
  });
  if (!response.ok) return false;
  return (await response.json()).verification_status === "SUCCESS";
}

function stateFor(eventType: string, status: string): string | null {
  if (eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED" && status === "ACTIVE") return "payment_failed";
  switch (status) {
    case "ACTIVE": return "active";
    case "SUSPENDED": return "suspended";
    case "CANCELLED": return "cancelled";
    case "EXPIRED": return "expired";
    default: return null;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

async function notifyAdmin(subject: string, rows: [string, string][]) {
  const apiKey = env("RESEND_API_KEY");
  const to = env("ADMIN_NOTIFY_EMAIL");
  if (!apiKey || !to) return;
  const html = `<h2 style="font-family:Arial">${escapeHtml(subject)}</h2><table style="font-family:Arial;font-size:14px;border-collapse:collapse">${
    rows.map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${escapeHtml(label)}</td><td style="padding:4px 0"><b>${escapeHtml(value)}</b></td></tr>`).join("")
  }</table>`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env("RESEND_FROM") || "CDL <onboarding@resend.dev>", to: [to], subject, html })
    });
    if (!response.ok) console.error("Resend failed:", response.status, (await response.text()).slice(0, 300));
  } catch (error) {
    console.error("Resend request failed:", error);
  }
}

async function updateProfilePlan(userId: string, plan: string) {
  const byId = await supabaseAdmin.from("profiles").update({ plan }).eq("id", userId);
  if (byId.error) await supabaseAdmin.from("profiles").update({ plan }).eq("user_id", userId);
}

async function readProfile(userId: string): Promise<{ plan?: string; full_name?: string } | null> {
  const byId = await supabaseAdmin.from("profiles").select("plan, full_name").eq("id", userId).maybeSingle();
  if (!byId.error) return byId.data;
  const byUserId = await supabaseAdmin.from("profiles").select("plan, full_name").eq("user_id", userId).maybeSingle();
  return byUserId.data;
}

function accessUntilFor(subscription: Subscription): string {
  const next = subscription.billing_info?.next_billing_time;
  if (next) return next;
  const lastPayment = subscription.billing_info?.last_payment?.time;
  if (lastPayment) return new Date(new Date(lastPayment).getTime() + 30 * 86_400_000).toISOString();
  return new Date().toISOString();
}

const STATE_SUBJECTS: Record<string, string> = {
  active: "Nueva suscripcion activa",
  payment_failed: "Pago fallido (acceso en gracia)",
  cancelled: "Suscripcion cancelada",
  suspended: "Suscripcion suspendida: acceso retirado",
  expired: "Suscripcion expirada: acceso retirado"
};

async function applyState(userId: string, subscription: Subscription, state: string, source: string) {
  const { data: existing } = await supabaseAdmin
    .from("academy_subscriptions")
    .select("status, paypal_subscription_id, prev_plan, plan_restored")
    .eq("user_id", userId).maybeSingle();

  if (existing?.status === state && existing.paypal_subscription_id === subscription.id) return { changed: false };
  // Una revocación manual solo se levanta con una activación explícita.
  const explicitActivation = source === "BILLING.SUBSCRIPTION.ACTIVATED" || source === "BILLING.SUBSCRIPTION.RE-ACTIVATED" || source === "portal.confirm";
  if (existing?.status === "revoked" && existing.paypal_subscription_id === subscription.id && !explicitActivation) {
    return { changed: false, skipped: "revoked" };
  }

  const profile = await readProfile(userId);
  const currentPlan = profile?.plan || "free";
  const prevPlan = existing && !existing.plan_restored && existing.prev_plan ? existing.prev_plan : currentPlan;
  const hasAccess = state === "active" || state === "payment_failed";
  const wasActive = existing?.status === "active" || existing?.status === "payment_failed";
  const restoreNow = state === "suspended" || state === "expired";

  const row: Record<string, unknown> = {
    user_id: userId,
    paypal_subscription_id: subscription.id,
    status: state,
    access_until: state === "cancelled" ? accessUntilFor(subscription) : null,
    prev_plan: prevPlan,
    plan_restored: restoreNow,
    updated_at: new Date().toISOString(),
    note: source
  };
  if (hasAccess && !wasActive) row.activated_at = new Date().toISOString();

  const { error } = await supabaseAdmin.from("academy_subscriptions").upsert(row, { onConflict: "user_id" });
  if (error) throw error;

  if (hasAccess && currentPlan !== "paid" && currentPlan !== "pro") await updateProfilePlan(userId, "paid");
  if (restoreNow && currentPlan === "paid" && prevPlan !== "paid") await updateProfilePlan(userId, prevPlan);

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  await notifyAdmin(`${STATE_SUBJECTS[state] || "Cambio de suscripcion"} · CDLRadar and ClassRoom`, [
    ["Alumno", profile?.full_name || "-"],
    ["Email", authUser?.user?.email || "-"],
    ["Estado", state],
    ["Suscripcion PayPal", subscription.id],
    ["Ultimo pago", subscription.billing_info?.last_payment?.amount?.value ? `${subscription.billing_info.last_payment.amount.value} USD` : "-"],
    ["Origen", source],
    ["Fecha", new Date().toISOString()]
  ]);
  return { changed: true };
}

function moneyToCents(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

async function applyCourseCapture(capture: Capture) {
  const orderId = capture.supplementary_data?.related_ids?.order_id;
  if (!orderId || capture.status !== "COMPLETED") return { result: "ignored_capture" };
  const { data: purchase } = await supabaseAdmin.from("course_purchase_orders")
    .select("user_id, course_id, amount_cents, currency_code, status")
    .eq("paypal_order_id", orderId).maybeSingle();
  if (!purchase) return { result: "unknown_course_order" };
  if (purchase.status === "paid") return { result: "course_already_paid", userId: purchase.user_id };

  const order = await fetchOrder(orderId);
  const unit = Array.isArray(order?.purchase_units) ? order.purchase_units[0] as Record<string, unknown> : null;
  const orderUserId = unit?.custom_id;
  const orderCourseId = unit?.reference_id;
  const amount = capture.amount || (unit?.amount as Capture["amount"]);
  const amountCents = moneyToCents(amount?.value);
  if (orderUserId !== purchase.user_id || orderCourseId !== purchase.course_id || amount?.currency_code !== purchase.currency_code || amountCents !== purchase.amount_cents) {
    throw new Error("course_capture_verification_failed");
  }

  const { error: enrollmentError } = await supabaseAdmin.from("course_enrollments")
    .upsert({ user_id: purchase.user_id, course_id: purchase.course_id }, { onConflict: "user_id,course_id", ignoreDuplicates: true });
  if (enrollmentError) throw enrollmentError;
  const { error: purchaseError } = await supabaseAdmin.from("course_purchase_orders")
    .update({ status: "paid", paypal_capture_id: capture.id || null, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("paypal_order_id", orderId);
  if (purchaseError) throw purchaseError;
  return { result: "course_enrolled", userId: purchase.user_id };
}

async function handleWebhook(request: Request, reply: (body: Record<string, unknown>, status?: number) => Response) {
  if (!paypalConfigured() || !env("PAYPAL_WEBHOOK_ID")) return reply({ error: "PayPal is not configured", code: "paypal_not_configured" }, 503);

  const event = JSON.parse(await request.text());
  if (!(await verifyWebhookSignature(request, event))) return reply({ error: "Invalid signature", code: "invalid_signature" }, 400);

  const eventType: string = event.event_type || "";
  const resource = event.resource || {};
  const subscriptionId: string | null = eventType === "PAYMENT.SALE.COMPLETED"
    ? resource.billing_agreement_id || null
    : eventType.startsWith("BILLING.SUBSCRIPTION.") ? resource.id || null : null;
  const isCourseCapture = eventType === "PAYMENT.CAPTURE.COMPLETED";
  if (!subscriptionId && !isCourseCapture) return reply({ ok: true, ignored: true });

  // Cada evento se procesa una sola vez, aunque PayPal lo reenvíe.
  const { error: insertError } = await supabaseAdmin.from("paypal_events")
    .insert({ id: event.id, event_type: eventType, subscription_id: subscriptionId });
  if (insertError?.code === "23505") return reply({ ok: true, duplicate: true });
  if (insertError) throw insertError;

  try {
    let result = "ignored_other_plan";
    let userId: string | null = null;
    if (isCourseCapture) {
      const outcome = await applyCourseCapture(resource as Capture);
      result = outcome.result;
      userId = outcome.userId || null;
    } else {
      const subscription = await fetchSubscription(subscriptionId as string);
      if (subscription && subscription.plan_id === env("PAYPAL_ACADEMY_PLAN_ID")) {
      userId = subscription.custom_id && UUID_PATTERN.test(subscription.custom_id) ? subscription.custom_id : null;
      const state = stateFor(eventType, subscription.status);
      if (!userId) result = "no_user";
      else if (!state) result = `no_state_${subscription.status}`;
      else {
        const outcome = await applyState(userId, subscription, state, eventType);
        result = outcome.changed ? `applied_${state}` : `unchanged_${outcome.skipped || state}`;
      }
      }
    }
    await supabaseAdmin.from("paypal_events").update({ result, user_id: userId }).eq("id", event.id);
    await supabaseAdmin.rpc("academy_expire_overdue");
    return reply({ ok: true, result });
  } catch (error) {
    // Se libera el evento para que el reintento de PayPal pueda procesarlo.
    await supabaseAdmin.from("paypal_events").delete().eq("id", event.id);
    throw error;
  }
}

async function handleConfirm(request: Request, reply: (body: Record<string, unknown>, status?: number) => Response) {
  const token = (request.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!token) return reply({ error: "Unauthorized", code: "unauthorized" }, 401);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return reply({ error: "Unauthorized", code: "unauthorized" }, 401);

  if (!paypalConfigured()) return reply({ error: "PayPal is not configured", code: "paypal_not_configured" }, 503);

  const body = await request.json().catch(() => ({}));
  const subscriptionId = typeof body?.subscription_id === "string" ? body.subscription_id : "";
  if (body?.action !== "confirm" || !subscriptionId) return reply({ error: "Bad request", code: "bad_request" }, 400);

  const subscription = await fetchSubscription(subscriptionId);
  if (!subscription) return reply({ error: "Subscription not found", code: "subscription_not_found" }, 404);
  // La suscripción debe ser del plan correcto y haberse creado con el id de este usuario.
  if (subscription.plan_id !== env("PAYPAL_ACADEMY_PLAN_ID") || subscription.custom_id !== authData.user.id) {
    return reply({ error: "Forbidden", code: "forbidden" }, 403);
  }

  if (subscription.status === "ACTIVE" || subscription.status === "APPROVED") {
    await applyState(authData.user.id, subscription, "active", "portal.confirm");
    return reply({ ok: true, status: "active" });
  }
  if (subscription.status === "APPROVAL_PENDING") return reply({ ok: true, status: "pending" });
  return reply({ error: "Subscription is not active", code: "subscription_not_active", paypal_status: subscription.status }, 409);
}

serve(async (request) => {
  const headers = corsHeaders(request);
  const reply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });

  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed", code: "method_not_allowed" }, 405);

  try {
    if (request.headers.get("paypal-transmission-id")) return await handleWebhook(request, reply);
    return await handleConfirm(request, reply);
  } catch (error) {
    console.error("paypal-webhook failed:", error);
    return reply({ error: "Internal error", code: "internal_error" }, 500);
  }
});
