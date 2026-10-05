-- Permite consultas públicas con nombre y email, sin una cuenta autenticada.
ALTER TABLE public.user_support_messages
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text;

ALTER TABLE public.user_support_messages
  DROP CONSTRAINT IF EXISTS user_support_messages_sender_check;

ALTER TABLE public.user_support_messages
  ADD CONSTRAINT user_support_messages_sender_check CHECK (
    (user_id IS NOT NULL AND guest_name IS NULL AND guest_email IS NULL)
    OR
    (
      user_id IS NULL
      AND char_length(trim(guest_name)) BETWEEN 1 AND 100
      AND char_length(trim(guest_email)) BETWEEN 3 AND 254
      AND guest_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    )
  );

CREATE INDEX IF NOT EXISTS user_support_messages_guest_email_created_idx
  ON public.user_support_messages (guest_email, created_at DESC)
  WHERE user_id IS NULL;
