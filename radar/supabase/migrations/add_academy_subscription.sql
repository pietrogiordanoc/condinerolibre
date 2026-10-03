-- Plan "CDLRadar and ClassRoom": acceso a todos los cursos (actuales y futuros) + Radar Pro mientras la suscripción esté vigente.

CREATE TABLE IF NOT EXISTS public.academy_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  paypal_subscription_id text UNIQUE,
  status text NOT NULL CHECK (status IN ('active', 'payment_failed', 'cancelled', 'suspended', 'expired', 'revoked')),
  access_until timestamptz,
  prev_plan text,
  plan_restored boolean NOT NULL DEFAULT false,
  activated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE public.academy_subscriptions ENABLE ROW LEVEL SECURITY;

-- Sin políticas de escritura: solo la Edge Function (service role) y las funciones de admin modifican la tabla.
DROP POLICY IF EXISTS "Users read their own academy subscription" ON public.academy_subscriptions;
CREATE POLICY "Users read their own academy subscription"
  ON public.academy_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Administrators read academy subscriptions" ON public.academy_subscriptions;
CREATE POLICY "Administrators read academy subscriptions"
  ON public.academy_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.paypal_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  subscription_id text,
  user_id uuid,
  result text,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paypal_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Administrators read paypal events" ON public.paypal_events;
CREATE POLICY "Administrators read paypal events"
  ON public.paypal_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.academy_has_access(target_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.academy_subscriptions s
    WHERE s.user_id = target_user
      AND (s.status IN ('active', 'payment_failed')
           OR (s.status = 'cancelled' AND s.access_until > now()))
  );
$$;

GRANT EXECUTE ON FUNCTION public.academy_has_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_course_access(target_course_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments e
    WHERE e.user_id = auth.uid() AND e.course_id = target_course_id
  ) OR (
    public.academy_has_access(auth.uid())
    AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = target_course_id AND c.active)
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_course_access(text) TO authenticated;

DROP POLICY IF EXISTS "Students can read lessons for enrolled courses" ON public.course_lessons;
CREATE POLICY "Students can read lessons for enrolled courses"
  ON public.course_lessons FOR SELECT TO authenticated
  USING (published = true AND public.has_course_access(course_id));

DROP POLICY IF EXISTS "Students can read modules for enrolled courses" ON public.course_modules;
CREATE POLICY "Students can read modules for enrolled courses"
  ON public.course_modules FOR SELECT TO authenticated
  USING (public.has_course_access(course_id));

DROP POLICY IF EXISTS "Students save their own progress" ON public.course_progress;
CREATE POLICY "Students save their own progress"
  ON public.course_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_course_access(course_id));

DROP POLICY IF EXISTS "Students create their own sessions" ON public.course_sessions;
CREATE POLICY "Students create their own sessions"
  ON public.course_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_course_access(course_id));

-- Activación o revocación manual desde el panel admin.
CREATE OR REPLACE FUNCTION public.admin_set_academy_access(target_user_id uuid, should_grant boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_plan text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  SELECT plan INTO current_plan FROM public.profiles WHERE id = target_user_id;

  IF should_grant THEN
    INSERT INTO public.academy_subscriptions (user_id, status, prev_plan, note)
    VALUES (target_user_id, 'active', COALESCE(current_plan, 'free'), 'manual')
    ON CONFLICT (user_id) DO UPDATE
    SET status = 'active',
        access_until = NULL,
        prev_plan = CASE WHEN academy_subscriptions.plan_restored THEN COALESCE(current_plan, 'free') ELSE academy_subscriptions.prev_plan END,
        plan_restored = false,
        updated_at = now(),
        note = 'manual';
    UPDATE public.profiles SET plan = 'paid' WHERE id = target_user_id AND COALESCE(plan, 'free') NOT IN ('paid', 'pro');
  ELSE
    UPDATE public.academy_subscriptions
    SET status = 'revoked', access_until = NULL, plan_restored = true, updated_at = now(), note = 'manual'
    WHERE user_id = target_user_id;
    UPDATE public.profiles p
    SET plan = COALESCE(s.prev_plan, 'free')
    FROM public.academy_subscriptions s
    WHERE p.id = target_user_id AND s.user_id = target_user_id
      AND p.plan = 'paid' AND COALESCE(s.prev_plan, 'free') <> 'paid';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_academy_access(uuid, boolean) TO authenticated;

-- Devuelve el plan previo a quien canceló y ya agotó el periodo pagado.
CREATE OR REPLACE FUNCTION public.academy_expire_overdue()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired integer := 0;
  row_data record;
BEGIN
  FOR row_data IN
    SELECT user_id, prev_plan FROM public.academy_subscriptions
    WHERE status = 'cancelled' AND access_until <= now() AND NOT plan_restored
  LOOP
    UPDATE public.profiles SET plan = COALESCE(row_data.prev_plan, 'free')
    WHERE id = row_data.user_id AND plan = 'paid' AND COALESCE(row_data.prev_plan, 'free') <> 'paid';
    UPDATE public.academy_subscriptions SET plan_restored = true, updated_at = now() WHERE user_id = row_data.user_id;
    expired := expired + 1;
  END LOOP;
  RETURN expired;
END;
$$;

GRANT EXECUTE ON FUNCTION public.academy_expire_overdue() TO authenticated;
