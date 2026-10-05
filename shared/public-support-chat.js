(function () {
  "use strict";

  var endpoint = "https://yhgqmbexjscojlrzguvh.supabase.co/functions/v1/submit-public-support-message";
  var storageKey = "cdl_public_support_contact";

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function savedContact() {
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch (error) { return {}; }
  }

  function saveContact(name, email) {
    try { localStorage.setItem(storageKey, JSON.stringify({ name: name, email: email })); } catch (error) {}
  }

  function createWidget() {
    if (document.getElementById("cdl-public-support")) return;
    var contact = savedContact();
    var wrapper = document.createElement("section");
    wrapper.id = "cdl-public-support";
    wrapper.innerHTML =
      '<style>' +
      '#cdl-public-support{position:fixed;right:22px;bottom:22px;z-index:99999;font-family:Arial,sans-serif}' +
      '#cdl-public-support *{box-sizing:border-box}' +
      '.cdl-public-support-panel{width:min(370px,calc(100vw - 28px));overflow:hidden;border:1px solid rgba(42,255,138,.42);border-radius:16px;background:#e9e6dd;box-shadow:0 24px 64px rgba(0,0,0,.42)}' +
      '.cdl-public-support-head{padding:15px 16px;background:linear-gradient(135deg,#087c4d,#1fac6c);color:#fff}.cdl-public-support-head strong{display:block;font-size:16px;font-weight:600}.cdl-public-support-head span{display:block;margin-top:4px;font-size:12px;line-height:1.4;color:rgba(255,255,255,.82)}' +
      '.cdl-public-support-form{display:grid;gap:10px;padding:14px;background-color:#e9e6dd;background-image:radial-gradient(rgba(78,92,90,.22) .7px,transparent .7px);background-size:14px 14px}.cdl-public-support-form label{display:grid;gap:5px;color:#496057;font-size:11px}.cdl-public-support-form input,.cdl-public-support-form textarea{width:100%;border:1px solid #d1dad5;border-radius:8px;background:#fff;color:#20342b;padding:10px;font:inherit;font-size:13px}.cdl-public-support-form textarea{min-height:86px;resize:vertical}.cdl-public-support-form input:focus,.cdl-public-support-form textarea:focus{outline:2px solid rgba(37,167,104,.25);border-color:#25a768}.cdl-public-support-submit{border:0;border-radius:8px;background:#25a768;color:#fff;padding:11px 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}.cdl-public-support-submit:disabled{opacity:.6;cursor:wait}.cdl-public-support-status{min-height:16px;margin:0;color:#547067;font-size:11px;line-height:1.4}.cdl-public-support-status.error{color:#bd3b35}.cdl-public-support-status.success{color:#087c4d}.cdl-public-support-toggle{margin:12px 0 0 auto;display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.28);border-radius:10px;background:#1ba465;color:#fff;padding:12px 15px;box-shadow:0 12px 28px rgba(20,135,80,.34);font:600 12px Arial,sans-serif;cursor:pointer}.cdl-public-support-toggle:before{content:"";width:8px;height:8px;border-radius:50%;background:#d7ffea;box-shadow:0 0 0 3px rgba(215,255,234,.15)}.cdl-public-support-honeypot{position:absolute!important;left:-9999px!important;opacity:0!important}' +
      '@media(max-width:600px){#cdl-public-support{right:14px;bottom:14px}.cdl-public-support-panel{width:calc(100vw - 28px)}}' +
      '</style>' +
      '<div class="cdl-public-support-panel" hidden>' +
      '<div class="cdl-public-support-head"><strong>Centro de Mensajes</strong><span>Déjanos tu consulta. Te responderemos por email.</span></div>' +
      '<form class="cdl-public-support-form">' +
      '<label>Tu nombre<input name="name" maxlength="100" autocomplete="name" required value="' + escapeHtml(contact.name) + '"></label>' +
      '<label>Tu correo<input name="email" type="email" maxlength="254" autocomplete="email" required value="' + escapeHtml(contact.email) + '"></label>' +
      '<label>Tu mensaje<textarea name="message" maxlength="3000" required placeholder="Escribe tu mensaje..."></textarea></label>' +
      '<label class="cdl-public-support-honeypot" aria-hidden="true">Sitio web<input name="website" tabindex="-1" autocomplete="off"></label>' +
      '<button class="cdl-public-support-submit" type="submit">Enviar mensaje</button>' +
      '<p class="cdl-public-support-status" aria-live="polite"></p>' +
      '</form></div>' +
      '<button class="cdl-public-support-toggle" type="button" aria-expanded="false">Centro de Mensajes</button>';

    document.body.appendChild(wrapper);
    var panel = wrapper.querySelector(".cdl-public-support-panel");
    var toggle = wrapper.querySelector(".cdl-public-support-toggle");
    var form = wrapper.querySelector("form");
    var submit = wrapper.querySelector(".cdl-public-support-submit");
    var status = wrapper.querySelector(".cdl-public-support-status");

    toggle.addEventListener("click", function () {
      var isOpen = panel.hidden;
      panel.hidden = !isOpen;
      toggle.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) form.elements.name.focus();
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      status.className = "cdl-public-support-status";
      status.textContent = "Enviando tu mensaje...";
      submit.disabled = true;
      try {
        var formData = new FormData(form);
        var response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(formData.entries()))
        });
        var payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "No pudimos enviar tu mensaje.");
        saveContact(formData.get("name").trim(), formData.get("email").trim());
        form.elements.message.value = "";
        status.className = "cdl-public-support-status success";
        status.textContent = payload.message;
      } catch (error) {
        status.className = "cdl-public-support-status error";
        status.textContent = error.message || "No pudimos enviar tu mensaje. Inténtalo de nuevo.";
      } finally {
        submit.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createWidget);
  else createWidget();
}());
