-- Relaciona cada aviso enviado a Telegram con la conversación que puede responder.
CREATE TABLE IF NOT EXISTS public.user_support_message_telegram_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_message_id uuid NOT NULL REFERENCES public.user_support_messages(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id text NOT NULL,
  telegram_message_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (support_message_id, admin_user_id),
  UNIQUE (telegram_chat_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS user_support_message_telegram_alerts_lookup_idx
  ON public.user_support_message_telegram_alerts (telegram_chat_id, telegram_message_id);

ALTER TABLE public.user_support_message_telegram_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Administrators read support Telegram alerts" ON public.user_support_message_telegram_alerts;
CREATE POLICY "Administrators read support Telegram alerts"
  ON public.user_support_message_telegram_alerts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
