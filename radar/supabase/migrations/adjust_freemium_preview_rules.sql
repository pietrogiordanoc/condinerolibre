-- Master Pro: dos lecciones por módulo con muestra limitada.
-- Demás cursos: una primera lección completa por curso.

CREATE OR REPLACE FUNCTION public.is_classroom_preview_lesson(target_lesson_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.course_lessons lesson
    JOIN public.courses course ON course.id = lesson.course_id AND course.active
    LEFT JOIN public.course_modules module ON module.id = lesson.module_id
    WHERE lesson.id = target_lesson_id
      AND lesson.published = true
      AND (
        (
          lesson.course_id = 'master-pro'
          AND (
            SELECT count(*)
            FROM public.course_lessons previous_lesson
            WHERE previous_lesson.course_id = lesson.course_id
              AND previous_lesson.module_id IS NOT DISTINCT FROM lesson.module_id
              AND previous_lesson.published = true
              AND (previous_lesson.position, previous_lesson.id) <= (lesson.position, lesson.id)
          ) <= 2
        )
        OR (
          lesson.course_id <> 'master-pro'
          AND (
            SELECT count(*)
            FROM public.course_lessons previous_lesson
            LEFT JOIN public.course_modules previous_module ON previous_module.id = previous_lesson.module_id
            WHERE previous_lesson.course_id = lesson.course_id
              AND previous_lesson.published = true
              AND (
                COALESCE(previous_module.position, 0), previous_lesson.position, previous_lesson.id
              ) <= (
                COALESCE(module.position, 0), lesson.position, lesson.id
              )
          ) <= 1
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Students can read modules for enrolled courses" ON public.course_modules;
CREATE POLICY "Students can read modules for enrolled courses"
  ON public.course_modules FOR SELECT TO authenticated
  USING (
    public.has_course_access(course_id)
    OR EXISTS (
      SELECT 1
      FROM public.course_lessons lesson
      WHERE lesson.course_id = course_modules.course_id
        AND public.is_classroom_preview_lesson(lesson.id)
    )
  );