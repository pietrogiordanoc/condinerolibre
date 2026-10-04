-- Classroom: cursos especializados publicados con sus colecciones de Bunny.
-- Todos conservan la misma lógica de acceso individual y de CDLRadar + Classroom.
INSERT INTO public.courses (id, title, bunny_library_id, bunny_collection_id, active) VALUES
  ('indices-sinteticos', 'Índices Sintéticos', 769072, '4f3e4172-b1e7-45b1-aa77-704df847b8ed', true),
  ('indices-bursatiles', 'Índices Bursátiles', 769072, 'f92a12d1-27a3-4a57-ad1d-b9810e55c143', true),
  ('criptos', 'Criptos', 769072, 'e20d63f8-b39d-40b5-a420-bcc530410c98', true),
  ('forex-basico', 'Forex Básico', 769072, 'ceb7c8b6-50b5-4c5a-9702-103865dd4372', true),
  ('apuestas-deportivas', 'Apuestas Deportivas', 769072, 'b0bbfa7e-2c76-4735-bf72-0e155da74348', true)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    bunny_library_id = EXCLUDED.bunny_library_id,
    bunny_collection_id = EXCLUDED.bunny_collection_id,
    active = EXCLUDED.active;
