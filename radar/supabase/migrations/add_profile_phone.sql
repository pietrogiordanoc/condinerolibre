-- Migración: agrega el teléfono obligatorio al perfil (Registro con nombre + email + teléfono)
--
-- CONTEXTO IMPORTANTE:
-- El código fuente del trigger que crea filas en `profiles` a partir de `auth.users`
-- (buscado en el repo como "el Trigger", ver cdl-portal/registro/index.html) NO está
-- versionado en este proyecto: vive únicamente en el proyecto Supabase remoto. Por eso
-- esta migración es ADITIVA y no intenta reemplazar ese trigger para no romperlo:
-- el teléfono se guarda desde el cliente (registro y "completar perfil") con un UPDATE
-- directo a `profiles` inmediatamente después del alta / login, no depende de que el
-- trigger conozca la columna `phone`.
--
-- Pendiente de aplicar manualmente: ejecutar este archivo en el SQL Editor de Supabase
-- o vía `supabase db push` / `supabase migration up` con la CLI, ya que este entorno no
-- tiene acceso directo a la base de datos remota.

-- 1) Columna de teléfono (con código de país), nula por compatibilidad con cuentas
--    existentes que aún no la completaron.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

-- 2) Validación de formato a nivel de base de datos (E.164 aproximado: "+" + 7 a 15
--    dígitos). NOT VALID evita fallar por filas existentes que ya tengan (o no) un
--    valor; a partir de aplicar esta migración, todo INSERT/UPDATE nuevo de `phone`
--    queda validado por Postgres, no solo por el formulario del navegador.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_format_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_format_check
  CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$') NOT VALID;

-- 3) Índice opcional para detectar teléfonos duplicados desde el panel admin.
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone) WHERE phone IS NOT NULL;

-- NOTA: no se agrega NOT NULL a `full_name`/`phone` a propósito. Forzarlo rompería el
-- alta de cuentas (el trigger crea la fila antes de que el cliente pueda hacer el
-- UPDATE con el teléfono) y afectaría cuentas existentes con datos incompletos, cuyo
-- acceso y plan NO deben alterarse. El requisito de "perfil completo" se exige en la
-- capa de aplicación (cdl-portal/dashboard antes de entrar a CDLRadar).
