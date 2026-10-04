-- Master Pro: solo la primera lección publicada del primer módulo puede verse gratis.
-- Los previews de los demás cursos conservan una primera lección publicada por curso.

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
