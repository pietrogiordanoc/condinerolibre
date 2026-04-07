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
      el.classList.add('cdl-shell-hidden');
    });
  }

  function buildHeader() {
    var header = document.createElement('header');
    header.id = 'cdl-shell-header';
    header.innerHTML = '' +
      '<div class="cdl-shell-wrap">' +
      '  <a class="cdl-shell-logo" href="' + mapPath('/') + '">' +
      '    <img src="https://ik.imagekit.io/primel/ConDineroLibreImages/logocdl.png?updatedAt=1766903325070" alt="ConDineroLibre" />' +
      '  </a>' +
      '  <nav class="cdl-shell-nav">' +
      '    <a href="' + mapPath('/cdl-portal/registro/') + '">Plataforma</a>' +
      '    <a href="' + mapPath('/aprende/que-es-el-trading/') + '">Aprende</a>' +
      '    <a href="' + mapPath('/cursos/curso-de-trading-master-gratuito/') + '">Cursos</a>' +
      '    <a href="' + mapPath('/contacto/') + '">Contacto</a>' +
      '    <a class="cdl-shell-cta" href="' + mapPath('/cdl-portal/login/') + '">Acceder al Dashboard</a>' +
      '  </nav>' +
      '</div>';
    return header;
  }

  function buildFooter() {
    var footer = document.createElement('footer');
    footer.id = 'cdl-shell-footer';
    footer.innerHTML = '' +
      '<div class="cdl-shell-wrap">' +
      '  <div class="cdl-shell-grid">' +
      '    <div class="cdl-shell-brand">' +
      '      <img src="https://ik.imagekit.io/primel/ConDineroLibreImages/logocdl.png?updatedAt=1766903325070" alt="ConDineroLibre" />' +
      '      <p>Trading y libertad financiera<br>Formacion en trading aplicada a mercados reales, con enfoque en riesgo, disciplina y consistencia.</p>' +
      '    </div>' +
      '    <div class="cdl-shell-col">' +
      '      <a href="' + mapPath('/cursos/curso-de-trading-master-gratuito/') + '">Cursos</a>' +
      '      <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView</a>' +
      '      <a href="https://ftmo.com/" target="_blank" rel="noopener noreferrer">Prop Firms</a>' +
      '      <a href="' + mapPath('/aprende/que-es-el-trading/') + '">Blog</a>' +
      '      <a href="' + mapPath('/contacto/') + '">Contacto</a>' +
      '    </div>' +
      '    <div class="cdl-shell-col">' +
      '      <a href="' + mapPath('/cdl-portal/') + '">Portal</a>' +
      '      <a href="' + mapPath('/cdl-portal/login/') + '">Login</a>' +
      '      <a href="' + mapPath('/cdl-portal/registro/') + '">Crear cuenta</a>' +
      '    </div>' +
      '  </div>' +
      '  <div class="cdl-shell-disclaimer">Advertencia: El trading conlleva un alto riesgo de pérdida de capital. La información proporcionada es solo con fines educativos y no constituye asesoramiento financiero.</div>' +
      '  <div class="cdl-shell-bottom">&copy; 2026 ConDineroLibre</div>' +
      '</div>';
    return footer;
  }

  function applySharedShell() {
    if (document.body.dataset.cdlShellApplied === '1') return;

    document.body.classList.add('cdl-shell-enabled');
    hideLegacyShell();
    document.body.prepend(buildHeader());
    document.body.appendChild(buildFooter());
    document.body.dataset.cdlShellApplied = '1';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySharedShell);
  } else {
    applySharedShell();
  }
})();
