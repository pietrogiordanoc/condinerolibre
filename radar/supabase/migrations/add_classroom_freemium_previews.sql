-- Freemium: dos primeras lecciones publicadas de cada módulo, con el límite de reproducción aplicado en el portal.

CREATE OR REPLACE FUNCTION public.is_classroom_preview_lesson(target_lesson_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.course_lessons lesson
    JOIN public.courses course ON course.id = lesson.course_id AND course.active
    WHERE lesson.id = target_lesson_id
      AND lesson.published = true
      AND (
        SELECT count(*)
        FROM public.course_lessons previous_lesson
        WHERE previous_lesson.course_id = lesson.course_id
          AND previous_lesson.module_id IS NOT DISTINCT FROM lesson.module_id
          AND previous_lesson.published = true
          AND (previous_lesson.position, previous_lesson.id) <= (lesson.position, lesson.id)
      ) <= 2
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_classroom_preview_lesson(uuid) TO authenticated;

DROP POLICY IF EXISTS "Students can read lessons for enrolled courses" ON public.course_lessons;
CREATE POLICY "Students can read lessons for enrolled courses"
  ON public.course_lessons FOR SELECT TO authenticated
  USING (
    published = true
    AND (public.has_course_access(course_id) OR public.is_classroom_preview_lesson(id))
  );

DROP POLICY IF EXISTS "Students can read modules for enrolled courses" ON public.course_modules;
CREATE POLICY "Students can read modules for enrolled courses"
  ON public.course_modules FOR SELECT TO authenticated
  USING (
    public.has_course_access(course_id)
    OR EXISTS (
      SELECT 1 FROM public.course_lessons lesson
      WHERE lesson.module_id = course_modules.id
        AND public.is_classroom_preview_lesson(lesson.id)
    )
  );
