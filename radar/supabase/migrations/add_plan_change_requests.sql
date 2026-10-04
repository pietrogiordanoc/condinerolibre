-- Solicitudes manuales para pasar de CDL Radar Pro a Premium Class.
CREATE TABLE IF NOT EXISTS public.plan_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_note text CHECK (admin_note IS NULL OR char_length(admin_note) <= 2000)
);

CREATE UNIQUE INDEX IF NOT EXISTS plan_change_requests_one_pending_per_user_idx
  ON public.plan_change_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS plan_change_requests_admin_idx
  ON public.plan_change_requests (status, requested_at DESC);

ALTER TABLE public.plan_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Premium users read own plan change requests" ON public.plan_change_requests;
CREATE POLICY "Premium users read own plan change requests"
  ON public.plan_change_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Premium users request plan changes" ON public.plan_change_requests;
CREATE POLICY "Premium users request plan changes"
  ON public.plan_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND COALESCE(plan, 'free') IN ('paid', 'pro')
    )
  );

DROP POLICY IF EXISTS "Administrators manage plan change requests" ON public.plan_change_requests;
CREATE POLICY "Administrators manage plan change requests"
  ON public.plan_change_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
