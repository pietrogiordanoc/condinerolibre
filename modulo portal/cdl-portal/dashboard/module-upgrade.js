window.paypalRendered = false;

window.renderPaypalButtons = function() {
  if (window.paypalRendered) return;
  paypal.Buttons({
    style: { shape: 'rect', color: 'blue', layout: 'vertical', label: 'subscribe', tagline: false },
    createSubscription: function(data, actions) {
      return actions.subscription.create({
        'plan_id': 'P-8WN86335RL7197925NFXDFTI',
        'application_context': { 'shipping_preference': 'NO_SHIPPING' }
      });
    }
  }).render('#paypal-button-container-P-8WN86335RL7197925NFXDFTI');
  window.paypalRendered = true;
};

document.getElementById("planToggle").onchange = (e) => {
  const isY = e.target.checked;
  document.getElementById("priceDisplay").innerText = isY ? "$199" : "$19.99";
  document.getElementById("periodDisplay").innerText = isY ? "/ año" : "/ mes";
  document.getElementById("paypal-button-container-P-8WN86335RL7197925NFXDFTI").style.display = isY ? "none" : "block";
  document.getElementById("yearly-msg").style.display = isY ? "block" : "none";
};