-- Modo experimental de SL: desactivado para todos, incluido el administrador.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS experimental_sl_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Datos necesarios para auditar el SL propuesto en cada señal nueva.
ALTER TABLE public.radar_signal_history
  ADD COLUMN IF NOT EXISTS sl_price NUMERIC,
  ADD COLUMN IF NOT EXISTS sl_structure_price NUMERIC,
  ADD COLUMN IF NOT EXISTS sl_atr NUMERIC,
  ADD COLUMN IF NOT EXISTS sl_margin NUMERIC;

-- Nueva sobrecarga: conserva record_new_signal de 8 parámetros para compatibilidad.
CREATE OR REPLACE FUNCTION public.record_new_signal(
  p_symbol TEXT,
  p_type TEXT,
  p_direction TEXT,
  p_score INTEGER,
  p_entry NUMERIC,
  p_tp NUMERIC,
  p_rr NUMERIC,
  p_current_price NUMERIC,
  p_sl NUMERIC,
  p_sl_structure_price NUMERIC,
  p_sl_atr NUMERIC,
  p_sl_margin NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open RECORD;
  v_result_pct NUMERIC;
  v_outcome TEXT;
  v_year_month TEXT;
BEGIN
  SELECT * INTO v_open
  FROM radar_signal_history
  WHERE instrument_symbol = p_symbol AND closed_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    IF v_open.entry_price = p_entry AND v_open.direction = p_direction THEN
      RETURN;
    END IF;

    v_result_pct := CASE
      WHEN v_open.direction = 'buy' THEN ((p_current_price - v_open.entry_price) / v_open.entry_price) * 100
      ELSE ((v_open.entry_price - p_current_price) / v_open.entry_price) * 100
    END;
    v_outcome := CASE
      WHEN v_result_pct > 0.01 THEN 'win'
      WHEN v_result_pct < -0.01 THEN 'loss'
      ELSE 'breakeven'
    END;

    UPDATE radar_signal_history
    SET closed_at = NOW(), close_price = p_current_price, result_pct = v_result_pct, outcome = v_outcome
    WHERE id = v_open.id;

    v_year_month := TO_CHAR(NOW(), 'YYYY-MM');
    INSERT INTO radar_signal_monthly_stats AS m
      (instrument_symbol, year_month, total_signals, wins, losses, sum_result_pct)
    VALUES (p_symbol, v_year_month, 1, (v_outcome = 'win')::INT, (v_outcome = 'loss')::INT, v_result_pct)
    ON CONFLICT (instrument_symbol, year_month) DO UPDATE
    SET total_signals = m.total_signals + 1,
        wins = m.wins + (v_outcome = 'win')::INT,
        losses = m.losses + (v_outcome = 'loss')::INT,
        sum_result_pct = m.sum_result_pct + v_result_pct,
        updated_at = NOW();
  END IF;

  INSERT INTO radar_signal_history
    (instrument_symbol, instrument_type, direction, score, entry_price, tp_price, rr, sl_price, sl_structure_price, sl_atr, sl_margin)
  VALUES (p_symbol, p_type, p_direction, p_score, p_entry, p_tp, p_rr, p_sl, p_sl_structure_price, p_sl_atr, p_sl_margin)
  ON CONFLICT (instrument_symbol) WHERE closed_at IS NULL DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_new_signal(
  TEXT, TEXT, TEXT, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) TO anon, authenticated;
