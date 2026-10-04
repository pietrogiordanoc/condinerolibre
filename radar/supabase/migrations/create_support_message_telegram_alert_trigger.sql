-- Fallback para proyectos donde Database Webhooks no instala supabase_functions.
-- Antes de ejecutar, guarda SUPPORT_MESSAGE_WEBHOOK_SECRET en Vault bajo
-- el nombre support_message_webhook_secret.
CREATE OR REPLACE FUNCTION public.notify_support_message_telegram_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  webhook_secret text;
BEGIN
  SELECT decrypted_secret
    INTO webhook_secret
    FROM vault.decrypted_secrets
   WHERE name = 'support_message_webhook_secret';

  IF webhook_secret IS NULL THEN
    RAISE EXCEPTION 'Missing Vault secret support_message_webhook_secret';
  END IF;

  PERFORM net.http_post(
    url := 'https://yhgqmbexjscojlrzguvh.supabase.co/functions/v1/support-message-telegram-alert',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', NULL
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-support-webhook-secret', webhook_secret
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telegram_support_message_alert_trigger
  ON public.user_support_messages;

CREATE TRIGGER telegram_support_message_alert_trigger
AFTER INSERT ON public.user_support_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_support_message_telegram_alert();
