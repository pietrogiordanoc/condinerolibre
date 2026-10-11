-- Publica MetaTrader en Classroom con su colección Bunny Stream.
INSERT INTO public.courses (id, title, bunny_library_id, bunny_collection_id, active) VALUES
  ('metatrader', 'MetaTrader', 769072, '0838d466-6ccd-44bb-93bd-d8ead3295dc5', true)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    bunny_library_id = EXCLUDED.bunny_library_id,
    bunny_collection_id = EXCLUDED.bunny_collection_id,
    active = EXCLUDED.active;