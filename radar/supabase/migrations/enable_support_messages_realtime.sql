-- Publica los cambios del Centro de Mensajes para las suscripciones Realtime.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_support_messages;
  END IF;
END;
$$;
