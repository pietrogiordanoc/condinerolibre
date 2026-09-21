-- Historial compartido de señales del CDLRadar (tasa de aciertos por instrumento)
-- Reemplaza el "paper trading" individual por usuario: se registra UNA vez por señal
-- (no por usuario, no por polling), evitando el consumo excesivo de Supabase.

-- Tabla de detalle: una fila por señal (abierta al aparecer, cerrada al aparecer la siguiente
-- señal del mismo instrumento). Se poda periódicamente (ver cleanup_old_signal_history).
CREATE TABLE IF NOT EXISTS radar_signal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_symbol TEXT NOT NULL,
  instrument_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('buy', 'sell')),
  score INTEGER NOT NULL,
  entry_price NUMERIC NOT NULL,
  tp_price NUMERIC,
  rr NUMERIC,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  close_price NUMERIC,
  result_pct NUMERIC,
  outcome TEXT CHECK (outcome IN ('win', 'loss', 'breakeven')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo puede existir UNA señal abierta por instrumento a la vez (evita duplicados
-- cuando varios usuarios detectan la misma señal nueva al mismo tiempo)
CREATE UNIQUE INDEX IF NOT EXISTS radar_signal_history_open_unique
  ON radar_signal_history (instrument_symbol)
  WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS radar_signal_history_symbol_closed_idx
  ON radar_signal_history (instrument_symbol, closed_at DESC);

-- Resumen mensual permanente por instrumento (no se borra nunca, pesa muy poco).
-- Sirve para calcular el % de aciertos histórico sin depender del detalle crudo.
CREATE TABLE IF NOT EXISTS radar_signal_monthly_stats (
  instrument_symbol TEXT NOT NULL,
  year_month TEXT NOT NULL, -- formato 'YYYY-MM'
  total_signals INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  sum_result_pct NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (instrument_symbol, year_month)
);

ALTER TABLE radar_signal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_signal_monthly_stats ENABLE ROW LEVEL SECURITY;

-- Lectura pública (cualquier usuario logueado puede ver las estadísticas del radar)
CREATE POLICY "radar_signal_history_select" ON radar_signal_history
  FOR SELECT USING (true);

CREATE POLICY "radar_signal_monthly_stats_select" ON radar_signal_monthly_stats
  FOR SELECT USING (true);

-- Nadie escribe estas tablas directamente: todo pasa por record_new_signal (SECURITY DEFINER)
REVOKE INSERT, UPDATE, DELETE ON radar_signal_history FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON radar_signal_monthly_stats FROM anon, authenticated;

-- Vista de estadísticas históricas (todo el tiempo) por instrumento, lista para leer desde el cliente
CREATE OR REPLACE VIEW radar_signal_stats AS
SELECT
  instrument_symbol,
  SUM(total_signals) AS total_signals,
  SUM(wins) AS wins,
  SUM(losses) AS losses,
  CASE WHEN SUM(total_signals) > 0
    THEN ROUND((SUM(wins)::NUMERIC / SUM(total_signals)) * 100, 1)
    ELSE NULL END AS win_rate_pct,
  CASE WHEN SUM(total_signals) > 0
    THEN ROUND(SUM(sum_result_pct) / SUM(total_signals), 2)
    ELSE NULL END AS avg_result_pct
FROM radar_signal_monthly_stats
GROUP BY instrument_symbol;

GRANT SELECT ON radar_signal_stats TO anon, authenticated;

-- Registra una señal nueva: cierra la señal abierta anterior del mismo instrumento
-- (calculando su resultado contra el precio actual) y abre la nueva.
-- Se llama UNA vez por señal nueva detectada, no por polling.
CREATE OR REPLACE FUNCTION record_new_signal(
  p_symbol TEXT,
  p_type TEXT,
  p_direction TEXT,
  p_score INTEGER,
  p_entry NUMERIC,
  p_tp NUMERIC,
  p_rr NUMERIC,
  p_current_price NUMERIC
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
    -- Ya está registrada esta misma señal (otro usuario la reportó primero)
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
    VALUES (
      p_symbol, v_year_month, 1,
      (v_outcome = 'win')::INT, (v_outcome = 'loss')::INT, v_result_pct
    )
    ON CONFLICT (instrument_symbol, year_month) DO UPDATE
    SET total_signals = m.total_signals + 1,
        wins = m.wins + (v_outcome = 'win')::INT,
        losses = m.losses + (v_outcome = 'loss')::INT,
        sum_result_pct = m.sum_result_pct + v_result_pct,
        updated_at = NOW();
  END IF;

  INSERT INTO radar_signal_history
    (instrument_symbol, instrument_type, direction, score, entry_price, tp_price, rr)
  VALUES (p_symbol, p_type, p_direction, p_score, p_entry, p_tp, p_rr)
  ON CONFLICT (instrument_symbol) WHERE closed_at IS NULL DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION record_new_signal(TEXT, TEXT, TEXT, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated;

-- Poda el detalle crudo con más de 180 días de cerrado (el resumen mensual es permanente y no se toca)
CREATE OR REPLACE FUNCTION cleanup_old_signal_history()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM radar_signal_history
  WHERE closed_at IS NOT NULL AND closed_at < NOW() - INTERVAL '180 days';
$$;
