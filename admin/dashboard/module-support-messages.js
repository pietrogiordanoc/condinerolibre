let SUPPORT_MESSAGES = [];
let SUPPORT_MESSAGE_USERS_BY_ID = new Map();
let supportMessagesRefreshTimer = null;

function scheduleSupportMessagesRefresh() {
  clearTimeout(supportMessagesRefreshTimer);
  supportMessagesRefreshTimer = setTimeout(async () => {
    await refreshSupportMessageAlert();
    const view = document.getElementById('viewSupportMessages');
    if (view && view.style.display !== 'none') await refreshSupportMessages();
  }, 150);
}

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

function supportMessageUserLabel(message) {
  if (!message.user_id) {
    return `<span class="support-message-origin guest">VISITANTE WEB</span>${escapeStudyText(message.guest_name || 'Visitante')}<br><small class="muted">${escapeStudyText(message.guest_email || 'Sin email')}</small>`;
  }
  const user = SUPPORT_MESSAGE_USERS_BY_ID.get(message.user_id);
  if (!user) return message.user_id;
  const name = user.full_name || 'Sin nombre';
  return `<span class="support-message-origin member">USUARIO REGISTRADO</span>${escapeStudyText(name)}<br><small class="muted">${escapeStudyText(user.email || '')}</small>`;
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
  setSupportMessageAlert(SUPPORT_MESSAGES.filter((message) => message.status === 'pending').length);
  renderSupportMessages();
}

function renderSupportMessages() {
  const body = document.getElementById('supportMessagesTbody');
  body.innerHTML = SUPPORT_MESSAGES.length ? SUPPORT_MESSAGES.map((message) => `
    <tr>
      <td>${supportMessageUserLabel(message)}</td>
      <td class="support-message-conversation">
        <div class="support-message-from-user">${escapeStudyText(message.message)}</div>
        ${message.admin_reply ? `<div class="support-message-from-admin"><strong>Tu respuesta · ${formatStudyDate(message.replied_at)}</strong>${escapeStudyText(message.admin_reply)}</div>` : `
          <label class="support-reply-form">
            <span>Responder en el chat</span>
            <textarea id="supportReply-${message.id}" maxlength="3000" placeholder="Escribe una respuesta para el usuario..."></textarea>
            <button class="btn btn-primary" type="button" onclick="replySupportMessage('${message.id}')">Enviar respuesta</button>
          </label>`}
      </td>
      <td>${formatStudyDate(message.created_at)}</td>
      <td><span class="tier-badge ${message.status === 'pending' ? 'tier-freemium' : 'tier-ultra'}">${message.status === 'pending' ? 'Pendiente' : 'Respondido'}</span></td>
      <td><div class="row-actions"><button class="btn btn-danger" onclick="deleteSupportMessage('${message.id}')">Eliminar</button></div></td>
    </tr>`).join('') : '<tr><td colspan="5" class="muted" style="text-align:center; padding:28px;">No hay conversaciones.</td></tr>';
}

window.replySupportMessage = async function(messageId) {
  const message = SUPPORT_MESSAGES.find((item) => item.id === messageId);
  if (!message) return;
  const input = document.getElementById(`supportReply-${messageId}`);
  const adminReply = input.value.trim();
  if (!adminReply) {
    input.focus();
    Toastify({ text: 'Escribe una respuesta antes de enviarla.', duration: 4000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  const { data: { session } } = await sp.auth.getSession();
  if (!session) return;
  input.disabled = true;
  const { error } = await sp.from('user_support_messages').update({
    admin_reply: adminReply,
    replied_at: new Date().toISOString(),
    replied_by: session.user.id,
    status: 'completed',
    completed_at: new Date().toISOString(),
    completed_by: session.user.id
  }).eq('id', messageId);
  if (error) {
    input.disabled = false;
    console.error('No se pudo completar el mensaje de usuario:', error);
    Toastify({ text: `No se pudo enviar la respuesta: ${error.message}`, duration: 7000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  Toastify({ text: 'Respuesta publicada en el Centro de Mensajes.', duration: 3500, backgroundColor: '#10b981' }).showToast();
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

sp.channel('support_messages_changes').on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'user_support_messages'
}, scheduleSupportMessagesRefresh).subscribe((status) => console.log('[Centro de Mensajes] Realtime:', status));
