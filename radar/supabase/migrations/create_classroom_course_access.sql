-- Classroom: catálogo de cursos y accesos concedidos manualmente por el administrador.
CREATE TABLE IF NOT EXISTS public.courses (
  id text PRIMARY KEY,
  title text NOT NULL,
  bunny_library_id bigint,
  bunny_collection_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.courses (id, title, bunny_library_id, bunny_collection_id) VALUES
  ('master-pro', 'Master Pro Profesional Académico', NULL, NULL),
  ('trading-prime', 'Trading Prime Elite Profesional', NULL, NULL),
  ('velas-japonesas', 'Velas Japonesas desde Cero', 769072, '8382e70a-1bbb-44a4-805a-14a3694cc4c0'),
  ('tradingview-basico', 'TradingView Básico', 769072, '1e3a102f-d724-4fcc-a7c0-3e339dbb4ce0')
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    bunny_library_id = EXCLUDED.bunny_library_id,
    bunny_collection_id = EXCLUDED.bunny_collection_id;

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS course_enrollments_user_id_idx
  ON public.course_enrollments (user_id);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read active courses" ON public.courses;
CREATE POLICY "Authenticated users can read active courses"
  ON public.courses FOR SELECT TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Users can read their own course enrollments" ON public.course_enrollments;
CREATE POLICY "Users can read their own course enrollments"
  ON public.course_enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Administrators can read all course enrollments" ON public.course_enrollments;
CREATE POLICY "Administrators can read all course enrollments"
  ON public.course_enrollments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_set_course_access(
  target_user_id uuid,
  target_course_id text,
  should_grant boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF should_grant THEN
    INSERT INTO public.course_enrollments (user_id, course_id, granted_by)
    VALUES (target_user_id, target_course_id, auth.uid())
    ON CONFLICT (user_id, course_id) DO NOTHING;
  ELSE
    DELETE FROM public.course_enrollments
    WHERE user_id = target_user_id AND course_id = target_course_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_course_access(uuid, text, boolean) TO authenticated;