-- Identificador privado guardado en el navegador para recuperar el hilo público.
ALTER TABLE public.user_support_messages
  ADD COLUMN IF NOT EXISTS public_session_id uuid;

CREATE INDEX IF NOT EXISTS user_support_messages_public_session_created_idx
  ON public.user_support_messages (public_session_id, created_at)
  WHERE public_session_id IS NOT NULL;
