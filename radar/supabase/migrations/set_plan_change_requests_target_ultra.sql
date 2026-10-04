-- Las solicitudes existentes de upgrade pasan a representar CDL Ultra.
ALTER TABLE public.plan_change_requests
  ADD COLUMN IF NOT EXISTS target_plan text NOT NULL DEFAULT 'ultra';

UPDATE public.plan_change_requests
SET target_plan = 'ultra'
WHERE target_plan IS DISTINCT FROM 'ultra';

ALTER TABLE public.plan_change_requests
  DROP CONSTRAINT IF EXISTS plan_change_requests_target_plan_check;

ALTER TABLE public.plan_change_requests
  ADD CONSTRAINT plan_change_requests_target_plan_check
  CHECK (target_plan = 'ultra');
