// ⚠️ ARCHIVO DE REFERENCIA — NO DESPLEGAR SIN REVISIÓN MANUAL PREVIA ⚠️
//
// La Edge Function `radar-access` real que hoy aplica el límite diario de CDLRadar
// vive únicamente en el proyecto Supabase remoto (no existía código fuente versionado
// en este repositorio antes de este cambio). Este archivo es una RECONSTRUCCIÓN basada
// en el contrato observado desde el cliente (cdl-portal/dashboard, radar/App.tsx,
// admin/dashboard) y en el esquema inferido de la tabla `radar_daily_usage`:
//   - POST { action: "check" }              -> { allowed, secondsRemaining }
//   - POST { action: "tick" }                -> { allowed, secondsRemaining }
//   - POST { action: "set_plan", target_user_id, plan } -> usado por el panel admin
//
// NO se conoce con certeza cómo la función original autoriza `set_plan` (quién cuenta
// como administrador). Antes de reemplazar la función real:
//   1. Copia primero el código actualmente desplegado (Supabase Dashboard > Edge
//      Functions > radar-access > código) y guárdalo como respaldo.
//   2. Compara la lógica de autorización de `set_plan` con la de este archivo y ajusta
//      según corresponda (aquí se exige profiles.role === 'admin').
//   3. Si solo quieres cambiar el límite de 60 a 10 minutos, la opción de MENOR riesgo
//      es editar el archivo real desplegado y cambiar únicamente la constante de
//      segundos del límite gratuito (probablemente 3600) por 600 — sin tocar el resto.
//
// Zona horaria del reinicio diario: se usa `usage_date` en UTC (YYYY-MM-DD de
// `new Date().toISOString()`), igual que el panel admin (admin/dashboard/module-users.js).
// Esto significa que la cuota se reinicia a las 00:00 UTC, no a medianoche local del
// usuario.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 🔧 Configuración centralizada del límite diario gratuito de CDLRadar.
// Cambiar SOLO este valor para ajustar el límite (evita literales repetidos).
const FREE_DAILY_LIMIT_SECONDS = 10 * 60; // 10 minutos

// Intervalo aproximado que el cliente usa para el "tick" (informativo, no se usa aquí
// para el cálculo del límite; el límite se basa en tiempo real transcurrido, no en el
// número de ticks, para tolerar reconexiones/recargas de página).
const TICK_INTERVAL_SECONDS = 60;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

function isUnlimitedPlan(plan: string | null | undefined): boolean {
  return plan === "paid" || plan === "pro" || plan === "admin";
}

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function getOrCreateUsageRow(userId: string) {
  const usageDate = todayUtc();
  const { data: existing } = await supabaseAdmin
    .from("radar_daily_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabaseAdmin
    .from("radar_daily_usage")
    .insert({ user_id: userId, usage_date: usageDate, seconds_used: 0 })
    .select("*")
    .single();

  if (error) throw error;
  return created;
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, blocked, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.blocked) {
      return new Response(JSON.stringify({ allowed: false, secondsRemaining: 0, reason: "blocked" }), { status: 200 });
    }

    if (action === "set_plan") {
      // Solo administradores pueden cambiar el plan de otro usuario.
      if (profile?.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }
      const { target_user_id, plan } = body;
      if (!target_user_id || !plan) {
        return new Response(JSON.stringify({ error: "Missing target_user_id or plan" }), { status: 400 });
      }
      const { error } = await supabaseAdmin.from("profiles").update({ plan }).eq("id", target_user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (action === "check" || action === "tick") {
      if (isUnlimitedPlan(profile?.plan)) {
        return new Response(JSON.stringify({ allowed: true, secondsRemaining: FREE_DAILY_LIMIT_SECONDS }), { status: 200 });
      }

      const usage = await getOrCreateUsageRow(user.id);
      let secondsUsed = usage.seconds_used || 0;

      if (action === "tick") {
        secondsUsed = Math.min(FREE_DAILY_LIMIT_SECONDS, secondsUsed + TICK_INTERVAL_SECONDS);
        await supabaseAdmin
          .from("radar_daily_usage")
          .update({ seconds_used: secondsUsed })
          .eq("user_id", user.id)
          .eq("usage_date", todayUtc());
      }

      const secondsRemaining = Math.max(0, FREE_DAILY_LIMIT_SECONDS - secondsUsed);
      return new Response(JSON.stringify({ allowed: secondsRemaining > 0, secondsRemaining }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
  } catch (error) {
    console.error("radar-access error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
