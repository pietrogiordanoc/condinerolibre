-- Centro de Estudio: notas por lección y consultas entre alumno y mentor.
CREATE TABLE IF NOT EXISTS public.course_study_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) <= 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS course_study_notes_user_course_idx
  ON public.course_study_notes (user_id, course_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.course_study_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 3000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered')),
  teacher_response text CHECK (teacher_response IS NULL OR char_length(teacher_response) <= 5000),
  responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_study_questions_admin_idx
  ON public.course_study_questions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS course_study_questions_user_course_idx
  ON public.course_study_questions (user_id, course_id, created_at DESC);

ALTER TABLE public.course_study_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_study_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students manage their own study notes" ON public.course_study_notes;
CREATE POLICY "Students manage their own study notes"
  ON public.course_study_notes FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Administrators read study notes" ON public.course_study_notes;
CREATE POLICY "Administrators read study notes"
  ON public.course_study_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Students read their own study questions" ON public.course_study_questions;
CREATE POLICY "Students read their own study questions"
  ON public.course_study_questions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Students create their own study questions" ON public.course_study_questions;
CREATE POLICY "Students create their own study questions"
  ON public.course_study_questions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Administrators manage study questions" ON public.course_study_questions;
CREATE POLICY "Administrators manage study questions"
  ON public.course_study_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
