-- Pagos únicos de cursos: la orden vincula de forma verificable el usuario, curso e importe antes de conceder acceso.

CREATE TABLE IF NOT EXISTS public.course_purchase_orders (
  paypal_order_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency_code text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'approved', 'paid', 'cancelled', 'failed')),
  paypal_capture_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_purchase_orders_user_id_idx
  ON public.course_purchase_orders (user_id, created_at DESC);

ALTER TABLE public.course_purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own course purchase orders" ON public.course_purchase_orders;
CREATE POLICY "Users read their own course purchase orders"
  ON public.course_purchase_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Administrators read course purchase orders" ON public.course_purchase_orders;
CREATE POLICY "Administrators read course purchase orders"
  ON public.course_purchase_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));