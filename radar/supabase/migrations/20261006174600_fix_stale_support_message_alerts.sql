-- A conversation does not require an answer once it was closed or the team replied.
-- Reconcile historical rows before the admin alert starts using the stricter predicate.
UPDATE public.user_support_messages AS message
SET
  status = 'completed',
  completed_at = COALESCE(
    message.completed_at,
    message.replied_at,
    (
      SELECT MIN(reply.created_at)
      FROM public.user_support_message_chat_replies AS reply
      WHERE reply.support_message_id = message.id
    ),
    message.conversation_closed_at,
    now()
  )
WHERE message.status = 'pending'
  AND (
    message.admin_reply IS NOT NULL
    OR message.conversation_closed_at IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.user_support_message_chat_replies AS reply
      WHERE reply.support_message_id = message.id
    )
  );
