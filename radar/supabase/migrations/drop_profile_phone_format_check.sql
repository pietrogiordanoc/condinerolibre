-- El teléfono acepta cualquier número con país elegido; se elimina la validación E.164 estricta.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_format_check;
