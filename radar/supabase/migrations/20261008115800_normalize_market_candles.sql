CREATE TABLE IF NOT EXISTS public.market_candles (
  symbol text NOT NULL,
  candle_at text NOT NULL,
  candle jsonb NOT NULL,
  inserted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, candle_at)
);

ALTER TABLE public.market_candles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.market_candles TO anon, authenticated;

DROP POLICY IF EXISTS "Public read market candles" ON public.market_candles;
CREATE POLICY "Public read market candles"
  ON public.market_candles
  FOR SELECT
  TO public
  USING (true);

INSERT INTO public.market_candles (symbol, candle_at, candle)
SELECT
  market_cache.symbol,
  candle.value ->> 'datetime',
  candle.value
FROM public.market_cache
CROSS JOIN LATERAL jsonb_array_elements(market_cache.time_series_data) AS candle(value)
WHERE candle.value ? 'datetime'
ON CONFLICT (symbol, candle_at) DO NOTHING;
