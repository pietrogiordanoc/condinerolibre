-- SQL para configurar la base de datos de Supabase
-- Ejecuta estos comandos en: Supabase Dashboard > SQL Editor

-- 1. Añadir columnas a la tabla profiles para manejar suscripciones
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';

-- 2. Crear índice para búsquedas rápidas por subscription_id
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id 
ON profiles(subscription_id);

-- 3. (OPCIONAL) Crear tabla para historial de transacciones de pago
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  status TEXT,
  paypal_transaction_id TEXT UNIQUE,
  event_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Crear índice en payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription 
ON payment_transactions(subscription_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user 
ON payment_transactions(user_id);

-- 5. (OPCIONAL) Crear función para limpiar suscripciones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_subscriptions()
RETURNS void AS $$
BEGIN
  -- Aquí podrías añadir lógica para verificar suscripciones vencidas
  -- Por ahora es un placeholder
  RAISE NOTICE 'Cleanup function ready';
END;
$$ LANGUAGE plpgsql;

-- 6. Verificar que todo esté correctamente configurado
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' 
  AND column_name IN ('subscription_id', 'subscription_status');

-- Deberías ver dos filas con:
-- subscription_id | text | YES
-- subscription_status | text | YES
