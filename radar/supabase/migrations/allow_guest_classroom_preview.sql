-- Visitantes sin cuenta: ven exactamente lo mismo que un Freemium en Classroom
-- (primera clase gratis por curso + índice de lecciones bloqueadas, sin IDs de vídeo bloqueados).

GRANT EXECUTE ON FUNCTION public.is_classroom_preview_lesson(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_classroom_preview_outline(text[]) TO anon;

DROP POLICY IF EXISTS "Visitors can read active courses" ON public.courses;
CREATE POLICY "Visitors can read active courses"
  ON public.courses FOR SELECT TO anon
  USING (active = true);

DROP POLICY IF EXISTS "Visitors can read preview lessons" ON public.course_lessons;
CREATE POLICY "Visitors can read preview lessons"
  ON public.course_lessons FOR SELECT TO anon
  USING (published = true AND public.is_classroom_preview_lesson(id));

DROP POLICY IF EXISTS "Visitors can read preview modules" ON public.course_modules;
CREATE POLICY "Visitors can read preview modules"
  ON public.course_modules FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.course_lessons lesson
      WHERE lesson.course_id = course_modules.course_id
        AND public.is_classroom_preview_lesson(lesson.id)
    )
  );
