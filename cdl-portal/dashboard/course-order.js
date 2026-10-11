/*
 * Orden de las cards de Classroom.
 *
 * Para cambiar el orden, mueve una linea completa dentro de COURSE_CARD_ORDER.
 * El primer ID aparece primero. No cambies los textos entre comillas.
 * Las cards que no esten en esta lista se mostraran al final.
 */
window.COURSE_CARD_ORDER = [
  'metatrader',
  'master-pro',
  'trading-prime',
  'velas-japonesas',
  'tradingview-basico',
  'indices-sinteticos',
  'indices-bursatiles',
  'criptos',
  'apuestas-deportivas',
  'forex-basico',
  'the-leap',
  'psicologia-trading',

];

window.applyCourseCardOrder = function applyCourseCardOrder() {
  const container = document.getElementById('courseCards');
  if (!container) return;

  const cardsById = new Map(
    [...container.querySelectorAll('[data-course-card-id]')]
      .map((card) => [card.dataset.courseCardId, card])
  );

  window.COURSE_CARD_ORDER.forEach((courseId) => {
    const card = cardsById.get(courseId);
    if (card) container.appendChild(card);
  });
};