CREATE TABLE IF NOT EXISTS public.manual_payment_alerts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 500),
  active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.manual_payment_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own payment alert" ON public.manual_payment_alerts;
CREATE POLICY "Users read their own payment alert"
  ON public.manual_payment_alerts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Administrators manage payment alerts" ON public.manual_payment_alerts;
CREATE POLICY "Administrators manage payment alerts"
  ON public.manual_payment_alerts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.manual_payment_alerts TO authenticated;
