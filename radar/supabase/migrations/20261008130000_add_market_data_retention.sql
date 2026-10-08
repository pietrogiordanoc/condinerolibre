CREATE OR REPLACE FUNCTION public.prune_market_candles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH stale_candles AS (
    SELECT symbol, candle_at
    FROM (
      SELECT
        symbol,
        candle_at,
        row_number() OVER (
          PARTITION BY symbol
          ORDER BY candle_at DESC
        ) AS candle_position
      FROM public.market_candles
    ) ranked_candles
    WHERE candle_position > 2000
  )
  DELETE FROM public.market_candles AS market_candles
  USING stale_candles
  WHERE market_candles.symbol = stale_candles.symbol
    AND market_candles.candle_at = stale_candles.candle_at;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prune_market_candles()
  FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'prune-market-candles',
  '15 3 * * *',
  $$SELECT public.prune_market_candles();$$
);

SELECT cron.schedule(
  'prune-cron-job-history',
  '30 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';$$
);
