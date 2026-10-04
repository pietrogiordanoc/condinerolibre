-- Mensajes enviados por usuarios desde Mi cuenta para respuesta posterior por email.
CREATE TABLE IF NOT EXISTS public.user_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 3000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS user_support_messages_admin_idx
  ON public.user_support_messages (status, created_at DESC);

ALTER TABLE public.user_support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own support messages" ON public.user_support_messages;
CREATE POLICY "Users read own support messages"
  ON public.user_support_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users send support messages" ON public.user_support_messages;
CREATE POLICY "Users send support messages"
  ON public.user_support_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Administrators manage support messages" ON public.user_support_messages;
CREATE POLICY "Administrators manage support messages"
  ON public.user_support_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
