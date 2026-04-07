# Guía de Configuración del Webhook de PayPal

## 1. Configurar variables de entorno en Supabase

Ve a tu proyecto de Supabase > Project Settings > Edge Functions y añade estas variables secretas:

```bash
PAYPAL_CLIENT_ID=ATeQqFo-1rpKLpkSsABudZfD5nPLEeFEX44Cq84qFkvvDHY8OohSadLVzvjXubX6sqhtwwGPVDyUJ51K
PAYPAL_CLIENT_SECRET=<tu-secret-de-paypal>
PAYPAL_WEBHOOK_ID=<se-genera-después-de-crear-webhook>
PAYPAL_MODE=live
```

**IMPORTANTE:** El `PAYPAL_CLIENT_SECRET` lo obtienes de tu PayPal Dashboard. Según tu imagen, tienes dos apps:
- **Default App** - Client ID: `ATeQqFo-1rpKLpkSsABudZfD5nPLEeFEX44Cq84qFkvvDHY8OohSadLVzvjXubX6sqhtwwGPVDyUJ51K`
- **MyApp_Gumroad_Inc** - Client ID: `BAA6RjscZw_KJEdayiW6q...`

Usa el Secret de la app que corresponda (probablemente "Default App").

## 2. Deploy de la Edge Function

```bash
# Instala Supabase CLI si no lo tienes
npm install -g supabase

# Login
supabase login

# Link a tu proyecto
supabase link --project-ref yhgqmbexjscojlrzguvh

# Deploy la función
supabase functions deploy paypal-webhook --no-verify-jwt
```

**Nota:** Usamos `--no-verify-jwt` porque PayPal no envía tokens JWT, sino firmas propias.

## 3. Obtener la URL del webhook

Después del deploy, tu URL será:
```
https://yhgqmbexjscojlrzguvh.supabase.co/functions/v1/paypal-webhook
```

## 4. Configurar el Webhook en PayPal

### Paso a paso:

1. **Ve a PayPal Developer Dashboard**
   - https://developer.paypal.com/dashboard/applications/live
   - O sandbox: https://developer.paypal.com/dashboard/applications/sandbox

2. **Selecciona tu aplicación** (Default App o MyApp_Gumroad_Inc)

3. **Añade Webhook:**
   - Haz clic en "Add Webhook"
   - **Webhook URL:** `https://yhgqmbexjscojlrzguvh.supabase.co/functions/v1/paypal-webhook`
   
4. **Selecciona los eventos a escuchar:**
   - ✅ `BILLING.SUBSCRIPTION.ACTIVATED`
   - ✅ `BILLING.SUBSCRIPTION.CANCELLED`
   - ✅ `BILLING.SUBSCRIPTION.SUSPENDED`
   - ✅ `BILLING.SUBSCRIPTION.UPDATED`
   - ✅ `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
   - ✅ `PAYMENT.SALE.COMPLETED`

5. **Guarda y copia el Webhook ID**
   - PayPal te dará un ID como: `WH-XXXX-XXXXX`
   - Añádelo a Supabase como variable `PAYPAL_WEBHOOK_ID`

6. **Re-deploy** la función después de añadir el webhook ID:
   ```bash
   supabase functions deploy paypal-webhook --no-verify-jwt
   ```

## 5. Actualizar la base de datos Supabase

Necesitas añadir columnas a tu tabla `profiles`:

```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id 
ON profiles(subscription_id);
```

**Opcional:** Crear tabla de transacciones para historial de pagos:

```sql
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL,
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  status TEXT,
  paypal_transaction_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_transactions_subscription 
ON payment_transactions(subscription_id);
```

## 6. Actualizar el código del frontend

El botón de PayPal debe incluir el `user_id` para vincular la suscripción:

```javascript
paypal.Buttons({
  style: { 
    shape: 'rect', 
    color: 'blue', 
    layout: 'vertical', 
    label: 'subscribe', 
    tagline: false 
  },
  createSubscription: async function(data, actions) {
    // Obtener user_id del usuario actual
    const { data: { session } } = await sp.auth.getSession();
    
    return actions.subscription.create({
      'plan_id': 'P-8WN86335RL7197925NFXDFTI',
      'custom_id': session.user.id, // ← IMPORTANTE: vincular con user_id
      'application_context': { 
        'shipping_preference': 'NO_SHIPPING',
        'user_action': 'SUBSCRIBE_NOW'
      }
    });
  },
  onApprove: async function(data, actions) {
    // Suscripción aprobada
    console.log('Subscription ID:', data.subscriptionID);
    
    // El webhook se encargará de actualizar el plan
    // Pero puedes mostrar un mensaje inmediato
    alert('¡Suscripción activada! Redirigiendo...');
    
    // Esperar 2 segundos para que llegue el webhook
    setTimeout(() => {
      location.reload(); // Recargar para actualizar el plan
    }, 2000);
  },
  onError: function(err) {
    console.error('Error en PayPal:', err);
    alert('Hubo un error procesando el pago. Por favor intenta nuevamente.');
  }
}).render('#paypal-button-container-P-8WN86335RL7197925NFXDFTI');
```

## 7. Probar el Webhook

### Usando PayPal Sandbox (recomendado primero):

1. Cambia el client-id en el SDK a tu sandbox client-id
2. Cambia `PAYPAL_MODE=sandbox` en Supabase
3. Crea una suscripción de prueba
4. Ve a PayPal Developer > Webhooks Simulator para probar eventos

### En producción:

Monitorea los logs de la Edge Function:
```bash
supabase functions logs paypal-webhook
```

## 8. Seguridad

✅ **La verificación de firma está implementada** - El webhook verifica que los eventos vengan realmente de PayPal
✅ **Service Role Key** - La función usa el service role key para actualizar datos sin restricciones RLS
✅ **HTTPS** - Todo el tráfico está encriptado

## Troubleshooting

### El webhook no recibe eventos:
- Verifica que la URL sea accesible públicamente
- Comprueba que los eventos estén seleccionados en PayPal
- Revisa los logs: `supabase functions logs paypal-webhook`

### Error de verificación de firma:
- Verifica que `PAYPAL_CLIENT_SECRET` sea correcto
- Verifica que `PAYPAL_WEBHOOK_ID` sea el correcto
- Comprueba que `PAYPAL_MODE` corresponda (sandbox vs live)

### El plan no se actualiza:
- Verifica que el `custom_id` se esté enviando correctamente
- Comprueba que las columnas existan en la tabla `profiles`
- Revisa los logs de la función

## Resumen del Flujo

1. Usuario hace clic en botón PayPal
2. PayPal procesa la suscripción
3. PayPal envía webhook `BILLING.SUBSCRIPTION.ACTIVATED` a tu función
4. La función verifica la firma y actualiza `profiles.plan = 'pro'`
5. Usuario ve su plan actualizado en el dashboard

---

## Enlaces útiles

- PayPal Developer Dashboard: https://developer.paypal.com/dashboard
- Documentación de Webhooks: https://developer.paypal.com/docs/api-basics/notifications/webhooks/
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
