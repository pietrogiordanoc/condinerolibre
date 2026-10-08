(function () {
  "use strict";

  var endpoint = "https://yhgqmbexjscojlrzguvh.supabase.co/functions/v1/submit-public-support-message";
  var storageKey = "cdl_public_support_chat";
  var timeoutMs = 10 * 60 * 1000;
  var state = { contact: null, messages: [], replies: [], closed: false, timer: null, hasLoadedThread: false, teamResponseIds: new Set(), audioContext: null };

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && saved.sessionId && saved.name && saved.email) state.contact = saved;
    } catch (error) {}
  }

  function saveState() {
    try { localStorage.setItem(storageKey, JSON.stringify(state.contact)); } catch (error) {}
  }

  function formatTime(value) {
    return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  }

  function enableIncomingSound() {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!state.audioContext) state.audioContext = new AudioContext();
    if (state.audioContext.state === "suspended") state.audioContext.resume().catch(function () {});
  }

  function playIncomingSound() {
    if (!state.audioContext || state.audioContext.state !== "running") return;
    var oscillator = state.audioContext.createOscillator();
    var gain = state.audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, state.audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1040, state.audioContext.currentTime + 0.17);
    gain.gain.setValueAtTime(0.0001, state.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.24, state.audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, state.audioContext.currentTime + 0.36);
    oscillator.connect(gain);
    gain.connect(state.audioContext.destination);
    oscillator.start();
    oscillator.stop(state.audioContext.currentTime + 0.38);
  }

  function notifyIncomingResponse(wrapper) {
    var panel = wrapper.querySelector(".cdl-public-support-panel");
    var toggle = wrapper.querySelector(".cdl-public-support-toggle");
    var notificationTarget = panel.hidden ? toggle : panel;
    notificationTarget.classList.remove("cdl-public-new-message");
    void notificationTarget.offsetWidth;
    notificationTarget.classList.add("cdl-public-new-message");
    setTimeout(function () { notificationTarget.classList.remove("cdl-public-new-message"); }, 1200);
  }

  function updateIncomingSound(data, wrapper) {
    var responseIds = new Set();
    (data.messages || []).forEach(function (item) {
      if (item.admin_reply && item.replied_at) responseIds.add("legacy:" + item.id + ":" + item.replied_at);
    });
    (data.replies || []).forEach(function (reply) {
      responseIds.add("reply:" + reply.id);
    });
    var hasNewResponse = state.hasLoadedThread && Array.from(responseIds).some(function (id) {
      return !state.teamResponseIds.has(id);
    });
    state.teamResponseIds = responseIds;
    state.hasLoadedThread = true;
    if (hasNewResponse) {
      notifyIncomingResponse(wrapper);
      playIncomingSound();
    }
  }

  function sendRequest(payload) {
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || "No pudimos procesar tu mensaje.");
        return data;
      });
    });
  }

  function buildEvents() {
    var events = [];
    state.messages.forEach(function (item) {
      events.push({ kind: "visitor", text: item.message, at: item.created_at });
      if (item.admin_reply && item.replied_at) {
        events.push({ kind: "team", text: item.admin_reply, at: item.replied_at });
      }
      state.replies.filter(function (reply) { return reply.support_message_id === item.id; }).forEach(function (reply) {
        events.push({ kind: "team", text: reply.message, at: reply.created_at });
      });
      if (state.closed) {
        events.push({ kind: "system", text: "Esta conversación fue finalizada. Gracias por contactarnos.", at: new Date().toISOString() });
      }
      if (!item.admin_reply && !state.replies.some(function (reply) { return reply.support_message_id === item.id; }) && Date.now() - new Date(item.created_at).getTime() >= timeoutMs) {
        events.push({
          kind: "system",
          text: "Lamentamos no poder atenderte en este momento. Nuestro equipo está ocupado; te responderemos por email a la brevedad posible.",
          at: item.created_at
        });
      } else {
        events.push({
          kind: "system",
          text: "Estamos buscando un asistente humano para atenderte. Mantén este chat abierto.",
          at: item.created_at
        });
      }
    });
    return events.sort(function (first, second) { return new Date(first.at) - new Date(second.at); });
  }

  function renderThread(wrapper) {
    var thread = wrapper.querySelector(".cdl-public-support-thread");
    if (!thread) return;
    var intro = '<div class="cdl-public-bubble cdl-public-team"><strong>Equipo ConDineroLibre</strong>Hola, gracias por escribirnos. Bienvenido al chat de ConDineroLibre.</div>';
    thread.innerHTML = intro + buildEvents().map(function (event) {
      if (event.kind === "system") {
        return '<div class="cdl-public-system">' + escapeHtml(event.text) + '</div>';
      }
      var className = event.kind === "visitor" ? "cdl-public-visitor" : "cdl-public-team";
      var label = event.kind === "visitor" ? "Tú" : "Equipo CDL";
      return '<div class="cdl-public-bubble ' + className + '">' + escapeHtml(event.text) + '<small>' + label + ' · ' + formatTime(event.at) + '</small></div>';
    }).join("");
    var compose = wrapper.querySelector(".cdl-public-compose");
    var closeButton = wrapper.querySelector(".cdl-public-close");
    if (compose) {
      compose.elements.message.disabled = state.closed;
      compose.querySelector(".cdl-public-send").disabled = state.closed;
    }
    if (closeButton) closeButton.hidden = state.closed || !state.messages.length;
    thread.scrollTop = thread.scrollHeight;
  }

  function showChat(wrapper) {
    wrapper.querySelector(".cdl-public-intake").hidden = true;
    wrapper.querySelector(".cdl-public-chat").hidden = false;
    renderThread(wrapper);
  }

  function loadThread(wrapper) {
    if (!state.contact) return Promise.resolve();
    return sendRequest({ action: "thread", sessionId: state.contact.sessionId }).then(function (data) {
      updateIncomingSound(data, wrapper);
      state.messages = data.messages || [];
      state.replies = data.replies || [];
      state.closed = state.messages.some(function (item) { return Boolean(item.conversation_closed_at); });
      renderThread(wrapper);
    }).catch(function (error) {
      console.error("No se pudo actualizar el chat público:", error);
    });
  }

  function startPolling(wrapper) {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(function () {
      if (!document.hidden) loadThread(wrapper);
      else renderThread(wrapper);
    }, 8000);
  }

  function createWidget() {
    if (document.getElementById("cdl-public-support")) return;
    loadState();
    var wrapper = document.createElement("section");
    wrapper.id = "cdl-public-support";
    wrapper.innerHTML =
      '<style>' +
      '#cdl-public-support{position:fixed;right:22px;bottom:22px;z-index:99999;font-family:Arial,sans-serif}#cdl-public-support *{box-sizing:border-box}#cdl-public-support [hidden]{display:none!important}' +
      '.cdl-public-support-panel{width:min(380px,calc(100vw - 28px));height:min(540px,calc(100vh - 48px));display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;border:1px solid rgba(42,255,138,.42);border-radius:16px;background:#e9e6dd;box-shadow:0 24px 64px rgba(0,0,0,.42)}.cdl-public-support-panel.cdl-public-new-message,.cdl-public-support-toggle.cdl-public-new-message{animation:cdl-public-new-message 1.2s ease-out}@keyframes cdl-public-new-message{0%,45%{box-shadow:0 0 0 4px rgba(37,167,104,.8),0 24px 64px rgba(0,0,0,.42)}100%{box-shadow:0 24px 64px rgba(0,0,0,.42)}}.cdl-public-support-head{display:flex;justify-content:space-between;gap:12px;padding:15px 16px;background:linear-gradient(135deg,#087c4d,#1fac6c);color:#fff}.cdl-public-support-head strong{display:block;font-size:16px;font-weight:600}.cdl-public-head-actions{display:flex;align-items:flex-start;gap:4px}.cdl-public-head-actions button{width:25px;height:25px;border:0;border-radius:6px;background:rgba(255,255,255,.12);color:#fff;font:500 19px/1 Arial,sans-serif;cursor:pointer}.cdl-public-head-actions button:hover{background:rgba(255,255,255,.24)}' +
      '.cdl-public-intake,.cdl-public-compose{display:grid;gap:10px;padding:14px;background-color:#e9e6dd;background-image:radial-gradient(rgba(78,92,90,.22) .7px,transparent .7px);background-size:14px 14px}.cdl-public-intake{align-content:center}.cdl-public-intake label{display:grid;gap:5px;color:#496057;font-size:11px}.cdl-public-intake input,.cdl-public-compose textarea{width:100%;border:1px solid #d1dad5;border-radius:8px;background:#fff;color:#20342b;padding:10px;font:inherit;font-size:13px}.cdl-public-compose{grid-template-columns:minmax(0,1fr) auto;background:#fff;border-top:1px solid rgba(0,0,0,.08)}.cdl-public-compose textarea{min-height:44px;max-height:96px;resize:vertical}.cdl-public-send{align-self:end;border:0;border-radius:8px;background:#25a768;color:#fff;padding:11px 13px;font:600 12px Arial,sans-serif;cursor:pointer}.cdl-public-send:disabled{opacity:.6;cursor:wait}.cdl-public-intake input:focus,.cdl-public-compose textarea:focus{outline:2px solid rgba(37,167,104,.25);border-color:#25a768}' +
      '.cdl-public-chat{display:grid;grid-template-rows:minmax(0,1fr) auto;min-height:0}.cdl-public-support-thread{display:flex;flex-direction:column;gap:10px;min-height:0;overflow-y:auto;padding:14px;background-color:#e9e6dd;background-image:radial-gradient(rgba(78,92,90,.22) .7px,transparent .7px);background-size:14px 14px;scrollbar-width:thin;scrollbar-color:rgba(19,139,84,.48) transparent}.cdl-public-support-thread::-webkit-scrollbar{width:7px}.cdl-public-support-thread::-webkit-scrollbar-thumb{border:2px solid transparent;border-radius:999px;background:rgba(19,139,84,.48);background-clip:padding-box}.cdl-public-bubble{max-width:88%;padding:10px 12px 8px;border-radius:11px;font-size:12px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 2px 8px rgba(0,0,0,.1)}.cdl-public-bubble strong{display:block;margin-bottom:3px;font-size:11px}.cdl-public-bubble small{display:block;margin-top:5px;color:#5f756b;font-size:10px;text-align:right}.cdl-public-visitor{align-self:flex-end;border-radius:11px 11px 3px 11px;background:#c8f3db;color:#17362a}.cdl-public-team{align-self:flex-start;border-radius:11px 11px 11px 3px;background:#fff;color:#24332d}.cdl-public-team strong{color:#087c4d}.cdl-public-system{align-self:center;max-width:90%;border-radius:8px;background:rgba(255,248,195,.85);color:#5e5424;padding:7px 9px;font-size:10.5px;line-height:1.4;text-align:center}' +
      '.cdl-public-status{grid-column:1/-1;min-height:15px;margin:0;color:#5d7168;font-size:10px}.cdl-public-status.error{color:#bd3b35}.cdl-public-status.success{color:#087c4d}.cdl-public-support-toggle{margin:12px 0 0 auto;display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.28);border-radius:10px;background:#1ba465;color:#fff;padding:12px 15px;box-shadow:0 12px 28px rgba(20,135,80,.34);font:600 12px Arial,sans-serif;cursor:pointer}.cdl-public-support-toggle:before{content:"";width:8px;height:8px;border-radius:50%;background:#d7ffea;box-shadow:0 0 0 3px rgba(215,255,234,.15)}.cdl-public-honeypot{position:absolute!important;left:-9999px!important;opacity:0!important}@media(max-width:600px){#cdl-public-support{right:14px;bottom:14px}.cdl-public-support-panel{width:calc(100vw - 28px)}}' +
      '</style>' +
      '<div class="cdl-public-support-panel" hidden><div class="cdl-public-support-head"><div><strong>Centro de Mensajes</strong><span>Habla con el equipo de ConDineroLibre.</span></div><div class="cdl-public-head-actions"><button class="cdl-public-minimize" type="button" aria-label="Minimizar chat" title="Minimizar">&minus;</button><button class="cdl-public-close" type="button" aria-label="Terminar conversación" title="Terminar conversación" hidden>&times;</button></div></div>' +
      '<form class="cdl-public-intake"><div class="cdl-public-bubble cdl-public-team"><strong>Equipo ConDineroLibre</strong>Hola, gracias por escribirnos. Para iniciar, dinos cómo podemos llamarte.</div><label>Tu nombre<input name="name" maxlength="100" autocomplete="name" required></label><label>Tu correo<input name="email" type="email" maxlength="254" autocomplete="email" required></label><button class="cdl-public-send" type="submit">Entrar al chat</button><p class="cdl-public-status" aria-live="polite"></p></form>' +
      '<div class="cdl-public-chat" hidden><div class="cdl-public-support-thread" aria-live="polite"></div><form class="cdl-public-compose"><textarea name="message" maxlength="3000" required placeholder="Escribe un mensaje..." aria-label="Tu mensaje"></textarea><button class="cdl-public-send" type="submit">Enviar</button><p class="cdl-public-status" aria-live="polite"></p></form></div></div>' +
      '<button class="cdl-public-support-toggle" type="button" aria-expanded="false">Centro de Mensajes</button>';
    document.body.appendChild(wrapper);

    var panel = wrapper.querySelector(".cdl-public-support-panel");
    var toggle = wrapper.querySelector(".cdl-public-support-toggle");
    var intake = wrapper.querySelector(".cdl-public-intake");
    var chat = wrapper.querySelector(".cdl-public-chat");
    var intakeStatus = intake.querySelector(".cdl-public-status");
    var chatStatus = chat.querySelector(".cdl-public-status");
    var compose = chat.querySelector("form");
    var closeButton = wrapper.querySelector(".cdl-public-close");
    var minimizeButton = wrapper.querySelector(".cdl-public-minimize");

    if (state.contact) {
      intake.elements.name.value = state.contact.name;
      intake.elements.email.value = state.contact.email;
      showChat(wrapper);
      loadThread(wrapper);
      startPolling(wrapper);
    }

    toggle.addEventListener("click", function () {
      enableIncomingSound();
      var isOpen = panel.hidden;
      panel.hidden = !isOpen;
      toggle.setAttribute("aria-expanded", String(isOpen));
      if (isOpen && state.contact) loadThread(wrapper);
      if (isOpen && !state.contact) intake.elements.name.focus();
    });

    minimizeButton.addEventListener("click", function () {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    });

    intake.addEventListener("submit", function (event) {
      event.preventDefault();
      enableIncomingSound();
      state.contact = {
        name: intake.elements.name.value.trim(),
        email: intake.elements.email.value.trim().toLowerCase(),
        sessionId: crypto.randomUUID()
      };
      saveState();
      showChat(wrapper);
      startPolling(wrapper);
      intakeStatus.textContent = "";
      compose.elements.message.focus();
    });

    compose.addEventListener("submit", function (event) {
      event.preventDefault();
      enableIncomingSound();
      var message = compose.elements.message.value.trim();
      if (!message) return;
      var button = compose.querySelector(".cdl-public-send");
      button.disabled = true;
      chatStatus.className = "cdl-public-status";
      chatStatus.textContent = "Enviando...";
      sendRequest({
        name: state.contact.name,
        email: state.contact.email,
        message: message,
        sessionId: state.contact.sessionId,
        website: ""
      }).then(function () {
        compose.elements.message.value = "";
        chatStatus.className = "cdl-public-status success";
        chatStatus.textContent = "Estamos buscando un asistente humano para atenderte.";
        return loadThread(wrapper);
      }).catch(function (error) {
        chatStatus.className = "cdl-public-status error";
        chatStatus.textContent = error.message || "No pudimos enviar tu mensaje.";
      }).finally(function () {
        button.disabled = false;
        compose.elements.message.focus();
      });
    });

    compose.elements.message.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      compose.requestSubmit();
    });

    closeButton.addEventListener("click", function () {
      if (!window.confirm("¿Quieres terminar esta conversación? Esta acción cerrará el chat y ya no podrás enviar más mensajes.")) return;
      closeButton.disabled = true;
      chatStatus.className = "cdl-public-status";
      chatStatus.textContent = "Finalizando conversación...";
      sendRequest({ action: "close", sessionId: state.contact.sessionId }).then(function () {
        state.closed = true;
        chatStatus.className = "cdl-public-status success";
        chatStatus.textContent = "Conversación finalizada.";
        return loadThread(wrapper);
      }).catch(function (error) {
        closeButton.disabled = false;
        chatStatus.className = "cdl-public-status error";
        chatStatus.textContent = error.message || "No pudimos finalizar la conversación.";
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createWidget);
  else createWidget();
}());
