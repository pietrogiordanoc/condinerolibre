let paymentAlertUserId = null;
let paymentAlertActive = false;
let paymentAlertBusy = false;
let paymentAlertRequest = 0;
const paymentAlertDefaultMessage = 'No pudimos procesar tu pago. Revisa tu método de pago en PayPal para evitar una posible interrupción del servicio.';

async function openPaymentAlertModal(userId) {
  const user = PROFILES.find((profile) => profile.id === userId);
  if (!user) return;

  paymentAlertUserId = userId;
  const request = ++paymentAlertRequest;
  document.getElementById('paymentAlertUser').textContent = user.full_name || user.display_name || user.email;
  document.getElementById('paymentAlertMessage').value = '';
  document.getElementById('paymentAlertStatus').textContent = 'Cargando aviso...';
  document.getElementById('savePaymentAlertBtn').disabled = true;
  document.getElementById('disablePaymentAlertBtn').disabled = true;
  document.getElementById('modalPaymentAlert').style.display = 'flex';

  try {
    const { data, error } = await sp.from('manual_payment_alerts')
      .select('message, active').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (request !== paymentAlertRequest) return;
    paymentAlertActive = Boolean(data?.active);
    document.getElementById('paymentAlertMessage').value = data?.message || paymentAlertDefaultMessage;
    document.getElementById('paymentAlertStatus').textContent = paymentAlertActive ? 'Aviso activo' : 'Aviso desactivado';
    document.getElementById('savePaymentAlertBtn').disabled = false;
    document.getElementById('disablePaymentAlertBtn').disabled = !paymentAlertActive;
  } catch (error) {
    if (request !== paymentAlertRequest) return;
    console.error('No se pudo cargar el aviso de pago:', error);
    document.getElementById('paymentAlertStatus').textContent = 'No se pudo cargar el aviso. Cierra y vuelve a intentarlo.';
  }
}

function closePaymentAlertModal() {
  if (paymentAlertBusy) return;
  paymentAlertUserId = null;
  paymentAlertRequest++;
  document.getElementById('modalPaymentAlert').style.display = 'none';
}

async function savePaymentAlert(active) {
  const userId = paymentAlertUserId;
  if (!userId || paymentAlertBusy) return;
  const message = document.getElementById('paymentAlertMessage').value.trim();
  if (active && !message) {
    document.getElementById('paymentAlertStatus').textContent = 'Escribe un mensaje para el usuario.';
    return;
  }

  const saveButton = document.getElementById('savePaymentAlertBtn');
  const disableButton = document.getElementById('disablePaymentAlertBtn');
  paymentAlertBusy = true;
  saveButton.disabled = true;
  disableButton.disabled = true;
  try {
    const { data: { session }, error: sessionError } = await sp.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('La sesión expiró. Vuelve a iniciar sesión.');

    const updated = { active, updated_at: new Date().toISOString(), updated_by: session.user.id };
    if (active) {
      const { error } = await sp.from('manual_payment_alerts').upsert({
        user_id: userId, message, ...updated
      }, { onConflict: 'user_id' });
      if (error) throw error;
    } else {
      const { data, error } = await sp.from('manual_payment_alerts')
        .update(updated).eq('user_id', userId).select('user_id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No se encontró el aviso de este usuario.');
    }

    paymentAlertActive = active;
    document.getElementById('paymentAlertStatus').textContent = active ? 'Aviso activo' : 'Aviso desactivado';
    Toastify({ text: active ? 'Aviso de pago activado' : 'Aviso de pago desactivado', duration: 3000, backgroundColor: '#10b981' }).showToast();
  } catch (error) {
    console.error('No se pudo guardar el aviso de pago:', error);
    document.getElementById('paymentAlertStatus').textContent = `No se pudo guardar el aviso: ${error.message || error}`;
  } finally {
    paymentAlertBusy = false;
    saveButton.disabled = false;
    disableButton.disabled = !paymentAlertActive;
  }
}

document.getElementById('savePaymentAlertBtn').onclick = () => savePaymentAlert(true);
document.getElementById('disablePaymentAlertBtn').onclick = () => savePaymentAlert(false);
