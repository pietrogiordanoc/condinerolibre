window.paypalRendered = false;

window.renderPaypalButtons = function() {
  if (window.paypalRendered) return;
  if (!window.paypal) return;

  window.paypal.Buttons({
    style: { shape: 'rect', color: 'blue', layout: 'vertical', label: 'subscribe', tagline: false },
    createSubscription: async function(data, actions) {
      // Obtener user_id del usuario actual para vincular suscripción
      const { data: { session } } = await window.sp.auth.getSession();
      
      return actions.subscription.create({
        'plan_id': 'P-8WN86335RL7197925NFXDFTI',
        'custom_id': session.user.id, // Vincular con user_id
        'application_context': { 
          'shipping_preference': 'NO_SHIPPING',
          'user_action': 'SUBSCRIBE_NOW'
        }
      });
    },
    onApprove: async function(data, actions) {
      // Suscripción aprobada por el usuario
      console.log('Subscription ID:', data.subscriptionID);
      
      // Mostrar mensaje de éxito
      alert('¡Suscripción activada exitosamente! Tu plan será actualizado en unos momentos.');
      
      // Guardar subscription_id temporalmente en el perfil
      const { data: { session } } = await window.sp.auth.getSession();
      await window.sp.from('profiles').update({ 
        subscription_id: data.subscriptionID 
      }).eq('user_id', session.user.id);
      
      // Esperar 2 segundos para que llegue el webhook y recargar
      setTimeout(() => {
        location.reload();
      }, 2000);
    },
    onError: function(err) {
      console.error('Error en PayPal:', err);
      alert('Hubo un error procesando el pago. Por favor intenta nuevamente o contacta soporte.');
    },
    onCancel: function(data) {
      console.log('Usuario canceló la suscripción');
    }
  }).render('#paypal-button-container-P-8WN86335RL7197925NFXDFTI');
  window.paypalRendered = true;
};

// Listener para el toggle
const togglePlan = document.getElementById("planToggle");
if (togglePlan) {
  togglePlan.onchange = (e) => {
    const isY = e.target.checked;
    document.getElementById("priceDisplay").innerText = isY ? "$199" : "$19.99";
    document.getElementById("periodDisplay").innerText = isY ? "/ año" : "/ mes";
    document.getElementById("paypal-button-container-P-8WN86335RL7197925NFXDFTI").style.display = isY ? "none" : "block";
    document.getElementById("yearly-msg").style.display = isY ? "block" : "none";
  };
}