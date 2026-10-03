-- Cada colección Bunny es una carpeta; esta tabla define el orden de las lecciones reproducibles.
CREATE TABLE IF NOT EXISTS public.course_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  bunny_video_id uuid NOT NULL,
  thumbnail_url text,
  duration_seconds integer,
  position integer NOT NULL,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, position),
  UNIQUE (course_id, bunny_video_id)
);

CREATE INDEX IF NOT EXISTS course_lessons_course_position_idx
  ON public.course_lessons (course_id, position);

ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can read lessons for enrolled courses" ON public.course_lessons;
CREATE POLICY "Students can read lessons for enrolled courses"
  ON public.course_lessons FOR SELECT TO authenticated
  USING (
    published = true
    AND EXISTS (
      SELECT 1
      FROM public.course_enrollments
      WHERE course_enrollments.user_id = auth.uid()
        AND course_enrollments.course_id = course_lessons.course_id
    )
  );

DROP POLICY IF EXISTS "Administrators can manage course lessons" ON public.course_lessons;
CREATE POLICY "Administrators can manage course lessons"
  ON public.course_lessons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));