-- Seguimiento de reproducción: tramos vistos, finalización y sesiones (visitas/frecuencia).
ALTER TABLE public.course_progress
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS watched_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS furthest_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_position_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watched_ranges jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.course_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  bunny_video_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  seconds_watched integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS course_sessions_user_started_idx
  ON public.course_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS course_sessions_course_started_idx
  ON public.course_sessions (course_id, started_at DESC);

ALTER TABLE public.course_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read their own sessions" ON public.course_sessions;
CREATE POLICY "Students read their own sessions"
  ON public.course_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Students create their own sessions" ON public.course_sessions;
CREATE POLICY "Students create their own sessions"
  ON public.course_sessions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.course_enrollments
      WHERE course_enrollments.user_id = auth.uid()
        AND course_enrollments.course_id = course_sessions.course_id
    )
  );

DROP POLICY IF EXISTS "Students update their own sessions" ON public.course_sessions;
CREATE POLICY "Students update their own sessions"
  ON public.course_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Administrators read all sessions" ON public.course_sessions;
CREATE POLICY "Administrators read all sessions"
  ON public.course_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
