(() => {
  const classroomUrl = '/cdl-portal/dashboard/#accounts';
  const classroomCtaText = /^(empezar curso|comprar por .*|acceder por .*|registrarse en el curso gratuito ahora|activar acceso ahora)$/i;

  const openClassroom = () => {
    window.location.assign(classroomUrl);
  };

  document.querySelectorAll('a, button').forEach((element) => {
    const label = element.textContent.replace(/\s+/g, ' ').trim();
    if (!classroomCtaText.test(label)) return;

    element.textContent = 'Ver en Classroom';
    element.setAttribute('aria-label', 'Ver este curso en Classroom');
    if (element.tagName === 'A') {
      element.setAttribute('href', classroomUrl);
      element.removeAttribute('target');
      element.classList.remove('btn-activar-acceso');
      return;
    }

    element.type = 'button';
    element.addEventListener('click', openClassroom);
  });

  ['precio', 'purchaseModal', 'modulo-registro', 'activar-acceso'].forEach((id) => {
    const section = document.getElementById(id);
    if (section) section.hidden = true;
  });

  const footer = document.querySelector('footer');
  if (!footer || document.getElementById('classroom-access')) return;

  const classroomCta = document.createElement('section');
  classroomCta.id = 'classroom-access';
  classroomCta.className = 'mx-auto my-16 max-w-4xl px-4 sm:px-6';
  classroomCta.innerHTML = `
    <div class="rounded-2xl border border-primary/40 bg-bg-card p-8 text-center shadow-xl sm:p-10">
      <span class="material-symbols-outlined mb-3 text-4xl text-primary" aria-hidden="true">school</span>
      <h2 class="text-2xl font-extrabold text-white sm:text-3xl">Continúa en Classroom</h2>
      <p class="mx-auto mt-3 max-w-2xl text-text-subtle">Crea tu cuenta o inicia sesión para ver la clase de muestra y revisar las opciones disponibles desde Classroom.</p>
      <a href="${classroomUrl}" class="mt-6 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-7 font-bold text-bg-dark transition hover:bg-green-400">Ver en Classroom</a>
    </div>
  `;
  footer.before(classroomCta);
})();
