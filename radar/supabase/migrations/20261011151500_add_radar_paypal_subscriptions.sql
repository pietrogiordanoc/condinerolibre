CREATE TABLE IF NOT EXISTS public.radar_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  paypal_subscription_id text UNIQUE NOT NULL,
  plan_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'payment_failed', 'cancelled', 'suspended', 'expired', 'revoked')),
  access_until timestamptz,
  prev_plan text,
  plan_restored boolean NOT NULL DEFAULT false,
  activated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE public.radar_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own Radar subscription" ON public.radar_subscriptions;
CREATE POLICY "Users read their own Radar subscription"
  ON public.radar_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Administrators read Radar subscriptions" ON public.radar_subscriptions;
CREATE POLICY "Administrators read Radar subscriptions"
  ON public.radar_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.radar_expire_overdue()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired integer := 0;
  row_data record;
BEGIN
  FOR row_data IN
    SELECT
      s.user_id,
      s.prev_plan,
      EXISTS (
        SELECT 1
        FROM public.academy_subscriptions a
        WHERE a.user_id = s.user_id
          AND (
            a.status IN ('active', 'payment_failed')
            OR (a.status = 'cancelled' AND a.access_until > now())
          )
      ) AS has_ultra_access
    FROM public.radar_subscriptions s
    WHERE s.status = 'cancelled'
      AND s.access_until <= now()
      AND NOT s.plan_restored
  LOOP
    UPDATE public.profiles
    SET plan = CASE WHEN row_data.has_ultra_access THEN 'paid' ELSE COALESCE(row_data.prev_plan, 'free') END
    WHERE id = row_data.user_id
      AND plan IN ('paid', 'pro');

    UPDATE public.radar_subscriptions
    SET plan_restored = true, updated_at = now()
    WHERE user_id = row_data.user_id;

    expired := expired + 1;
  END LOOP;

  RETURN expired;
END;
$$;

REVOKE ALL ON FUNCTION public.radar_expire_overdue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_expire_overdue() TO service_role;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'expire-radar-subscriptions';

SELECT cron.schedule(
  'expire-radar-subscriptions',
  '*/15 * * * *',
  $$SELECT public.radar_expire_overdue();$$
);
