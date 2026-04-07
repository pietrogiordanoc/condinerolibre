// Edge Function para manejar webhooks de PayPal
// Deploy: supabase functions deploy paypal-webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')!
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET')!
const PAYPAL_WEBHOOK_ID = Deno.env.get('PAYPAL_WEBHOOK_ID')!
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_MODE') === 'live' 
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

// Función para obtener access token de PayPal
async function getPayPalAccessToken() {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })
  const data = await response.json()
  return data.access_token
}

// Función para verificar el webhook de PayPal
async function verifyWebhookSignature(
  webhookId: string,
  headers: Headers,
  body: any
): Promise<boolean> {
  try {
    const token = await getPayPalAccessToken()
    
    const verificationData = {
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: body
    }

    const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(verificationData)
    })

    const result = await response.json()
    return result.verification_status === 'SUCCESS'
  } catch (error) {
    console.error('Error verificando webhook:', error)
    return false
  }
}

serve(async (req) => {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    const eventType = body.event_type

    console.log('Webhook recibido:', eventType)

    // Verificar la firma del webhook (IMPORTANTE para seguridad)
    const isValid = await verifyWebhookSignature(PAYPAL_WEBHOOK_ID, req.headers, body)
    
    if (!isValid) {
      console.error('Firma de webhook inválida')
      return new Response('Unauthorized', { status: 401 })
    }

    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Extraer información del recurso
    const resource = body.resource
    const subscriptionId = resource.id
    const customId = resource.custom_id // aquí deberías pasar el user_id
    
    // Procesar diferentes tipos de eventos
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        console.log('Suscripción activada:', subscriptionId)
        
        // Actualizar el plan del usuario a PRO
        if (customId) {
          const { error } = await supabase
            .from('profiles')
            .update({ 
              plan: 'pro',
              subscription_id: subscriptionId,
              subscription_status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', customId)

          if (error) {
            console.error('Error actualizando perfil:', error)
          } else {
            console.log('Usuario actualizado a PRO:', customId)
          }
        }
        break

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        console.log('Suscripción cancelada (acceso hasta fin del período):', subscriptionId)
        
        // Mantener plan PRO activo hasta que expire el período pagado.
        // PayPal enviará BILLING.SUBSCRIPTION.EXPIRED cuando termine realmente.
        await supabase
          .from('profiles')
          .update({ 
            subscription_status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('subscription_id', subscriptionId)
        break

      case 'BILLING.SUBSCRIPTION.EXPIRED':
        console.log('Suscripción expirada, bajando a FREE:', subscriptionId)
        
        // El período pagado terminó → ahora sí revocar acceso
        await supabase
          .from('profiles')
          .update({ 
            plan: 'free',
            subscription_status: 'expired',
            updated_at: new Date().toISOString()
          })
          .eq('subscription_id', subscriptionId)
        break

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        console.log('Suscripción suspendida (pago fallido repetido):', subscriptionId)
        
        // Suspensión por pagos fallidos → revocar acceso inmediatamente
        await supabase
          .from('profiles')
          .update({ 
            plan: 'free',
            subscription_status: 'suspended',
            updated_at: new Date().toISOString()
          })
          .eq('subscription_id', subscriptionId)
        break

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        console.log('Pago fallido para suscripción:', subscriptionId)
        
        // Marcar como pago fallido
        await supabase
          .from('profiles')
          .update({ 
            subscription_status: 'payment_failed',
            updated_at: new Date().toISOString()
          })
          .eq('subscription_id', subscriptionId)
        break

      case 'BILLING.SUBSCRIPTION.UPDATED':
        console.log('Suscripción actualizada:', subscriptionId)
        
        // Actualizar estado
        await supabase
          .from('profiles')
          .update({ 
            subscription_status: resource.status.toLowerCase(),
            updated_at: new Date().toISOString()
          })
          .eq('subscription_id', subscriptionId)
        break

      case 'PAYMENT.SALE.COMPLETED':
        console.log('Pago completado:', resource.billing_agreement_id)
        
        // Registrar el pago en una tabla de transacciones (opcional)
        await supabase
          .from('payment_transactions')
          .insert({
            subscription_id: resource.billing_agreement_id,
            amount: resource.amount.total,
            currency: resource.amount.currency,
            status: 'completed',
            paypal_transaction_id: resource.id,
            created_at: new Date().toISOString()
          })
        break

      default:
        console.log('Evento no manejado:', eventType)
    }

    // Siempre responder 200 OK a PayPal para confirmar recepción
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error procesando webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
