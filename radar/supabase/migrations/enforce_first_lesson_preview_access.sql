-- Classroom: los previews muestran una sola lección publicada por curso.
-- Esta política se aplica después del acceso Academy para que no se pierda
-- al actualizar sus funciones de acceso.
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
          AND module.id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.course_lessons previous_lesson
            JOIN public.course_modules previous_module ON previous_module.id = previous_lesson.module_id
            WHERE previous_lesson.course_id = lesson.course_id
              AND previous_lesson.published = true
              AND (
                previous_module.position,
                previous_lesson.position,
                previous_lesson.id
              ) < (
                module.position,
                lesson.position,
                lesson.id
              )
          )
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
                COALESCE(previous_module.position, 0),
                previous_lesson.position,
                previous_lesson.id
              ) <= (
                COALESCE(module.position, 0),
                lesson.position,
                lesson.id
              )
          ) <= 1
        )
      )
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
      SELECT 1
      FROM public.course_lessons lesson
      WHERE lesson.course_id = course_modules.course_id
        AND public.is_classroom_preview_lesson(lesson.id)
    )
  );
