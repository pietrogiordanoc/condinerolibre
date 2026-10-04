-- Respuestas publicadas por Administración dentro del Centro de Mensajes.
ALTER TABLE public.user_support_messages
  ADD COLUMN IF NOT EXISTS admin_reply text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_support_messages
  DROP CONSTRAINT IF EXISTS user_support_messages_admin_reply_check;

ALTER TABLE public.user_support_messages
  ADD CONSTRAINT user_support_messages_admin_reply_check
  CHECK (admin_reply IS NULL OR char_length(trim(admin_reply)) BETWEEN 1 AND 3000);

CREATE INDEX IF NOT EXISTS user_support_messages_user_created_idx
  ON public.user_support_messages (user_id, created_at);
