-- Actualiza los IDs de colecciones Bunny después de crear el catálogo Classroom.
UPDATE public.courses
SET bunny_library_id = 769072,
    bunny_collection_id = '8382e70a-1bbb-44a4-805a-14a3694cc4c0'
WHERE id = 'velas-japonesas';

UPDATE public.courses
SET bunny_library_id = 769072,
    bunny_collection_id = '1e3a102f-d724-4fcc-a7c0-3e339dbb4ce0'
WHERE id = 'tradingview-basico';