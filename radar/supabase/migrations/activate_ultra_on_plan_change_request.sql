-- Los usuarios Premium pueden solicitar CDL Ultra, obteniendo el acceso de inmediato.
-- El equipo ajusta posteriormente la suscripción de PayPal marcada por la solicitud.
DROP POLICY IF EXISTS "Premium users request plan changes" ON public.plan_change_requests;

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
