/**
 * CDL Shell - Sistema de templates compartidos
 * Carga header.html y footer.html desde /shared/ e inicializa interacciones
 */
(function () {
  var host = window.location.hostname;
  var isLocal = host === '127.0.0.1' || host === 'localhost';
  var CONSENT_KEY = 'cdl_cookie_consent_v1';

  function mapPath(path) {
    if (!isLocal) return path;

    if (path === '/') return '/modulo%20home/';
    if (path.indexOf('/cdl-portal/') === 0) return '/modulo%20portal/cdl-portal/' + path.slice('/cdl-portal/'.length);
    if (path.indexOf('/contacto/') === 0) return '/modulo%20portal/contacto/' + path.slice('/contacto/'.length);
    if (path.indexOf('/aprende/') === 0) return '/modulo%20aprende/' + path.slice('/aprende/'.length);
    if (path.indexOf('/cursos/') === 0) return '/modulo%20Cursos/' + path.slice('/cursos/'.length);

    return path;
  }

  function hideLegacyShell() {
    document.querySelectorAll('body > header, body > nav, body > footer').forEach(function (el) {
      el.style.display = 'none';
    });
  }

  function getConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setConsent(consent) {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    } catch (e) {
      // no-op si localStorage no esta disponible
    }

    window.dispatchEvent(
      new CustomEvent('cdl:cookie-consent-updated', {
        detail: consent
      })
    );
  }

  function removeConsentBanner() {
    var banner = document.getElementById('cdl-cookie-banner');
    if (!banner) return;
    banner.classList.add('is-hiding');
    setTimeout(function () {
      if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    }, 220);
  }

  function defaultConsent() {
    return {
      essential: true,
      analytics: false,
      personalization: false,
      marketing: false,
      at: new Date().toISOString()
    };
  }

  function buildConsentAll() {
    return {
      essential: true,
      analytics: true,
      personalization: true,
      marketing: true,
      at: new Date().toISOString()
    };
  }

  function sanitizeConsent(consent) {
    if (!consent || typeof consent !== 'object') return defaultConsent();
    return {
      essential: true,
      analytics: !!consent.analytics,
      personalization: !!consent.personalization,
      marketing: !!consent.marketing,
      at: consent.at || new Date().toISOString()
    };
  }

  function createConsentBanner() {
    if (document.getElementById('cdl-cookie-banner')) return;

    var wrapper = document.createElement('div');
    wrapper.id = 'cdl-cookie-banner';
    wrapper.className = 'cdl-cookie-banner';
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-live', 'polite');
    wrapper.setAttribute('aria-label', 'Aviso de cookies');

    wrapper.innerHTML =
      '<div class="cdl-cookie-inner">' +
        '<p class="cdl-cookie-text">Usamos cookies propias y de terceros para mejorar tu experiencia. Puedes aceptar, rechazar o configurar tus preferencias.</p>' +
        '<div class="cdl-cookie-actions">' +
          '<button type="button" class="cdl-cookie-btn cdl-cookie-btn-primary" data-action="accept">Aceptar</button>' +
          '<button type="button" class="cdl-cookie-btn cdl-cookie-btn-muted" data-action="reject">Rechazar</button>' +
          '<button type="button" class="cdl-cookie-btn cdl-cookie-btn-ghost" data-action="settings">Configurar</button>' +
        '</div>' +
        '<div class="cdl-cookie-settings" hidden>' +
          '<label class="cdl-cookie-option"><input type="checkbox" checked disabled> Necesarias (siempre activas)</label>' +
          '<label class="cdl-cookie-option"><input type="checkbox" data-pref="analytics"> Analiticas</label>' +
          '<label class="cdl-cookie-option"><input type="checkbox" data-pref="personalization"> Personalizacion</label>' +
          '<label class="cdl-cookie-option"><input type="checkbox" data-pref="marketing"> Marketing</label>' +
          '<button type="button" class="cdl-cookie-btn cdl-cookie-btn-primary cdl-cookie-save" data-action="save">Guardar preferencias</button>' +
        '</div>' +
        '<a class="cdl-cookie-link" href="https://condinerolibre.com/contacto/aviso-legal">Politica de Cookies</a>' +
      '</div>';

    document.body.appendChild(wrapper);

    var settings = wrapper.querySelector('.cdl-cookie-settings');
    var setCheckboxes = function (consent) {
      var normalized = sanitizeConsent(consent);
      wrapper.querySelectorAll('input[data-pref]').forEach(function (input) {
        var key = input.getAttribute('data-pref');
        input.checked = !!normalized[key];
      });
    };

    setCheckboxes(defaultConsent());

    wrapper.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.getAttribute) return;
      var action = target.getAttribute('data-action');
      if (!action) return;

      if (action === 'accept') {
        setConsent(buildConsentAll());
        removeConsentBanner();
        return;
      }

      if (action === 'reject') {
        setConsent(defaultConsent());
        removeConsentBanner();
        return;
      }

      if (action === 'settings') {
        if (!settings) return;
        settings.hidden = !settings.hidden;
        return;
      }

      if (action === 'save') {
        var saved = {
          essential: true,
          analytics: false,
          personalization: false,
          marketing: false,
          at: new Date().toISOString()
        };

        wrapper.querySelectorAll('input[data-pref]').forEach(function (input) {
          var key = input.getAttribute('data-pref');
          if (key) saved[key] = !!input.checked;
        });

        setConsent(saved);
        removeConsentBanner();
      }
    });
  }

  function initCookieConsent() {
    var existingConsent = getConsent();

    if (!existingConsent) {
      createConsentBanner();
      return;
    }

    window.dispatchEvent(
      new CustomEvent('cdl:cookie-consent-updated', {
        detail: existingConsent
      })
    );
  }

  /**
   * Inicializa los event listeners para mega-menús y navegación móvil
   */
  function initHeaderInteractions() {
    // Mega-menú: delayed close
    var dropdownContainers = document.querySelectorAll('.nav-item-dropdown');
    dropdownContainers.forEach(function (container) {
      var btn = container.querySelector('button');
      var megaMenu = container.querySelector('.mega-menu');
      var timeoutId;

      if (!btn || !megaMenu) return; // Skip si no hay button o mega-menu

      btn.addEventListener('mouseenter', function () {
        clearTimeout(timeoutId);
        container.classList.add('is-open');
      });

      btn.addEventListener('mouseleave', function () {
        timeoutId = setTimeout(function () {
          container.classList.remove('is-open');
        }, 260);
      });

      megaMenu.addEventListener('mouseenter', function () {
        clearTimeout(timeoutId);
        container.classList.add('is-open');
      });

      megaMenu.addEventListener('mouseleave', function () {
        timeoutId = setTimeout(function () {
          container.classList.remove('is-open');
        }, 260);
      });
    });

    // Mobile menu toggle
    var mobileMenuBtn = document.getElementById('mobile-menu-btn');
    var mobileMenu = document.getElementById('mobile-menu');
    var closeMobileBtn = document.getElementById('mobile-menu-close');

    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.addEventListener('click', function () {
        mobileMenu.classList.add('active');
      });
    }

    if (closeMobileBtn && mobileMenu) {
      closeMobileBtn.addEventListener('click', function () {
        mobileMenu.classList.remove('active');
      });
    }

    // Smooth scroll para enlaces internos
    document.querySelectorAll('a[href^="/#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.querySelector(this.getAttribute('href').substring(1));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Header shadow on scroll
    var header = document.querySelector('header');
    if (header) {
      window.addEventListener('scroll', function () {
        if (window.scrollY > 10) {
          header.classList.add('shadow-lg');
        } else {
          header.classList.remove('shadow-lg');
        }
      });
    }
  }

  /**
   * Carga templates desde /shared/ e inyecta en el DOM
   */
  function applySharedShell() {
    if (document.body.dataset.cdlShellApplied === '1') return;
    document.body.dataset.cdlShellApplied = '1';

    hideLegacyShell();
    initCookieConsent();

    // Cargar header
    fetch('/shared/header.html')
      .then(function (response) {
        if (!response.ok) throw new Error('Header template not found');
        return response.text();
      })
      .then(function (html) {
        document.body.insertAdjacentHTML('afterbegin', html);
        initHeaderInteractions();
      })
      .catch(function (err) {
        console.warn('CDL Shell: Error loading header template:', err);
      });

    // Cargar footer
    fetch('/shared/footer.html')
      .then(function (response) {
        if (!response.ok) throw new Error('Footer template not found');
        return response.text();
      })
      .then(function (html) {
        document.body.insertAdjacentHTML('beforeend', html);
      })
      .catch(function (err) {
        console.warn('CDL Shell: Error loading footer template:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySharedShell);
  } else {
    applySharedShell();
  }
})();
