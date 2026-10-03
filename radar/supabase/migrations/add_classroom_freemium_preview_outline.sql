-- Freemium: muestra el índice completo sin exponer los IDs de Bunny de lecciones bloqueadas.

CREATE OR REPLACE FUNCTION public.get_classroom_preview_outline(target_course_ids text[])
RETURNS TABLE (
  id uuid,
  course_id text,
  module_id uuid,
  title text,
  position integer,
  preview_available boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lesson.id,
    lesson.course_id,
    lesson.module_id,
    lesson.title,
    lesson.position,
    public.is_classroom_preview_lesson(lesson.id) AS preview_available
  FROM public.course_lessons lesson
  JOIN public.courses course ON course.id = lesson.course_id
  WHERE lesson.course_id = ANY(target_course_ids)
    AND course.active = true
    AND lesson.published = true
  ORDER BY lesson.course_id, lesson.module_id, lesson.position, lesson.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_classroom_preview_outline(text[]) TO authenticated;