-- Catálogo comercial de tres niveles (reemplaza la consolidación Freemium/Premium):
--   FREEMIUM = usuario registrado, profiles.plan = 'free'.
--   PREMIUM  = solo Radar sin límites ($19.99), profiles.plan IN ('paid', 'pro') sin suscripción Classroom.
--   ULTRA    = Radar + Classroom ($29.99), profiles.plan IN ('paid', 'pro') + academy_subscriptions vigente.
-- Es idempotente: se puede ejecutar aunque consolidate_freemium_premium_plans.sql ya esté aplicado.

-- Ultra: solo la suscripción Classroom (academy_subscriptions) concede acceso a todos los cursos.
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

-- Premium y Ultra tienen Radar sin límites; los cursos requieren Ultra o una compra individual.
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

-- Premium ya no concede cursos: el alta/baja de Ultra pasa por admin_set_academy_access.
DROP FUNCTION IF EXISTS public.admin_set_premium_access(uuid, boolean);

-- Las solicitudes de cambio de plan vuelven a ser Premium -> Ultra.
ALTER TABLE public.plan_change_requests
  DROP CONSTRAINT IF EXISTS plan_change_requests_target_plan_check;

UPDATE public.plan_change_requests
SET target_plan = 'ultra'
WHERE target_plan IS DISTINCT FROM 'ultra';

ALTER TABLE public.plan_change_requests
  ADD CONSTRAINT plan_change_requests_target_plan_check
  CHECK (target_plan = 'ultra');

-- Los usuarios Premium pueden solicitar CDL Ultra, obteniendo el acceso de inmediato.
-- El equipo ajusta posteriormente la suscripción de PayPal marcada por la solicitud.
CREATE OR REPLACE FUNCTION public.request_ultra_plan_change()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_plan text;
  request_id uuid;
BEGIN
  SELECT plan INTO current_plan
  FROM public.profiles
  WHERE id = auth.uid();

  IF COALESCE(current_plan, 'free') NOT IN ('paid', 'pro') THEN
    RAISE EXCEPTION 'Only Premium users can request CDL Ultra';
  END IF;

  IF public.academy_has_access(auth.uid()) THEN
    RAISE EXCEPTION 'CDL Ultra is already active';
  END IF;

  SELECT id INTO request_id
  FROM public.plan_change_requests
  WHERE user_id = auth.uid()
    AND status = 'pending'
  LIMIT 1;

  IF request_id IS NULL THEN
    INSERT INTO public.plan_change_requests (user_id, target_plan)
    VALUES (auth.uid(), 'ultra')
    RETURNING id INTO request_id;
  END IF;

  INSERT INTO public.academy_subscriptions (
    user_id, status, access_until, prev_plan, plan_restored, note
  )
  VALUES (
    auth.uid(), 'active', NULL, current_plan, false, 'manual_ultra_upgrade_requested'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET status = 'active',
      access_until = NULL,
      prev_plan = COALESCE(academy_subscriptions.prev_plan, EXCLUDED.prev_plan),
      plan_restored = false,
      updated_at = now(),
      note = 'manual_ultra_upgrade_requested';

  RETURN request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_ultra_plan_change() TO authenticated;
