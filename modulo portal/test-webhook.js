/**
 * Script de prueba para el webhook de PayPal
 * Úsalo para probar localmente o verificar que el webhook funciona
 */

// URL de tu webhook
const WEBHOOK_URL = 'https://yhgqmbexjscojlrzguvh.supabase.co/functions/v1/paypal-webhook';

// Evento de prueba: Suscripción activada
const testEvent = {
  id: 'WH-TEST-12345',
  event_version: '1.0',
  create_time: new Date().toISOString(),
  resource_type: 'subscription',
  event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
  summary: 'Una suscripción fue activada',
  resource: {
    id: 'I-TEST123456789', // Subscription ID de prueba
    plan_id: 'P-8WN86335RL7197925NFXDFTI',
    custom_id: 'user-id-de-prueba-aqui', // Cambia esto por un user_id real de tu DB
    status: 'ACTIVE',
    status_update_time: new Date().toISOString(),
    start_time: new Date().toISOString(),
    subscriber: {
      email_address: 'test@example.com'
    },
    billing_info: {
      outstanding_balance: {
        currency_code: 'USD',
        value: '0.00'
      },
      cycle_executions: [{
        tenure_type: 'REGULAR',
        sequence: 1,
        cycles_completed: 0
      }],
      last_payment: {
        amount: {
          currency_code: 'USD',
          value: '19.99'
        },
        time: new Date().toISOString()
      },
      next_billing_time: new Date(Date.now() + 30*24*60*60*1000).toISOString()
    }
  }
};

console.log('🧪 Probando webhook de PayPal...\n');
console.log('Evento:', testEvent.event_type);
console.log('User ID:', testEvent.resource.custom_id);
console.log('Subscription ID:', testEvent.resource.id);
console.log('\n⚠️  NOTA: Esta es una prueba SIN verificación de firma.');
console.log('En producción, PayPal enviará los headers de firma correctos.\n');

// Enviar el evento al webhook
fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // En producción, PayPal agrega estos headers automáticamente:
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-transmission-id': 'test-transmission-id',
    'paypal-transmission-time': new Date().toISOString(),
    'paypal-transmission-sig': 'test-signature',
    'paypal-cert-url': 'https://api.paypal.com/cert'
  },
  body: JSON.stringify(testEvent)
})
.then(response => {
  console.log('📨 Respuesta del webhook:', response.status, response.statusText);
  return response.json();
})
.then(data => {
  console.log('📦 Datos:', data);
  console.log('\n✅ Webhook respondió correctamente');
})
.catch(error => {
  console.error('❌ Error:', error);
});

// Otros eventos de prueba disponibles:

// Suscripción cancelada
const cancelEvent = {
  ...testEvent,
  event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
  resource: {
    ...testEvent.resource,
    status: 'CANCELLED'
  }
};

// Pago fallido
const paymentFailedEvent = {
  ...testEvent,
  event_type: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  resource: {
    ...testEvent.resource,
    status: 'ACTIVE' // La suscripción sigue activa pero el pago falló
  }
};

// Para probar cancelación, descomenta esto:
// setTimeout(() => {
//   console.log('\n🧪 Probando cancelación...\n');
//   fetch(WEBHOOK_URL, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(cancelEvent)
//   }).then(r => r.json()).then(console.log);
// }, 2000);
