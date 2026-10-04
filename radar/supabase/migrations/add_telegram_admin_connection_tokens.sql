-- Tokens efímeros para vincular de forma segura una cuenta Telegram de Admin.
CREATE TABLE IF NOT EXISTS public.telegram_admin_connection_tokens (
  token uuid PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_admin_connection_tokens_active_idx
  ON public.telegram_admin_connection_tokens (admin_user_id, expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.telegram_admin_connection_tokens ENABLE ROW LEVEL SECURITY;
