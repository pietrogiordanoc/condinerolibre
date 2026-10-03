-- Progreso del alumno en el aula. Se identifica por vídeo de Bunny para sobrevivir a resincronizaciones.
CREATE TABLE IF NOT EXISTS public.course_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  bunny_video_id uuid NOT NULL,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bunny_video_id)
);

CREATE INDEX IF NOT EXISTS course_progress_user_course_idx
  ON public.course_progress (user_id, course_id);

ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read their own progress" ON public.course_progress;
CREATE POLICY "Students read their own progress"
  ON public.course_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Students save their own progress" ON public.course_progress;
CREATE POLICY "Students save their own progress"
  ON public.course_progress FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.course_enrollments
      WHERE course_enrollments.user_id = auth.uid()
        AND course_enrollments.course_id = course_progress.course_id
    )
  );

DROP POLICY IF EXISTS "Students update their own progress" ON public.course_progress;
CREATE POLICY "Students update their own progress"
  ON public.course_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Administrators read all progress" ON public.course_progress;
CREATE POLICY "Administrators read all progress"
  ON public.course_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
