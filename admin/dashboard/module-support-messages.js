let SUPPORT_MESSAGES = [];
let SUPPORT_MESSAGE_USERS_BY_ID = new Map();

function setSupportMessageAlert(count) {
  const hasPending = count > 0;
  const banner = document.getElementById('supportMessageAlert');
  const badge = document.getElementById('supportMessageBadge');
  banner.hidden = !hasPending;
  badge.hidden = !hasPending;
  if (!hasPending) return;
  document.getElementById('supportMessageAlertCount').textContent = count;
  badge.textContent = count > 99 ? '99+' : count;
}

async function refreshSupportMessageAlert() {
  const { count, error } = await sp.from('user_support_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) {
    console.error('No se pudo cargar el contador de mensajes de usuarios:', error);
    return;
  }
  setSupportMessageAlert(count || 0);
}

function supportMessageUserLabel(userId) {
  const user = SUPPORT_MESSAGE_USERS_BY_ID.get(userId);
  if (!user) return userId;
  const name = user.full_name || 'Sin nombre';
  return `${escapeStudyText(name)}<br><small class="muted">${escapeStudyText(user.email || '')}</small>`;
}

async function refreshSupportMessages() {
  const [messagesResponse, usersResponse] = await Promise.all([
    sp.from('user_support_messages').select('*').order('created_at', { ascending: false }),
    sp.from('profiles').select('id, full_name, email')
  ]);
  const error = messagesResponse.error || usersResponse.error;
  if (error) {
    console.error('No se pudieron cargar los mensajes de usuarios:', error);
    Toastify({ text: `No se pudieron cargar los mensajes: ${error.message}`, duration: 7000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  SUPPORT_MESSAGES = messagesResponse.data || [];
  SUPPORT_MESSAGE_USERS_BY_ID = new Map((usersResponse.data || []).map((user) => [user.id, user]));
  setSupportMessageAlert(SUPPORT_MESSAGES.length);
  renderSupportMessages();
}

function renderSupportMessages() {
  const body = document.getElementById('supportMessagesTbody');
  body.innerHTML = SUPPORT_MESSAGES.length ? SUPPORT_MESSAGES.map((message) => `
    <tr>
      <td>${supportMessageUserLabel(message.user_id)}</td>
      <td style="min-width:360px; white-space:pre-wrap;">${escapeStudyText(message.message)}</td>
      <td>${formatStudyDate(message.created_at)}</td>
      <td><span class="tier-badge ${message.status === 'pending' ? 'tier-freemium' : 'tier-ultra'}">${message.status === 'pending' ? 'Pendiente' : 'Respondido'}</span></td>
      <td><div class="row-actions">${message.status === 'pending' ? `<button class="btn btn-primary" onclick="completeSupportMessage('${message.id}')">Email respondido</button>` : ''}<button class="btn btn-danger" onclick="deleteSupportMessage('${message.id}')">Eliminar</button></div></td>
    </tr>`).join('') : '<tr><td colspan="5" class="muted" style="text-align:center; padding:28px;">No hay conversaciones.</td></tr>';
}

window.completeSupportMessage = async function(messageId) {
  const message = SUPPORT_MESSAGES.find((item) => item.id === messageId);
  if (!message) return;
  if (!window.confirm('Confirma que ya respondiste este mensaje por email.')) return;
  const { data: { session } } = await sp.auth.getSession();
  if (!session) return;
  const { error } = await sp.from('user_support_messages').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    completed_by: session.user.id
  }).eq('id', messageId);
  if (error) {
    console.error('No se pudo completar el mensaje de usuario:', error);
    Toastify({ text: `No se pudo actualizar el mensaje: ${error.message}`, duration: 7000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  Toastify({ text: 'Mensaje marcado como respondido por email.', duration: 3500, backgroundColor: '#10b981' }).showToast();
  await refreshSupportMessages();
};

window.deleteSupportMessage = async function(messageId) {
  const message = SUPPORT_MESSAGES.find((item) => item.id === messageId);
  if (!message) return;
  if (!window.confirm('¿Eliminar este mensaje permanentemente? Esta acción no se puede deshacer.')) return;
  const { error } = await sp.from('user_support_messages').delete().eq('id', messageId);
  if (error) {
    console.error('No se pudo eliminar el mensaje de usuario:', error);
    Toastify({ text: `No se pudo eliminar el mensaje: ${error.message}`, duration: 7000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  Toastify({ text: 'Mensaje eliminado.', duration: 3000, backgroundColor: '#10b981' }).showToast();
  await refreshSupportMessages();
};
