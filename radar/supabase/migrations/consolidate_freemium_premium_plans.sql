-- El catálogo comercial solo tiene dos estados: Freemium y Premium.
-- Premium concede el Radar Pro y todos los cursos activos, presentes y futuros.

CREATE OR REPLACE FUNCTION public.premium_has_access(target_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = target_user
      AND COALESCE(plan, 'free') IN ('paid', 'pro')
  );
$$;

GRANT EXECUTE ON FUNCTION public.premium_has_access(uuid) TO authenticated;

-- Mantiene la compatibilidad con los consumidores aún desplegados mientras todos
-- consultan la misma fuente de verdad del plan Premium.
CREATE OR REPLACE FUNCTION public.academy_has_access(target_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.premium_has_access(target_user);
$$;

CREATE OR REPLACE FUNCTION public.has_course_access(target_course_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.premium_has_access(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.courses
      WHERE id = target_course_id
        AND active
    );
$$;

CREATE OR REPLACE FUNCTION public.admin_set_premium_access(
  target_user_id uuid,
  should_grant boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  UPDATE public.profiles
  SET plan = CASE WHEN should_grant THEN 'paid' ELSE 'free' END
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_premium_access(uuid, boolean) TO authenticated;

ALTER TABLE public.plan_change_requests
  DROP CONSTRAINT IF EXISTS plan_change_requests_target_plan_check;

UPDATE public.plan_change_requests
SET target_plan = 'premium'
WHERE target_plan IS DISTINCT FROM 'premium';

ALTER TABLE public.plan_change_requests
  ADD CONSTRAINT plan_change_requests_target_plan_check
  CHECK (target_plan = 'premium');

DROP FUNCTION IF EXISTS public.request_ultra_plan_change();
