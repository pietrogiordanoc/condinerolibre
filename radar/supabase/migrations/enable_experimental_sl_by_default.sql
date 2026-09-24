ALTER TABLE public.profiles
  ALTER COLUMN experimental_sl_enabled SET DEFAULT TRUE;

UPDATE public.profiles
SET experimental_sl_enabled = TRUE
WHERE experimental_sl_enabled = FALSE;
