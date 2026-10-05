-- Estado explícito cuando el visitante o usuario decide finalizar el chat.
ALTER TABLE public.user_support_messages
  ADD COLUMN IF NOT EXISTS conversation_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversation_closed_by text
    CHECK (conversation_closed_by IS NULL OR conversation_closed_by IN ('guest', 'user'));

CREATE INDEX IF NOT EXISTS user_support_messages_conversation_closed_idx
  ON public.user_support_messages (conversation_closed_at DESC)
  WHERE conversation_closed_at IS NOT NULL;
