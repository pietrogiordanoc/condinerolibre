CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.affiliate_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code text NOT NULL UNIQUE CHECK (referral_code ~ '^CDL-[A-Z0-9]{8}$'),
  paypal_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'converted', 'void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz,
  converted_by uuid REFERENCES auth.users(id),
  CHECK (referrer_user_id <> referred_user_id)
);

CREATE TABLE IF NOT EXISTS public.affiliate_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 5000),
  paypal_email text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'paid', 'rejected', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id),
  admin_note text
);

CREATE TABLE IF NOT EXISTS public.affiliate_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents <> 0),
  entry_type text NOT NULL CHECK (entry_type IN ('conversion_credit', 'payout_debit', 'payout_reversal', 'conversion_reversal', 'admin_adjustment')),
  referral_id uuid REFERENCES public.affiliate_referrals(id) ON DELETE SET NULL,
  payout_request_id uuid REFERENCES public.affiliate_payout_requests(id) ON DELETE SET NULL,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_conversion_credit_once
  ON public.affiliate_ledger (referral_id)
  WHERE entry_type = 'conversion_credit';

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_payout_debit_once
  ON public.affiliate_ledger (payout_request_id)
  WHERE entry_type = 'payout_debit';

CREATE INDEX IF NOT EXISTS affiliate_referrals_referrer_idx
  ON public.affiliate_referrals (referrer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS affiliate_ledger_user_idx
  ON public.affiliate_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS affiliate_payout_requests_user_idx
  ON public.affiliate_payout_requests (user_id, requested_at DESC);

CREATE OR REPLACE FUNCTION public.is_affiliate_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_affiliate_account()
RETURNS public.affiliate_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_row public.affiliate_accounts;
  candidate_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO account_row
  FROM public.affiliate_accounts
  WHERE user_id = auth.uid();

  IF FOUND THEN
    RETURN account_row;
  END IF;

  LOOP
    candidate_code := 'CDL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    BEGIN
      INSERT INTO public.affiliate_accounts (user_id, referral_code)
      VALUES (auth.uid(), candidate_code)
      RETURNING * INTO account_row;
      RETURN account_row;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_referral_code(referral_code_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id uuid;
  normalized_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  normalized_code := upper(trim(referral_code_input));
  IF normalized_code IS NULL OR normalized_code = '' THEN
    RETURN false;
  END IF;

  SELECT user_id INTO referrer_id
  FROM public.affiliate_accounts
  WHERE referral_code = normalized_code;

  IF referrer_id IS NULL THEN
    RAISE EXCEPTION 'Referral code not found';
  END IF;

  IF referrer_id = auth.uid() THEN
    RAISE EXCEPTION 'Self referrals are not allowed';
  END IF;

  INSERT INTO public.affiliate_referrals (referrer_user_id, referred_user_id)
  VALUES (referrer_id, auth.uid())
  ON CONFLICT (referred_user_id) DO NOTHING;

  RETURN EXISTS (
    SELECT 1 FROM public.affiliate_referrals
    WHERE referrer_user_id = referrer_id AND referred_user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_affiliate_paypal_email(paypal_email_input text)
RETURNS public.affiliate_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_row public.affiliate_accounts;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF paypal_email_input IS NULL OR position('@' IN trim(paypal_email_input)) < 2 THEN
    RAISE EXCEPTION 'A valid PayPal email is required';
  END IF;

  PERFORM public.ensure_affiliate_account();
  UPDATE public.affiliate_accounts
  SET paypal_email = lower(trim(paypal_email_input)), updated_at = now()
  WHERE user_id = auth.uid()
  RETURNING * INTO account_row;
  RETURN account_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_affiliate_payout(paypal_email_input text)
RETURNS public.affiliate_payout_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_row public.affiliate_accounts;
  payout_row public.affiliate_payout_requests;
  available_cents integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF paypal_email_input IS NULL OR position('@' IN trim(paypal_email_input)) < 2 THEN
    RAISE EXCEPTION 'A valid PayPal email is required';
  END IF;

  PERFORM public.ensure_affiliate_account();
  SELECT * INTO account_row FROM public.affiliate_accounts WHERE user_id = auth.uid() FOR UPDATE;
  SELECT coalesce(sum(amount_cents), 0) INTO available_cents
  FROM public.affiliate_ledger WHERE user_id = auth.uid();

  IF available_cents < 5000 THEN
    RAISE EXCEPTION 'Minimum payout is $50.00';
  END IF;

  UPDATE public.affiliate_accounts
  SET paypal_email = lower(trim(paypal_email_input)), updated_at = now()
  WHERE user_id = auth.uid();

  INSERT INTO public.affiliate_payout_requests (user_id, amount_cents, paypal_email)
  VALUES (auth.uid(), available_cents, lower(trim(paypal_email_input)))
  RETURNING * INTO payout_row;

  INSERT INTO public.affiliate_ledger (user_id, amount_cents, entry_type, payout_request_id, note, created_by)
  VALUES (auth.uid(), -available_cents, 'payout_debit', payout_row.id, 'Retiro solicitado por PayPal', auth.uid());

  RETURN payout_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_affiliate_referrals()
RETURNS TABLE (
  referral_id uuid,
  display_name text,
  referral_status text,
  registered_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    referral.id,
    coalesce(profile.full_name, profile.email, 'Trader CDL'),
    referral.status,
    referral.created_at
  FROM public.affiliate_referrals AS referral
  JOIN public.profiles AS profile ON profile.id = referral.referred_user_id
  WHERE referral.referrer_user_id = auth.uid()
  ORDER BY referral.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_link_affiliate_referral(referrer_id uuid, referred_id uuid)
RETURNS public.affiliate_referrals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referral_row public.affiliate_referrals;
BEGIN
  IF NOT public.is_affiliate_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF referrer_id = referred_id THEN
    RAISE EXCEPTION 'Self referrals are not allowed';
  END IF;

  INSERT INTO public.affiliate_referrals (referrer_user_id, referred_user_id)
  VALUES (referrer_id, referred_id)
  ON CONFLICT (referred_user_id) DO UPDATE
  SET referrer_user_id = public.affiliate_referrals.referrer_user_id
  RETURNING * INTO referral_row;
  RETURN referral_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_confirm_affiliate_conversion(referral_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referral_row public.affiliate_referrals;
BEGIN
  IF NOT public.is_affiliate_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  UPDATE public.affiliate_referrals
  SET status = 'converted', converted_at = now(), converted_by = auth.uid()
  WHERE id = referral_id_input AND status = 'registered'
  RETURNING * INTO referral_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referral is not eligible for conversion';
  END IF;

  INSERT INTO public.affiliate_ledger (user_id, amount_cents, entry_type, referral_id, note, created_by)
  VALUES (referral_row.referrer_user_id, 1500, 'conversion_credit', referral_row.id, 'Bono por referido convertido', auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_affiliate_payout_paid(payout_id_input uuid, admin_note_input text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_affiliate_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  UPDATE public.affiliate_payout_requests
  SET status = 'paid', processed_at = now(), processed_by = auth.uid(), admin_note = admin_note_input
  WHERE id = payout_id_input AND status = 'requested';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request is not pending';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_affiliate_payout(payout_id_input uuid, admin_note_input text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payout_row public.affiliate_payout_requests;
BEGIN
  IF NOT public.is_affiliate_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  UPDATE public.affiliate_payout_requests
  SET status = 'rejected', processed_at = now(), processed_by = auth.uid(), admin_note = admin_note_input
  WHERE id = payout_id_input AND status = 'requested'
  RETURNING * INTO payout_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request is not pending';
  END IF;

  INSERT INTO public.affiliate_ledger (user_id, amount_cents, entry_type, payout_request_id, note, created_by)
  VALUES (payout_row.user_id, payout_row.amount_cents, 'payout_reversal', payout_row.id, 'Retiro rechazado', auth.uid());
END;
$$;

ALTER TABLE public.affiliate_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_accounts_read_own_or_admin" ON public.affiliate_accounts
  FOR SELECT USING (user_id = auth.uid() OR public.is_affiliate_admin());
CREATE POLICY "affiliate_referrals_read_own_or_admin" ON public.affiliate_referrals
  FOR SELECT USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid() OR public.is_affiliate_admin());
CREATE POLICY "affiliate_ledger_read_own_or_admin" ON public.affiliate_ledger
  FOR SELECT USING (user_id = auth.uid() OR public.is_affiliate_admin());
CREATE POLICY "affiliate_payouts_read_own_or_admin" ON public.affiliate_payout_requests
  FOR SELECT USING (user_id = auth.uid() OR public.is_affiliate_admin());

GRANT EXECUTE ON FUNCTION public.ensure_affiliate_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_affiliate_paypal_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_affiliate_payout(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_affiliate_referrals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_affiliate_referral(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_affiliate_conversion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_affiliate_payout_paid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_affiliate_payout(uuid, text) TO authenticated;