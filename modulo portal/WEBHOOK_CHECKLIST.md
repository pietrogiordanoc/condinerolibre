# Configuración del Webhook de PayPal - Lista de Verificación

## ✅ Checklist de Implementación

### 1. Base de Datos
- [ ] Ejecutar SQL en Supabase Dashboard (`supabase/migrations/add_paypal_subscription_columns.sql`)
- [ ] Verificar que las columnas `subscription_id` y `subscription_status` existen en `profiles`
- [ ] (Opcional) Crear tabla `payment_transactions` para historial

### 2. Variables de Entorno en Supabase
- [ ] Ir a: Supabase Dashboard > Project Settings > Edge Functions
- [ ] Añadir `PAYPAL_CLIENT_ID` (de tu imagen: `ATeQqFo-1rpKLpkSsABudZfD5nPLEeFEX44Cq84qFkvvDHY8OohSadLVzvjXubX6sqhtwwGPVDyUJ51K`)
- [ ] Añadir `PAYPAL_CLIENT_SECRET` (obtenerlo de PayPal Dashboard > Default App > Show)
- [ ] Añadir `PAYPAL_MODE=live` (o `sandbox` para pruebas)
- [ ] Añadir `PAYPAL_WEBHOOK_ID` (se genera después de crear el webhook en PayPal)

### 3. Deploy Edge Function
```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Link a tu proyecto
supabase link --project-ref yhgqmbexjscojlrzguvh

# Deploy
supabase functions deploy paypal-webhook --no-verify-jwt
```

### 4. Configurar Webhook en PayPal
- [ ] Ir a: https://developer.paypal.com/dashboard/applications/live
- [ ] Seleccionar tu app (Default App)
- [ ] Click "Add Webhook"
- [ ] URL: `https://yhgqmbexjscojlrzguvh.supabase.co/functions/v1/paypal-webhook`
- [ ] Seleccionar eventos:
  - [x] `BILLING.SUBSCRIPTION.ACTIVATED`
  - [x] `BILLING.SUBSCRIPTION.CANCELLED`
  - [x] `BILLING.SUBSCRIPTION.SUSPENDED`
  - [x] `BILLING.SUBSCRIPTION.UPDATED`
  - [x] `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
  - [x] `PAYMENT.SALE.COMPLETED`
- [ ] Guardar y copiar el **Webhook ID**
- [ ] Añadir `PAYPAL_WEBHOOK_ID` a Supabase
- [ ] Re-deploy la función

### 5. Actualizar Frontend
- [x] ✅ Código actualizado en `cdl-portal/dashboard/index.html`
- [x] ✅ Código actualizado en `cdl-portal/module-upgrade.js`
- [ ] Verificar que `sp` (cliente de Supabase) esté disponible globalmente
- [ ] Probar el botón de PayPal en el dashboard

### 6. Probar
- [ ] Crear suscripción de prueba
- [ ] Verificar logs: `supabase functions logs paypal-webhook`
- [ ] Confirmar que el plan se actualiza en la base de datos
- [ ] Probar cancelación de suscripción

---

## 🚀 Comandos Rápidos

```bash
# Ver logs en tiempo real
supabase functions logs paypal-webhook --follow

# Test local (necesita configurar .env)
cd supabase/functions/paypal-webhook
deno run --allow-net --allow-env index.ts

# Probar webhook (después de deploy)
node test-webhook.js
```

---

## 🔍 Donde obtener cada valor

### PAYPAL_CLIENT_ID
📍 Captura de pantalla 1: `ATeQqFo-1rpKLpkSsABudZfD5nPLEeFEX44Cq84qFkvvDHY8OohSadLVzvjXubX6sqhtwwGPVDyUJ51K`

### PAYPAL_CLIENT_SECRET
📍 PayPal Developer Dashboard > Default App > "Show" bajo Secret

### PAYPAL_WEBHOOK_ID
📍 Se genera al crear el webhook en PayPal (formato: `WH-XXXXX-XXXXX`)

### Supabase Project Ref
📍 Ya tienes: `yhgqmbexjscojlrzguvh`

---

## 📊 Flujo Completo

```
Usuario → Click en PayPal → PayPal procesa → Webhook enviado
                                                    ↓
                                          Edge Function verifica
                                                    ↓
                                          Actualiza profiles.plan
                                                    ↓
                                          Usuario ve plan PRO
```

---

## 🆘 Soporte

Si tienes problemas:
1. Revisa `PAYPAL_WEBHOOK_SETUP.md` para detalles completos
2. Verifica logs: `supabase functions logs paypal-webhook`
3. Usa el simulador de webhooks de PayPal para testing
4. Verifica que las variables de entorno estén correctas

---

## 📝 Notas Importantes

⚠️ **Seguridad:** El webhook verifica la firma de PayPal antes de procesar eventos
⚠️ **Custom ID:** El `user_id` se envía como `custom_id` para vincular suscripciones
⚠️ **No JWT:** El webhook usa `--no-verify-jwt` porque PayPal no envía JWT
⚠️ **Service Role:** La función necesita el `SUPABASE_SERVICE_ROLE_KEY` (ya configurado automáticamente)
