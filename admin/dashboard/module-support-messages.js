let SUPPORT_MESSAGES = [];
let SUPPORT_MESSAGE_REPLIES_BY_MESSAGE_ID = new Map();
let SUPPORT_MESSAGE_USERS_BY_ID = new Map();
let supportMessagesRefreshTimer = null;
const supportReplyDrafts = new Map();
const supportReplySending = new Set();

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
  const [messagesResponse, usersResponse, repliesResponse] = await Promise.all([
    sp.from('user_support_messages').select('*').order('created_at', { ascending: false }),
    sp.from('profiles').select('id, full_name, email'),
    sp.from('user_support_message_chat_replies').select('support_message_id, message, created_at').order('created_at', { ascending: true })
  ]);
  const error = messagesResponse.error || usersResponse.error || repliesResponse.error;
  if (error) {
    console.error('No se pudieron cargar los mensajes de usuarios:', error);
    Toastify({ text: `No se pudieron cargar los mensajes: ${error.message}`, duration: 7000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  SUPPORT_MESSAGES = messagesResponse.data || [];
  SUPPORT_MESSAGE_REPLIES_BY_MESSAGE_ID = new Map();
  (repliesResponse.data || []).forEach((reply) => {
    const replies = SUPPORT_MESSAGE_REPLIES_BY_MESSAGE_ID.get(reply.support_message_id) || [];
    replies.push(reply);
    SUPPORT_MESSAGE_REPLIES_BY_MESSAGE_ID.set(reply.support_message_id, replies);
  });
  SUPPORT_MESSAGE_USERS_BY_ID = new Map((usersResponse.data || []).map((user) => [user.id, user]));
  setSupportMessageAlert(SUPPORT_MESSAGES.filter((message) => message.status === 'pending').length);
  renderSupportMessages();
}

function supportMessageFilterValue(id) {
  return document.getElementById(id)?.value || '';
}

function visibleSupportMessages() {
  const search = supportMessageFilterValue('supportMessageSearch').trim().toLowerCase();
  const status = supportMessageFilterValue('supportMessageStatusFilter') || 'online';
  const origin = supportMessageFilterValue('supportMessageOriginFilter') || 'all';
  const date = supportMessageFilterValue('supportMessageDateFilter');
  return SUPPORT_MESSAGES
    .filter((message) => {
      const profile = message.user_id ? SUPPORT_MESSAGE_USERS_BY_ID.get(message.user_id) : null;
      const name = message.guest_name || profile?.full_name || '';
      const email = message.guest_email || profile?.email || '';
      const haystack = `${name} ${email} ${message.message} ${message.admin_reply || ''}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesStatus = status === 'all'
        || (status === 'online'
          ? !message.user_id
            && message.guest_last_seen_at
            && Date.now() - new Date(message.guest_last_seen_at).getTime() <= 30000
          : message.status === status);
      const matchesOrigin = origin === 'all' || (origin === 'guest' ? !message.user_id : !!message.user_id);
      const matchesDate = !date || message.created_at.slice(0, 10) === date;
      return matchesSearch && matchesStatus && matchesOrigin && matchesDate;
    })
    .sort((first, second) => {
      const pendingOrder = Number(second.status === 'pending') - Number(first.status === 'pending');
      return pendingOrder || new Date(second.created_at) - new Date(first.created_at);
    });
}

function renderSupportMessages() {
  const list = document.getElementById('supportMessagesList');
  const messages = visibleSupportMessages();
  const activeReply = document.activeElement?.matches('.support-reply-form textarea') ? document.activeElement : null;
  const activeReplyId = activeReply?.id || '';
  const activeSelectionStart = activeReply?.selectionStart;
  const activeSelectionEnd = activeReply?.selectionEnd;
  list.querySelectorAll('.support-reply-form textarea').forEach((input) => {
    const messageId = input.id.replace('supportReply-', '');
    if (!supportReplySending.has(messageId)) supportReplyDrafts.set(input.id, input.value);
  });
  list.innerHTML = messages.length ? messages.map((message) => {
    const replies = SUPPORT_MESSAGE_REPLIES_BY_MESSAGE_ID.get(message.id) || [];
    const hasTeamReply = Boolean(message.admin_reply || replies.length);
    const lastSeen = message.guest_last_seen_at ? new Date(message.guest_last_seen_at) : null;
    const isOnline = lastSeen && Date.now() - lastSeen.getTime() <= 30000;
    const presence = !message.user_id && lastSeen
      ? `<span class="support-chat-presence ${isOnline ? 'online' : ''}">${isOnline ? 'En línea' : `Visto ${formatStudyDate(message.guest_last_seen_at)}`}</span>`
      : '';
    return `
    <article class="support-chat-card ${message.status === 'pending' ? 'is-pending' : 'is-completed'}">
      <header class="support-chat-card-head">
        <div>${supportMessageUserLabel(message)}${presence}</div>
        <span class="support-chat-status ${message.status === 'pending' ? 'pending' : 'completed'}">${message.status === 'pending' ? 'Pendiente' : 'Respondido'}</span>
      </header>
      <div class="support-chat-thread">
        <div class="support-chat-bubble user">${escapeStudyText(message.message)}<small>${formatStudyDate(message.created_at)}</small></div>
        ${message.admin_reply ? `<div class="support-chat-bubble admin">${escapeStudyText(message.admin_reply)}<small>Equipo CDL · ${formatStudyDate(message.replied_at)}</small></div>` : ''}
        ${replies.map((reply) => `<div class="support-chat-bubble admin">${escapeStudyText(reply.message)}<small>Equipo CDL · ${formatStudyDate(reply.created_at)}</small></div>`).join('')}
        ${hasTeamReply ? '' : '<div class="support-chat-empty">Esperando tu respuesta.</div>'}
      </div>
      <label class="support-reply-form">
        <span>${hasTeamReply ? 'Continuar conversación' : 'Responder en el chat'}</span>
        <textarea id="supportReply-${message.id}" maxlength="3000" placeholder="Escribe una respuesta..."></textarea>
        <button class="btn btn-primary" type="button" onclick="replySupportMessage('${message.id}')">Enviar respuesta</button>
      </label>
      <footer class="support-chat-card-foot"><button class="btn btn-danger" onclick="deleteSupportMessage('${message.id}')">Eliminar</button></footer>
    </article>`;
  }).join('') : '<div class="support-messages-empty">No hay conversaciones que coincidan con estos filtros.</div>';
  supportReplyDrafts.forEach((value, id) => {
    const input = document.getElementById(id);
    if (input) input.value = value;
  });
  if (activeReplyId && !supportReplySending.has(activeReplyId.replace('supportReply-', ''))) {
    const input = document.getElementById(activeReplyId);
    if (input) {
      input.focus();
      input.setSelectionRange(activeSelectionStart, activeSelectionEnd);
    }
  }
}

window.replySupportMessage = async function(messageId) {
  const message = SUPPORT_MESSAGES.find((item) => item.id === messageId);
  if (!message || supportReplySending.has(messageId)) return;
  const input = document.getElementById(`supportReply-${messageId}`);
  const adminReply = input.value.trim();
  if (!adminReply) {
    input.focus();
    Toastify({ text: 'Escribe una respuesta antes de enviarla.', duration: 4000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  supportReplySending.add(messageId);
  supportReplyDrafts.delete(input.id);
  input.disabled = true;
  input.closest('.support-reply-form').querySelector('button').disabled = true;
  let sendFailed = false;
  try {
    const { data: { session } } = await sp.auth.getSession();
    if (!session) throw new Error('Sesión no disponible.');
    const { error } = message.admin_reply
      ? await sp.from('user_support_message_chat_replies').insert({
        support_message_id: messageId,
        message: adminReply,
        created_by: session.user.id
      })
      : await sp.from('user_support_messages').update({
        admin_reply: adminReply,
        replied_at: new Date().toISOString(),
        replied_by: session.user.id,
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: session.user.id
      }).eq('id', messageId);
    if (error) throw error;
    Toastify({ text: 'Respuesta publicada en el Centro de Mensajes.', duration: 3500, backgroundColor: '#10b981' }).showToast();
    await refreshSupportMessages();
  } catch (error) {
    sendFailed = true;
    supportReplyDrafts.set(input.id, adminReply);
    console.error('No se pudo completar el mensaje de usuario:', error);
    Toastify({ text: `No se pudo enviar la respuesta: ${error.message}`, duration: 7000, backgroundColor: '#e74c3c' }).showToast();
  } finally {
    supportReplySending.delete(messageId);
    if (sendFailed) renderSupportMessages();
  }
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
}, scheduleSupportMessagesRefresh).on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'user_support_message_chat_replies'
}, scheduleSupportMessagesRefresh).subscribe((status) => console.log('[Centro de Mensajes] Realtime:', status));

['supportMessageSearch', 'supportMessageStatusFilter', 'supportMessageOriginFilter', 'supportMessageDateFilter']
  .forEach((id) => document.getElementById(id)?.addEventListener(id === 'supportMessageSearch' ? 'input' : 'change', renderSupportMessages));
