-- Un curso puede agrupar varias colecciones Bunny sin crear accesos separados.
CREATE TABLE IF NOT EXISTS public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL,
  bunny_collection_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, position),
  UNIQUE (course_id, bunny_collection_id)
);

CREATE INDEX IF NOT EXISTS course_modules_course_position_idx
  ON public.course_modules (course_id, position);

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can read modules for enrolled courses" ON public.course_modules;
CREATE POLICY "Students can read modules for enrolled courses"
  ON public.course_modules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.course_enrollments
      WHERE course_enrollments.user_id = auth.uid()
        AND course_enrollments.course_id = course_modules.course_id
    )
  );

DROP POLICY IF EXISTS "Administrators can manage course modules" ON public.course_modules;
CREATE POLICY "Administrators can manage course modules"
  ON public.course_modules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.course_modules(id) ON DELETE CASCADE;

ALTER TABLE public.course_lessons
  DROP CONSTRAINT IF EXISTS course_lessons_course_id_position_key;

CREATE UNIQUE INDEX IF NOT EXISTS course_lessons_course_position_without_module_key
  ON public.course_lessons (course_id, position)
  WHERE module_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS course_lessons_module_position_key
  ON public.course_lessons (module_id, position)
  WHERE module_id IS NOT NULL;

INSERT INTO public.course_modules (course_id, title, position, bunny_collection_id) VALUES
  ('master-pro', '01 Básico', 1, 'c66712c2-9fda-4780-8b21-b2e9989106d1'),
  ('master-pro', '02 Avanzado', 2, 'b0a64948-a4ae-41c5-8046-bc1c7ba0cfce'),
  ('master-pro', '03 Experto', 3, '0df8afb7-03d7-4a92-bb23-46c410355363')
ON CONFLICT (course_id, bunny_collection_id) DO UPDATE
SET title = EXCLUDED.title,
    position = EXCLUDED.position;

UPDATE public.courses
SET bunny_library_id = 769072,
    bunny_collection_id = NULL
WHERE id = 'master-pro';