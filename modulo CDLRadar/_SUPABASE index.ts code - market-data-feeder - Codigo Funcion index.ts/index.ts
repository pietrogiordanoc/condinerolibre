import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// ---- Deno env typing ----
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

// ---- Types ----
type InstrumentType = 'Forex' | 'Commodities' | 'Crypto' | 'Indices' | 'Stocks';

interface Instrument {
  symbol: string;
  name: string;
  type: InstrumentType;
}

interface Candle5m {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface TimeSeriesOk {
  status: 'ok';
  values: Candle5m[];
}

interface TimeSeriesError {
  status: 'error';
  message?: string;
}

// ---- Instrumentos FOREX ----
const FOREX: Instrument[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", type: "Forex" },
  { symbol: "GBP/USD", name: "British Pound / US Dollar", type: "Forex" },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar", type: "Forex" },
  { symbol: "NZD/USD", name: "New Zealand Dollar / US Dollar", type: "Forex" },
  { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar", type: "Forex" },
  { symbol: "USD/CHF", name: "US Dollar / Swiss Franc", type: "Forex" },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", type: "Forex" },
  { symbol: "USD/VES", name: "US Dollar / Bolivar Soberano", type: "Forex" },
  { symbol: "EUR/GBP", name: "Euro / British Pound", type: "Forex" },
  { symbol: "EUR/AUD", name: "Euro / Australian Dollar", type: "Forex" },
  { symbol: "EUR/NZD", name: "Euro / New Zealand Dollar", type: "Forex" },
  { symbol: "EUR/CAD", name: "Euro / Canadian Dollar", type: "Forex" },
  { symbol: "EUR/CHF", name: "Euro / Swiss Franc", type: "Forex" },
  { symbol: "EUR/JPY", name: "Euro / Japanese Yen", type: "Forex" },
  { symbol: "GBP/AUD", name: "British Pound / Australian Dollar", type: "Forex" },
  { symbol: "GBP/NZD", name: "British Pound / New Zealand Dollar", type: "Forex" },
  { symbol: "GBP/CAD", name: "British Pound / Canadian Dollar", type: "Forex" },
  { symbol: "GBP/CHF", name: "British Pound / Swiss Franc", type: "Forex" },
  { symbol: "GBP/JPY", name: "British Pound / Japanese Yen", type: "Forex" },
  { symbol: "AUD/NZD", name: "Australian Dollar / New Zealand Dollar", type: "Forex" },
  { symbol: "AUD/CAD", name: "Australian Dollar / Canadian Dollar", type: "Forex" },
  { symbol: "AUD/CHF", name: "Australian Dollar / Swiss Franc", type: "Forex" },
  { symbol: "AUD/JPY", name: "Australian Dollar / Japanese Yen", type: "Forex" },
  { symbol: "NZD/CAD", name: "New Zealand Dollar / Canadian Dollar", type: "Forex" },
  { symbol: "NZD/CHF", name: "New Zealand Dollar / Swiss Franc", type: "Forex" },
  { symbol: "NZD/JPY", name: "New Zealand Dollar / Japanese Yen", type: "Forex" },
  { symbol: "CAD/CHF", name: "Canadian Dollar / Swiss Franc", type: "Forex" },
  { symbol: "CAD/JPY", name: "Canadian Dollar / Japanese Yen", type: "Forex" },
  { symbol: "CHF/JPY", name: "Swiss Franc / Japanese Yen", type: "Forex" },
  { symbol: "CNY/CNH", name: "Chinese Yuan / Offshore", type: "Forex" },
  { symbol: "USD/CNH", name: "US Dollar / Offshore Yuan", type: "Forex" },
];

// ---- Instrumentos COMMODITIES ----
const COMMODITIES: Instrument[] = [
  { symbol: "XAU/USD", name: "Gold Spot (Oro)", type: "Commodities" },
  { symbol: "XAG/USD", name: "Silver Spot (Plata)", type: "Commodities" },
  { symbol: "XPT/USD", name: "Platinum Spot (Platino)", type: "Commodities" },
  { symbol: "XPD/USD", name: "Palladium Spot (Paladio)", type: "Commodities" },
  { symbol: "WTI/USD", name: "Crude Oil WTI Spot (Petróleo)", type: "Commodities" },
  { symbol: "XBR/USD", name: "Brent Oil Spot (Petróleo)", type: "Commodities" },
  { symbol: "NG/USD", name: "Natural Gas Spot", type: "Commodities" },
];

// ---- Instrumentos CRYPTO ----
const CRYPTO: Instrument[] = [
  { symbol: "BTC/USD", name: "Bitcoin", type: "Crypto" },
  { symbol: "ETH/USD", name: "Ethereum", type: "Crypto" },
  { symbol: "BNB/USD", name: "Binance Coin", type: "Crypto" },
  { symbol: "SOL/USD", name: "Solana", type: "Crypto" },
  { symbol: "XRP/USD", name: "Ripple", type: "Crypto" },
  { symbol: "ADA/USD", name: "Cardano", type: "Crypto" },
  { symbol: "DOGE/USD", name: "Dogecoin", type: "Crypto" },
  { symbol: "AVAX/USD", name: "Avalanche", type: "Crypto" },
  { symbol: "DOT/USD", name: "Polkadot", type: "Crypto" },
  { symbol: "LINK/USD", name: "Chainlink", type: "Crypto" },
  { symbol: "ATOM/USD", name: "Cosmos", type: "Crypto" },
  { symbol: "LTC/USD", name: "Litecoin", type: "Crypto" },
  { symbol: "BCH/USD", name: "Bitcoin Cash", type: "Crypto" },
  { symbol: "TRX/USD", name: "Tron", type: "Crypto" },
  { symbol: "ETC/USD", name: "Ethereum Classic", type: "Crypto" },
  { symbol: "XLM/USD", name: "Stellar", type: "Crypto" },
  { symbol: "NEAR/USD", name: "Near Protocol", type: "Crypto" },
  { symbol: "ALGO/USD", name: "Algorand", type: "Crypto" },
  { symbol: "ICP/USD", name: "Internet Computer", type: "Crypto" },
  { symbol: "UNI/USD", name: "Uniswap", type: "Crypto" },
  { symbol: "AAVE/USD", name: "Aave", type: "Crypto" },
  { symbol: "SUSHI/USD", name: "SushiSwap", type: "Crypto" },
  { symbol: "FIL/USD", name: "Filecoin", type: "Crypto" },
  { symbol: "APT/USD", name: "Aptos", type: "Crypto" },
  { symbol: "ARB/USD", name: "Arbitrum", type: "Crypto" },
  { symbol: "OP/USD", name: "Optimism", type: "Crypto" },
  { symbol: "INJ/USD", name: "Injective", type: "Crypto" },
  { symbol: "XTZ/USD", name: "Tezos", type: "Crypto" },
];

// ---- Instrumentos INDICES ----
const INDICES: Instrument[] = [
  { symbol: "SPX", name: "S&P 500", type: "Indices" },
  { symbol: "NDX", name: "NASDAQ 100", type: "Indices" },
  { symbol: "DAX", name: "Germany 40 (DAX)", type: "Indices" },
  { symbol: "CAC", name: "CAC 40", type: "Indices" },
  { symbol: "FTSE", name: "FTSE 100", type: "Indices" },
  { symbol: "IBEX", name: "IBEX 35", type: "Indices" },
  { symbol: "SMI", name: "Swiss Market Index", type: "Indices" },
  { symbol: "SSE", name: "Shanghai Composite", type: "Indices" },
];

// ---- Instrumentos STOCKS ----
const STOCKS: Instrument[] = [
  // US Mega Caps
  { symbol: "AAPL", name: "Apple Inc.", type: "Stocks" },
  { symbol: "MSFT", name: "Microsoft Corp.", type: "Stocks" },
  { symbol: "NVDA", name: "Nvidia Corp.", type: "Stocks" },
  { symbol: "GOOGL", name: "Alphabet Inc. (Class A)", type: "Stocks" },
  { symbol: "AMZN", name: "Amazon.com Inc.", type: "Stocks" },
  { symbol: "META", name: "Meta Platforms Inc.", type: "Stocks" },
  { symbol: "TSLA", name: "Tesla Inc.", type: "Stocks" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", type: "Stocks" },
  { symbol: "V", name: "Visa Inc.", type: "Stocks" },
  { symbol: "MA", name: "Mastercard Inc.", type: "Stocks" },
  { symbol: "JNJ", name: "Johnson & Johnson", type: "Stocks" },
  { symbol: "UNH", name: "UnitedHealth Group", type: "Stocks" },
  { symbol: "XOM", name: "Exxon Mobil Corp.", type: "Stocks" },
  { symbol: "CVX", name: "Chevron Corp.", type: "Stocks" },
  { symbol: "KO", name: "The Coca-Cola Company", type: "Stocks" },
  { symbol: "PEP", name: "PepsiCo Inc.", type: "Stocks" },
  { symbol: "WMT", name: "Walmart Inc.", type: "Stocks" },
  { symbol: "COST", name: "Costco Wholesale Corp.", type: "Stocks" },
  { symbol: "HD", name: "The Home Depot Inc.", type: "Stocks" },
  { symbol: "DIS", name: "The Walt Disney Company", type: "Stocks" },
  { symbol: "PFE", name: "Pfizer Inc.", type: "Stocks" },
  { symbol: "ABBV", name: "AbbVie Inc.", type: "Stocks" },
  { symbol: "MRK", name: "Merck & Co.", type: "Stocks" },
  { symbol: "NFLX", name: "Netflix Inc.", type: "Stocks" },
  { symbol: "ADBE", name: "Adobe Inc.", type: "Stocks" },
  { symbol: "INTC", name: "Intel Corp.", type: "Stocks" },
  { symbol: "AMD", name: "Advanced Micro Devices", type: "Stocks" },
  { symbol: "CRM", name: "Salesforce Inc.", type: "Stocks" },
  { symbol: "ORCL", name: "Oracle Corp.", type: "Stocks" },
  { symbol: "BAC", name: "Bank of America Corp.", type: "Stocks" },
  // European ADRs
  { symbol: "ASML", name: "ASML Holding N.V.", type: "Stocks" },
  { symbol: "SAP", name: "SAP SE", type: "Stocks" },
  { symbol: "MC", name: "LVMH", type: "Stocks" },
  { symbol: "OR", name: "L'Oréal", type: "Stocks" },
  { symbol: "AIR", name: "Airbus SE", type: "Stocks" },
  { symbol: "SIE", name: "Siemens AG", type: "Stocks" },
  { symbol: "BAS", name: "BASF SE", type: "Stocks" },
  { symbol: "BMW", name: "BMW AG", type: "Stocks" },
  { symbol: "ROG", name: "Roche Holding AG", type: "Stocks" },
  { symbol: "SAN", name: "Sanofi S.A.", type: "Stocks" },
  { symbol: "BNP", name: "BNP Paribas S.A.", type: "Stocks" },
  { symbol: "INGA", name: "ING Groep N.V.", type: "Stocks" },
  { symbol: "SHEL", name: "Shell plc", type: "Stocks" },
  { symbol: "AZN", name: "AstraZeneca plc", type: "Stocks" },
  { symbol: "TSLA", name: "Tesla Inc.", type: "Stocks" },
];

// ---- TODOS LOS INSTRUMENTOS ----
const ALL_INSTRUMENTS: Instrument[] = [
  ...FOREX,
  ...COMMODITIES,
  ...CRYPTO,
  ...INDICES,
  ...STOCKS,
];

// ---- Helpers ----
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---- MAIN ----
serve(async () => {
  let supabase: SupabaseClient;

  try {
    supabase = createClient(
      Deno.env.get('PROJECT_URL')!,
      Deno.env.get('PROJECT_ANON_KEY')!
    );

    // Log inicial
    console.log(`🚀 Starting market-data-feeder - Total instruments: ${ALL_INSTRUMENTS.length}`);
    console.log(`   Forex: ${FOREX.length}, Commodities: ${COMMODITIES.length}, Crypto: ${CRYPTO.length}, Indices: ${INDICES.length}, Stocks: ${STOCKS.length}`);

    // 🔒 Lock
    const { data: gotLock } = await supabase.rpc('try_market_feeder_lock');
    if (!gotLock) {
      console.log('⏸️ Already running - skipping');
      return new Response('Already running', { status: 200 });
    }

    const API_KEY = Deno.env.get('TWELVE_DATA_API_KEY')!;
    const OUTPUTSIZE = 2000;
    const SLEEP_MS = 1200;

    let successCount = 0;
    let errorCount = 0;

    for (const inst of ALL_INSTRUMENTS) {
      console.log(`📊 Processing: ${inst.symbol} (${inst.type})`);
      
      const url =
        `https://api.twelvedata.com/time_series` +
        `?symbol=${encodeURIComponent(inst.symbol)}` +
        `&interval=5min&outputsize=${OUTPUTSIZE}&apikey=${API_KEY}`;

      const res = await fetch(url);
      const json: TimeSeriesOk | TimeSeriesError = await res.json();

      if (json.status !== 'ok' || !json.values?.length) {
        errorCount++;
        console.log(`❌ No data for ${inst.symbol} (${inst.type}) - Status: ${json.status}, Message: ${json.message || 'N/A'}`);
        await sleep(SLEEP_MS);
        continue;
      }

      const latest = json.values[0];

      await supabase.from('market_cache').upsert({
        symbol: inst.symbol,
        data: {
          symbol: inst.symbol,
          name: inst.name,
          type: inst.type,
          datetime: latest.datetime,
          open: latest.open,
          high: latest.high,
          low: latest.low,
          close: latest.close,
          volume: latest.volume,
        },
        time_series_data: json.values,
        updated_at: new Date().toISOString(),
      });

      successCount++;
      console.log(`✅ Saved: ${inst.symbol} - Price: ${latest.close}`);

      await sleep(SLEEP_MS);
    }

    console.log(`✅ Completed: ${successCount} successful, ${errorCount} errors`);

    await supabase.rpc('release_market_feeder_lock');

    return new Response('OK', { status: 200 });

  } catch (e) {
    console.error(`💥 Fatal error: ${e.message}`);
    try {
      await supabase!.rpc('release_market_feeder_lock');
    } catch {}
    return new Response('Error', { status: 500 });
  }
});
