function startPaymentAlert(client, userId) {
  const banner = document.getElementById('paymentAlert');
  const message = document.getElementById('paymentAlertText');
  let loading = false;

  async function refreshPaymentAlert() {
    if (loading) return;
    loading = true;
    try {
      const { data, error } = await client.from('manual_payment_alerts')
        .select('message, active').eq('user_id', userId).maybeSingle();
      if (error) {
        console.error('No se pudo cargar el aviso de pago:', error);
        return;
      }
      message.textContent = data?.active ? data.message : '';
      banner.hidden = !data?.active;
    } finally {
      loading = false;
    }
  }

  refreshPaymentAlert().catch((error) => console.error('No se pudo cargar el aviso de pago:', error));
  setInterval(() => {
    refreshPaymentAlert().catch((error) => console.error('No se pudo cargar el aviso de pago:', error));
  }, 30000);
}
