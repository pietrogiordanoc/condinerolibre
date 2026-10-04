let PLAN_CHANGE_REQUESTS = [];
let PLAN_CHANGE_USERS_BY_ID = new Map();

function setPlanChangeAlert(count) {
  const hasPending = count > 0;
  const banner = document.getElementById('planChangeAlert');
  const badge = document.getElementById('planChangeBadge');
  banner.hidden = !hasPending;
  badge.hidden = !hasPending;
  if (!hasPending) return;
  document.getElementById('planChangeAlertCount').textContent = count;
  badge.textContent = count > 99 ? '99+' : count;
}

async function refreshPlanChangeAlert() {
  const { count, error } = await sp.from('plan_change_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) {
    console.error('No se pudo cargar el contador de cambios de plan pendientes:', error);
    return;
  }
  setPlanChangeAlert(count || 0);
}

function planChangeUserLabel(userId) {
  const user = PLAN_CHANGE_USERS_BY_ID.get(userId);
  if (!user) return userId;
  const name = user.full_name || 'Sin nombre';
  return `${escapeStudyText(name)}<br><small class="muted">${escapeStudyText(user.email || '')}</small>`;
}

async function refreshPlanChanges() {
  const [requestsResponse, usersResponse] = await Promise.all([
    sp.from('plan_change_requests').select('*').eq('status', 'pending').order('requested_at', { ascending: false }),
    sp.from('profiles').select('id, full_name, email')
  ]);
  const error = requestsResponse.error || usersResponse.error;
  if (error) {
    console.error('No se pudieron cargar las solicitudes de cambio de plan:', error);
    Toastify({ text: `No se pudieron cargar las solicitudes: ${error.message}`, duration: 7000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  PLAN_CHANGE_REQUESTS = requestsResponse.data || [];
  PLAN_CHANGE_USERS_BY_ID = new Map((usersResponse.data || []).map((user) => [user.id, user]));
  setPlanChangeAlert(PLAN_CHANGE_REQUESTS.length);
  renderPlanChanges();
}

function renderPlanChanges() {
  const body = document.getElementById('planChangeRequestsTbody');
  body.innerHTML = PLAN_CHANGE_REQUESTS.length ? PLAN_CHANGE_REQUESTS.map((request) => `
    <tr>
      <td>${planChangeUserLabel(request.user_id)}</td>
      <td><strong>CDL Ultra</strong><br><small class="muted">US$19.99 → US$29.99 / mes</small></td>
      <td>${formatStudyDate(request.requested_at)}</td>
      <td><button class="btn btn-primary" onclick="completePlanChangeRequest('${request.id}')">Marcar completada</button></td>
    </tr>`).join('') : '<tr><td colspan="4" class="muted" style="text-align:center; padding:28px;">No hay solicitudes pendientes.</td></tr>';
}

window.completePlanChangeRequest = async function(requestId) {
  const request = PLAN_CHANGE_REQUESTS.find((item) => item.id === requestId);
  if (!request) return;
  if (!window.confirm('Confirma que ya ajustaste la suscripción en PayPal y activaste Classroom para este usuario.')) return;
  const { data: { session } } = await sp.auth.getSession();
  if (!session) return;
  const { error } = await sp.from('plan_change_requests').update({
    status: 'completed',
    processed_at: new Date().toISOString(),
    processed_by: session.user.id
  }).eq('id', requestId);
  if (error) {
    console.error('No se pudo completar la solicitud de cambio de plan:', error);
    Toastify({ text: `No se pudo actualizar la solicitud: ${error.message}`, duration: 7000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  Toastify({ text: 'Solicitud marcada como completada.', duration: 3500, backgroundColor: '#10b981' }).showToast();
  await refreshPlanChanges();
};
