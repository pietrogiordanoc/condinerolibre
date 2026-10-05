-- Permite continuar una conversación sin reemplazar respuestas anteriores.
CREATE TABLE IF NOT EXISTS public.user_support_message_chat_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_message_id uuid NOT NULL REFERENCES public.user_support_messages(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS user_support_message_chat_replies_message_created_idx
  ON public.user_support_message_chat_replies (support_message_id, created_at);

ALTER TABLE public.user_support_messages
  ADD COLUMN IF NOT EXISTS guest_last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS user_support_messages_guest_last_seen_idx
  ON public.user_support_messages (public_session_id, guest_last_seen_at DESC)
  WHERE public_session_id IS NOT NULL;

ALTER TABLE public.user_support_message_chat_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own support chat replies" ON public.user_support_message_chat_replies;
CREATE POLICY "Users read own support chat replies"
  ON public.user_support_message_chat_replies FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_support_messages
      WHERE id = support_message_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Administrators manage support chat replies" ON public.user_support_message_chat_replies;
CREATE POLICY "Administrators manage support chat replies"
  ON public.user_support_message_chat_replies FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_support_message_chat_replies;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
