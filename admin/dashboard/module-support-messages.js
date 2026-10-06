let SUPPORT_MESSAGES = [];
let SUPPORT_MESSAGE_REPLIES_BY_MESSAGE_ID = new Map();
let SUPPORT_MESSAGE_USERS_BY_ID = new Map();
let supportMessagesRefreshTimer = null;
const supportReplyDrafts = new Map();
const supportReplySending = new Set();

function isSupportMessagePending(message) {
  return message.status === 'pending' && !message.admin_reply && !message.conversation_closed_at;
}

function supportConversationKey(message) {
  if (message.user_id) return `user:${message.user_id}`;
  if (message.public_session_id) return `guest-session:${message.public_session_id}`;
  if (message.guest_email) return `guest-email:${message.guest_email.trim().toLowerCase()}`;
  return `message:${message.id}`;
}

function groupSupportMessages(messages) {
  const conversations = new Map();
  messages.forEach((message) => {
    const key = supportConversationKey(message);
    const conversation = conversations.get(key) || { key, messages: [] };
    conversation.messages.push(message);
    conversations.set(key, conversation);
  });
  return Array.from(conversations.values()).map((conversation) => {
    conversation.messages.sort((first, second) => new Date(first.created_at) - new Date(second.created_at));
    conversation.latestMessage = conversation.messages.at(-1);
    conversation.hasPending = conversation.messages.some(isSupportMessagePending);
    conversation.isClosed = conversation.messages.every((message) => Boolean(message.conversation_closed_at));
    return conversation;
  });
}

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
  const { data, error } = await sp.from('user_support_messages')
    .select('id, user_id, guest_email, public_session_id, status, admin_reply, conversation_closed_at');
  if (error) {
    console.error('No se pudo cargar el contador de mensajes de usuarios:', error);
    return;
  }
  setSupportMessageAlert(groupSupportMessages(data || []).filter((conversation) => conversation.hasPending).length);
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
  setSupportMessageAlert(groupSupportMessages(SUPPORT_MESSAGES).filter((conversation) => conversation.hasPending).length);
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
  return groupSupportMessages(SUPPORT_MESSAGES)
    .filter((conversation) => {
      const latestMessage = conversation.latestMessage;
      const profile = latestMessage.user_id ? SUPPORT_MESSAGE_USERS_BY_ID.get(latestMessage.user_id) : null;
      const name = latestMessage.guest_name || profile?.full_name || '';
      const email = latestMessage.guest_email || profile?.email || '';
      const haystack = conversation.messages.map((message) => {
        const replies = SUPPORT_MESSAGE_REPLIES_BY_MESSAGE_ID.get(message.id) || [];
        return `${message.message} ${message.admin_reply || ''} ${replies.map((reply) => reply.message).join(' ')}`;
      }).join(' ').toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesStatus = status === 'all'
        || (status === 'closed' && conversation.isClosed)
        || (status === 'online'
          ? !latestMessage.user_id
            && !conversation.isClosed
            && latestMessage.guest_last_seen_at
            && Date.now() - new Date(latestMessage.guest_last_seen_at).getTime() <= 30000
          : status === 'pending'
            ? conversation.hasPending
            : status !== 'closed' && !conversation.hasPending && !conversation.isClosed);
      const matchesOrigin = origin === 'all' || (origin === 'guest' ? !latestMessage.user_id : !!latestMessage.user_id);
      const matchesDate = !date || conversation.messages.some((message) => message.created_at.slice(0, 10) === date);
      return matchesSearch && matchesStatus && matchesOrigin && matchesDate;
    })
    .sort((first, second) => {
      const pendingOrder = Number(second.hasPending) - Number(first.hasPending);
      return pendingOrder || new Date(second.latestMessage.created_at) - new Date(first.latestMessage.created_at);
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
  list.innerHTML = messages.length ? messages.map((conversation) => {
    const message = conversation.latestMessage;
    const replyTarget = [...conversation.messages].reverse().find((item) => isSupportMessagePending(item)) || message;
    const hasTeamReply = conversation.messages.some((item) => {
      const replies = SUPPORT_MESSAGE_REPLIES_BY_MESSAGE_ID.get(item.id) || [];
      return Boolean(item.admin_reply || replies.length);
    });
    const lastSeen = message.guest_last_seen_at ? new Date(message.guest_last_seen_at) : null;
    const isOnline = lastSeen && Date.now() - lastSeen.getTime() <= 30000;
    const presence = !message.user_id && lastSeen
      ? `<span class="support-chat-presence ${isOnline ? 'online' : ''}">${isOnline ? 'En línea' : `Visto ${formatStudyDate(message.guest_last_seen_at)}`}</span>`
      : '';
    const state = conversation.isClosed ? 'closed' : conversation.hasPending ? 'pending' : 'completed';
    const statusLabel = conversation.isClosed ? 'Conversación terminada' : conversation.hasPending ? 'Pendiente' : 'Respondido';
    const thread = conversation.messages.map((item) => {
      const replies = SUPPORT_MESSAGE_REPLIES_BY_MESSAGE_ID.get(item.id) || [];
      return `
        <div class="support-chat-bubble user">${escapeStudyText(item.message)}<small>${formatStudyDate(item.created_at)}</small></div>
        ${item.admin_reply ? `<div class="support-chat-bubble admin">${escapeStudyText(item.admin_reply)}<small>Equipo CDL · ${formatStudyDate(item.replied_at)}</small></div>` : ''}
        ${replies.map((reply) => `<div class="support-chat-bubble admin">${escapeStudyText(reply.message)}<small>Equipo CDL · ${formatStudyDate(reply.created_at)}</small></div>`).join('')}
      `;
    }).join('');
    return `
    <article class="support-chat-card ${state === 'pending' ? 'is-pending' : 'is-completed'}">
      <header class="support-chat-card-head">
        <div>${supportMessageUserLabel(message)}${presence}</div>
        <span class="support-chat-status ${state === 'pending' ? 'pending' : 'completed'}">${statusLabel}</span>
      </header>
      <div class="support-chat-thread">
        ${thread}
        ${conversation.hasPending && !hasTeamReply ? '<div class="support-chat-empty">Esperando tu respuesta.</div>' : ''}
      </div>
      ${conversation.isClosed ? '<div class="support-chat-closed">El usuario finalizó esta conversación.</div>' : `<label class="support-reply-form">
        <span>${hasTeamReply ? 'Continuar conversación' : 'Responder en el chat'}</span>
        <textarea id="supportReply-${replyTarget.id}" maxlength="3000" placeholder="Escribe una respuesta..."></textarea>
        <button class="btn btn-primary" type="button" onclick="replySupportMessage('${replyTarget.id}')">Enviar respuesta</button>
      </label>`}
      <footer class="support-chat-card-foot"><button class="btn btn-danger" onclick="deleteSupportConversation('${conversation.messages.map((item) => item.id).join(',')}')">Eliminar</button></footer>
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
  if (message.conversation_closed_at) {
    Toastify({ text: 'Esta conversación fue finalizada por el usuario.', duration: 4000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
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

window.deleteSupportConversation = async function(messageIds) {
  const ids = messageIds.split(',').filter(Boolean);
  if (!ids.length) return;
  if (!window.confirm('¿Eliminar esta conversación permanentemente? Esta acción no se puede deshacer.')) return;
  const { error } = await sp.from('user_support_messages').delete().in('id', ids);
  if (error) {
    console.error('No se pudo eliminar la conversación de usuario:', error);
    Toastify({ text: `No se pudo eliminar la conversación: ${error.message}`, duration: 7000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  Toastify({ text: 'Conversación eliminada.', duration: 3000, backgroundColor: '#10b981' }).showToast();
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
