/**
 * CDL Shell - Sistema de templates compartidos
 * Carga header.html y footer.html desde /shared/ e inicializa interacciones
 */
(function () {
  var host = window.location.hostname;
  var isLocal = host === '127.0.0.1' || host === 'localhost';

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

  /**
   * Inicializa los event listeners para mega-menús y navegación móvil
   */
  function initHeaderInteractions() {
    // Mega-menú: delayed close
    var dropdownButtons = document.querySelectorAll('.nav-item-dropdown button');
    dropdownButtons.forEach(function (btn) {
      var megaMenu = btn.nextElementSibling;
      var timeoutId;

      btn.addEventListener('mouseenter', function () {
        clearTimeout(timeoutId);
        btn.classList.add('is-open');
      });

      btn.addEventListener('mouseleave', function () {
        timeoutId = setTimeout(function () {
          btn.classList.remove('is-open');
        }, 260);
      });

      if (megaMenu) {
        megaMenu.addEventListener('mouseenter', function () {
          clearTimeout(timeoutId);
          btn.classList.add('is-open');
        });

        megaMenu.addEventListener('mouseleave', function () {
          timeoutId = setTimeout(function () {
            btn.classList.remove('is-open');
          }, 260);
        });
      }
    });

    // Mobile menu toggle
    var mobileMenuBtn = document.getElementById('mobile-menu-btn');
    var mobileMenu = document.getElementById('mobile-menu');
    var closeMobileBtn = document.getElementById('close-mobile-menu');

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
