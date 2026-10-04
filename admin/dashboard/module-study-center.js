let STUDY_QUESTIONS = [];
let STUDY_NOTES = [];
let STUDY_USERS_BY_ID = new Map();
let STUDY_COURSES_BY_ID = new Map();
let STUDY_LESSONS_BY_ID = new Map();

function escapeStudyText(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function studyUserLabel(userId) {
  const user = STUDY_USERS_BY_ID.get(userId);
  return user ? escapeStudyText(user.full_name || user.email || userId) : escapeStudyText(userId);
}

function studyLessonLabel(courseId, lessonId) {
  const course = STUDY_COURSES_BY_ID.get(courseId)?.title || courseId;
  const lesson = STUDY_LESSONS_BY_ID.get(lessonId)?.title || 'Lección eliminada';
  return `${escapeStudyText(course)}<br><small class="muted">${escapeStudyText(lesson)}</small>`;
}

function formatStudyDate(value) {
  return value ? new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

async function refreshStudyCenter() {
  const [questionsResponse, notesResponse, usersResponse, coursesResponse, lessonsResponse] = await Promise.all([
    sp.from('course_study_questions').select('*').order('created_at', { ascending: false }),
    sp.from('course_study_notes').select('*').order('updated_at', { ascending: false }),
    sp.from('profiles').select('id, full_name, email'),
    sp.from('courses').select('id, title'),
    sp.from('course_lessons').select('id, title')
  ]);
  const error = questionsResponse.error || notesResponse.error || usersResponse.error || coursesResponse.error || lessonsResponse.error;
  if (error) {
    console.error('No se pudo cargar el Centro de Estudio:', error);
    Toastify({ text: `No se pudo cargar el Centro de Estudio: ${error.message}`, duration: 7000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  STUDY_QUESTIONS = questionsResponse.data || [];
  STUDY_NOTES = notesResponse.data || [];
  STUDY_USERS_BY_ID = new Map((usersResponse.data || []).map((user) => [user.id, user]));
  STUDY_COURSES_BY_ID = new Map((coursesResponse.data || []).map((course) => [course.id, course]));
  STUDY_LESSONS_BY_ID = new Map((lessonsResponse.data || []).map((lesson) => [lesson.id, lesson]));
  renderStudyCenter();
}

function renderStudyCenter() {
  const filter = document.getElementById('studyQuestionFilter')?.value || 'all';
  const questions = filter === 'all' ? STUDY_QUESTIONS : STUDY_QUESTIONS.filter((question) => question.status === filter);
  const questionsBody = document.getElementById('studyQuestionsTbody');
  questionsBody.innerHTML = questions.length ? questions.map((question) => `
    <tr>
      <td>${studyUserLabel(question.user_id)}<br><small class="muted">${formatStudyDate(question.created_at)}</small></td>
      <td>${studyLessonLabel(question.course_id, question.lesson_id)}</td>
      <td style="min-width:220px; white-space:pre-wrap;">${escapeStudyText(question.question)}</td>
      <td><span class="tier-badge ${question.status === 'answered' ? 'tier-ultra' : 'tier-freemium'}">${question.status === 'answered' ? 'Respondida' : 'Pendiente'}</span></td>
      <td style="min-width:260px;">
        <textarea data-study-answer="${question.id}" class="note-textarea" style="min-height:86px;" placeholder="Escribe una respuesta clara para el alumno...">${escapeStudyText(question.teacher_response || '')}</textarea>
        <button class="btn btn-primary" style="margin-top:8px;" onclick="saveStudyAnswer('${question.id}')">Guardar respuesta</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="5" class="muted" style="text-align:center; padding:28px;">No hay consultas en este estado.</td></tr>';

  const notesBody = document.getElementById('studyNotesTbody');
  notesBody.innerHTML = STUDY_NOTES.length ? STUDY_NOTES.map((note) => `
    <tr>
      <td>${studyUserLabel(note.user_id)}</td>
      <td>${studyLessonLabel(note.course_id, note.lesson_id)}</td>
      <td style="min-width:280px; white-space:pre-wrap;">${escapeStudyText(note.content)}</td>
      <td>${formatStudyDate(note.updated_at)}</td>
    </tr>`).join('') : '<tr><td colspan="4" class="muted" style="text-align:center; padding:28px;">Aún no hay anotaciones de estudio.</td></tr>';
}

window.saveStudyAnswer = async function(questionId) {
  const input = document.querySelector(`[data-study-answer="${questionId}"]`);
  const teacherResponse = input?.value.trim();
  if (!teacherResponse) {
    Toastify({ text: 'Escribe una respuesta antes de guardarla.', duration: 4000, backgroundColor: '#e67e22' }).showToast();
    return;
  }
  const { data: { session } } = await sp.auth.getSession();
  if (!session) return;
  const { error } = await sp.from('course_study_questions').update({
    teacher_response: teacherResponse,
    status: 'answered',
    responded_by: session.user.id,
    responded_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', questionId);
  if (error) {
    console.error('No se pudo guardar la respuesta:', error);
    Toastify({ text: `No se pudo guardar la respuesta: ${error.message}`, duration: 7000, backgroundColor: '#e74c3c' }).showToast();
    return;
  }
  Toastify({ text: 'Respuesta enviada al alumno.', duration: 3500, backgroundColor: '#10b981' }).showToast();
  await refreshStudyCenter();
};
