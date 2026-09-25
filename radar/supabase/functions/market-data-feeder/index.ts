import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
};

type Instrument = {
  symbol: string;
  apiSymbol?: string;
  micCode?: string;
  type: 'forex' | 'stocks' | 'commodities' | 'crypto';
};

type Candle5m = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};

type TwelveDataResponse = {
  status?: string;
  code?: number;
  message?: string;
  values?: Candle5m[];
};

const INSTRUMENTS: Instrument[] = [
  { symbol: 'EUR/USD', type: 'forex' }, { symbol: 'USD/JPY', type: 'forex' },
  { symbol: 'GBP/USD', type: 'forex' }, { symbol: 'AUD/USD', type: 'forex' },
  { symbol: 'USD/CAD', type: 'forex' }, { symbol: 'USD/CHF', type: 'forex' },
  { symbol: 'NZD/USD', type: 'forex' }, { symbol: 'EUR/GBP', type: 'forex' },
  { symbol: 'USD/CNH', type: 'forex' }, { symbol: 'EUR/JPY', type: 'forex' },
  { symbol: 'GBP/JPY', type: 'forex' }, { symbol: 'AUD/JPY', type: 'forex' },
  { symbol: 'EUR/CHF', type: 'forex' }, { symbol: 'USD/MXN', type: 'forex' },

  { symbol: 'NVDA', type: 'stocks' }, { symbol: 'MSFT', type: 'stocks' },
  { symbol: 'GOOGL', type: 'stocks' }, { symbol: 'AMZN', type: 'stocks' },
  { symbol: 'TSM', type: 'stocks' }, { symbol: 'META', type: 'stocks' },
  { symbol: 'AVGO', type: 'stocks' }, { symbol: 'LRCX', type: 'stocks' },
  { symbol: 'KLAC', type: 'stocks' }, { symbol: 'NFLX', type: 'stocks' },
  { symbol: 'V', type: 'stocks' }, { symbol: 'MU', type: 'stocks' },
  { symbol: 'AAPL', type: 'stocks' }, { symbol: 'TSLA', type: 'stocks' },
  { symbol: 'ORCL', type: 'stocks' }, { symbol: 'ASML', type: 'stocks' },
  { symbol: 'AMD', type: 'stocks' }, { symbol: 'LLY', type: 'stocks' },

  { symbol: 'XAG/USD', type: 'commodities' }, { symbol: 'XAU/USD', type: 'commodities' },
  { symbol: 'WTI', apiSymbol: 'WTI/USD', type: 'commodities' },
  { symbol: 'CC', type: 'commodities' }, { symbol: 'KC', type: 'commodities' },

  { symbol: 'BTC/USD', type: 'crypto' }, { symbol: 'ETH/USD', type: 'crypto' },
  { symbol: 'SOL/USD', type: 'crypto' }, { symbol: 'BNB/USD', type: 'crypto' },
  { symbol: 'XRP/USD', type: 'crypto' }, { symbol: 'ADA/USD', type: 'crypto' },
  { symbol: 'DOT/USD', type: 'crypto' }, { symbol: 'LINK/USD', type: 'crypto' },
  { symbol: 'XTZ/USD', type: 'crypto' }, { symbol: 'INJ/USD', type: 'crypto' },
  { symbol: 'OP/USD', type: 'crypto' }, { symbol: 'ARB/USD', type: 'crypto' },
  { symbol: 'APT/USD', type: 'crypto' }, { symbol: 'FIL/USD', type: 'crypto' },
  { symbol: 'SUSHI/USD', type: 'crypto' }, { symbol: 'AAVE/USD', type: 'crypto' },
  { symbol: 'UNI/USD', type: 'crypto' }, { symbol: 'ICP/USD', type: 'crypto' },
  { symbol: 'ALGO/USD', type: 'crypto' }, { symbol: 'NEAR/USD', type: 'crypto' },
  { symbol: 'XLM/USD', type: 'crypto' }, { symbol: 'ETC/USD', type: 'crypto' },
  { symbol: 'TRX/USD', type: 'crypto' }, { symbol: 'BCH/USD', type: 'crypto' },
];

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function hasValidCandles(values: Candle5m[]): boolean {
  if (values.length === 0) return false;
  const latest = values[0];
  const prices = [latest.open, latest.high, latest.low, latest.close].map(Number);
  return prices.every((price) => Number.isFinite(price) && price > 0);
}

serve(async () => {
  let supabase: SupabaseClient | null = null;
  let ownsLock = false;

  try {
    const projectUrl = Deno.env.get('PROJECT_URL') ?? Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('PROJECT_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
    if (!projectUrl || !anonKey) throw new Error('Supabase URL or anon key is not configured');

    supabase = createClient(projectUrl, anonKey);

    const { data: gotLock, error: lockError } = await supabase.rpc('try_market_feeder_lock');
    if (lockError) throw lockError;
    if (!gotLock) return new Response('Already running', { status: 200 });
    ownsLock = true;

    const apiKey = Deno.env.get('TWELVE_DATA_API_KEY');
    if (!apiKey) throw new Error('TWELVE_DATA_API_KEY is not configured');

    for (const instrument of INSTRUMENTS) {
      const requestedSymbol = instrument.apiSymbol || instrument.symbol;
      const url =
        `https://api.twelvedata.com/time_series` +
        `?symbol=${encodeURIComponent(requestedSymbol)}` +
        (instrument.micCode ? `&mic_code=${encodeURIComponent(instrument.micCode)}` : '') +
        `&interval=5min&outputsize=2000&apikey=${encodeURIComponent(apiKey)}`;

      try {
        const response = await fetch(url);
        const json = (await response.json()) as TwelveDataResponse;

        if (!response.ok || json.status !== 'ok' || !json.values?.length) {
          console.log(
            `No data: ${instrument.symbol} | requested=${requestedSymbol} | http=${response.status} | code=${json.code ?? 'n/a'} | message=${json.message ?? 'n/a'}`,
          );
          await sleep(1200);
          continue;
        }

        const values = json.values;
        if (!hasValidCandles(values)) {
          console.error(
            `Invalid price rejected: ${instrument.symbol} | requested=${requestedSymbol} | latest=${JSON.stringify(values[0])}`,
          );
          await sleep(1200);
          continue;
        }

        const latest = values[0];
        const { error } = await supabase.from('market_cache').upsert({
          symbol: instrument.symbol,
          data: {
            symbol: instrument.symbol, type: instrument.type, datetime: latest.datetime,
            open: latest.open, high: latest.high, low: latest.low,
            close: latest.close, volume: latest.volume,
          },
          time_series_data: values,
          updated_at: new Date().toISOString(),
        });

        if (error) console.error(`Database error for ${instrument.symbol}: ${error.message}`);
      } catch (error) {
        console.error(
          `Request error for ${instrument.symbol}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      await sleep(1200);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('Error', { status: 500 });
  } finally {
    if (supabase && ownsLock) await supabase.rpc('release_market_feeder_lock');
  }
});