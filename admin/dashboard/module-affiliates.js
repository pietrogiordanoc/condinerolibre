let AFFILIATE_ACCOUNTS = [];
let AFFILIATE_REFERRALS = [];
let AFFILIATE_LEDGER = [];
let AFFILIATE_PAYOUTS = [];

const AFFILIATE_REWARD_CENTS = 1500;

function affiliateEscape(value) {
  return String(value || '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function affiliateMoney(cents) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function affiliateProfileName(userId) {
  const profile = PROFILES.find((item) => item.id === userId || item.user_id === userId);
  return profile?.full_name || profile?.display_name || profile?.name || profile?.email || 'Usuario eliminado';
}

function affiliateProfileEmail(userId) {
  const profile = PROFILES.find((item) => item.id === userId || item.user_id === userId);
  return profile?.email || '—';
}

function affiliateBalanceFor(userId) {
  return AFFILIATE_LEDGER
    .filter((entry) => entry.user_id === userId)
    .reduce((total, entry) => total + entry.amount_cents, 0);
}

function affiliateEarnedFor(userId) {
  return AFFILIATE_LEDGER
    .filter((entry) => entry.user_id === userId && entry.entry_type === 'conversion_credit')
    .reduce((total, entry) => total + entry.amount_cents, 0);
}

async function refreshAffiliates() {
  const [accountsResponse, referralsResponse, ledgerResponse, payoutsResponse] = await Promise.all([
    sp.from('affiliate_accounts').select('*').order('created_at', { ascending: false }),
    sp.from('affiliate_referrals').select('*').order('created_at', { ascending: false }),
    sp.from('affiliate_ledger').select('*').order('created_at', { ascending: false }),
    sp.from('affiliate_payout_requests').select('*').order('requested_at', { ascending: false })
  ]);

  const error = accountsResponse.error || referralsResponse.error || ledgerResponse.error || payoutsResponse.error;
  if (error) {
    const tbody = document.getElementById('affiliateAccountsTbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="padding:24px; color:#fca5a5;">${affiliateEscape(error.message || 'Primero aplica la migración SQL de afiliados en Supabase.')}</td></tr>`;
    return;
  }

  AFFILIATE_ACCOUNTS = accountsResponse.data || [];
  AFFILIATE_REFERRALS = referralsResponse.data || [];
  AFFILIATE_LEDGER = ledgerResponse.data || [];
  AFFILIATE_PAYOUTS = payoutsResponse.data || [];
  renderAffiliateAdmin();
}

function renderAffiliateAdmin() {
  const accountsTbody = document.getElementById('affiliateAccountsTbody');
  const referralsTbody = document.getElementById('affiliateReferralsTbody');
  const payoutsTbody = document.getElementById('affiliatePayoutsTbody');
  if (!accountsTbody || !referralsTbody || !payoutsTbody) return;

  accountsTbody.innerHTML = AFFILIATE_ACCOUNTS.length ? AFFILIATE_ACCOUNTS.map((account) => {
    const referrals = AFFILIATE_REFERRALS.filter((referral) => referral.referrer_user_id === account.user_id);
    const converted = referrals.filter((referral) => referral.status === 'converted').length;
    return `<tr><td><div class="name">${affiliateEscape(affiliateProfileName(account.user_id))}</div><div class="email">${affiliateEscape(affiliateProfileEmail(account.user_id))}</div></td><td><code>${affiliateEscape(account.referral_code)}</code></td><td>${referrals.length}</td><td>${converted}</td><td style="color:#18c36b; font-weight:800;">${affiliateMoney(affiliateBalanceFor(account.user_id))}</td><td>${affiliateMoney(affiliateEarnedFor(account.user_id))}</td></tr>`;
  }).join('') : '<tr><td colspan="6" style="padding:24px; color:#888; text-align:center;">Aún no hay cuentas de afiliado.</td></tr>';

  referralsTbody.innerHTML = AFFILIATE_REFERRALS.length ? AFFILIATE_REFERRALS.map((referral) => {
    const converted = referral.status === 'converted';
    const label = converted ? 'Pro confirmado · $15' : (referral.status === 'void' ? 'Anulado' : 'Registrado · Freemium');
    const action = referral.status === 'registered'
      ? `<button class="btn btn-primary" onclick="confirmAffiliateConversion('${referral.id}')">Acreditar $15</button>`
      : '—';
    return `<tr><td>${affiliateEscape(affiliateProfileName(referral.referrer_user_id))}</td><td>${affiliateEscape(affiliateProfileName(referral.referred_user_id))}</td><td>${new Date(referral.created_at).toLocaleDateString('es-MX')}</td><td style="color:${converted ? '#fbbf24' : '#18c36b'}; font-weight:700;">${label}</td><td>${action}</td></tr>`;
  }).join('') : '<tr><td colspan="5" style="padding:24px; color:#888; text-align:center;">Aún no hay referidos registrados.</td></tr>';

  payoutsTbody.innerHTML = AFFILIATE_PAYOUTS.length ? AFFILIATE_PAYOUTS.map((payout) => {
    const pending = payout.status === 'requested';
    const action = pending
      ? `<button class="btn btn-primary" onclick="markAffiliatePayoutPaid('${payout.id}')">Marcar pagado</button> <button class="btn" onclick="rejectAffiliatePayout('${payout.id}')">Rechazar</button>`
      : '—';
    return `<tr><td>${affiliateEscape(affiliateProfileName(payout.user_id))}</td><td style="font-weight:800;">${affiliateMoney(payout.amount_cents)}</td><td>${affiliateEscape(payout.paypal_email)}</td><td>${new Date(payout.requested_at).toLocaleDateString('es-MX')}</td><td style="color:${pending ? '#fbbf24' : '#18c36b'}; font-weight:700;">${affiliateEscape(payout.status)}</td><td>${action}</td></tr>`;
  }).join('') : '<tr><td colspan="6" style="padding:24px; color:#888; text-align:center;">No hay solicitudes de pago.</td></tr>';
}

function openAffiliateLinkModal() {
  if (!PROFILES.length) {
    Toastify({ text: 'Cargando usuarios. Inténtalo de nuevo.', duration: 2500, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  const options = PROFILES.map((profile) => {
    const id = profile.id || profile.user_id;
    const name = profile.full_name || profile.display_name || profile.name || profile.email;
    return `<option value="${affiliateEscape(id)}">${affiliateEscape(name)} · ${affiliateEscape(profile.email || '')}</option>`;
  }).join('');
  document.getElementById('affiliateReferrerSelect').innerHTML = options;
  document.getElementById('affiliateReferredSelect').innerHTML = options;
  document.getElementById('affiliateLinkModal').style.display = 'flex';
}

function closeAffiliateLinkModal() {
  document.getElementById('affiliateLinkModal').style.display = 'none';
}

async function logAffiliateAdminAction(eventType, metadata) {
  const { data: { session } } = await sp.auth.getSession();
  if (!session) return;
  await sp.from('audit_events').insert({
    user_id: session.user.id,
    event_type: eventType,
    metadata: { admin_user: session.user.email, timestamp: new Date().toISOString(), ...metadata },
    created_at: new Date().toISOString()
  });
}

async function saveAffiliateLink() {
  const referrerId = document.getElementById('affiliateReferrerSelect').value;
  const referredId = document.getElementById('affiliateReferredSelect').value;
  if (referrerId === referredId) {
    Toastify({ text: 'Un usuario no puede referirse a sí mismo.', duration: 3000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  const { error } = await sp.rpc('admin_link_affiliate_referral', { referrer_id: referrerId, referred_id: referredId });
  if (error) {
    Toastify({ text: error.message || 'No se pudo guardar.', duration: 3000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  await logAffiliateAdminAction('Referido vinculado (Admin)', { referrer_id: referrerId, referred_id: referredId });
  closeAffiliateLinkModal();
  await refreshAffiliates();
  Toastify({ text: 'Referido vinculado.', duration: 2000, backgroundColor: '#10b981' }).showToast();
}

async function confirmAffiliateConversion(referralId) {
  if (!confirm(`¿Confirmas esta conversión y acreditas ${affiliateMoney(AFFILIATE_REWARD_CENTS)} al referente?`)) return;
  const { error } = await sp.rpc('admin_confirm_affiliate_conversion', { referral_id_input: referralId });
  if (error) {
    Toastify({ text: error.message || 'No se pudo acreditar.', duration: 3000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  await logAffiliateAdminAction('Conversión de afiliado acreditada', { referral_id: referralId, amount_cents: AFFILIATE_REWARD_CENTS });
  await refreshAffiliates();
  Toastify({ text: 'Conversión acreditada: $15.00.', duration: 2000, backgroundColor: '#10b981' }).showToast();
}

async function markAffiliatePayoutPaid(payoutId) {
  if (!confirm('Confirma solo después de enviar el pago por PayPal.')) return;
  const { error } = await sp.rpc('admin_mark_affiliate_payout_paid', { payout_id_input: payoutId, admin_note_input: 'Pagado manualmente por PayPal' });
  if (error) {
    Toastify({ text: error.message || 'No se pudo marcar el pago.', duration: 3000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  await logAffiliateAdminAction('Retiro de afiliado pagado', { payout_id: payoutId });
  await refreshAffiliates();
  Toastify({ text: 'Pago marcado como realizado.', duration: 2000, backgroundColor: '#10b981' }).showToast();
}

async function rejectAffiliatePayout(payoutId) {
  const note = prompt('Motivo para rechazar el retiro (opcional):') || 'Retiro rechazado por administración';
  const { error } = await sp.rpc('admin_reject_affiliate_payout', { payout_id_input: payoutId, admin_note_input: note });
  if (error) {
    Toastify({ text: error.message || 'No se pudo rechazar el pago.', duration: 3000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  await logAffiliateAdminAction('Retiro de afiliado rechazado', { payout_id: payoutId });
  await refreshAffiliates();
  Toastify({ text: 'Retiro rechazado y saldo restaurado.', duration: 2000, backgroundColor: '#10b981' }).showToast();
}

document.getElementById('linkAffiliateBtn').onclick = openAffiliateLinkModal;
document.getElementById('refreshAffiliatesBtn').onclick = refreshAffiliates;
document.getElementById('saveAffiliateLinkBtn').onclick = saveAffiliateLink;

window.refreshAffiliates = refreshAffiliates;
window.openAffiliateLinkModal = openAffiliateLinkModal;
window.closeAffiliateLinkModal = closeAffiliateLinkModal;
window.confirmAffiliateConversion = confirmAffiliateConversion;
window.markAffiliatePayoutPaid = markAffiliatePayoutPaid;
window.rejectAffiliatePayout = rejectAffiliatePayout;