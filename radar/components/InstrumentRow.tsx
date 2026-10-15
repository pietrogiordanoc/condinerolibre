import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Info, Pin } from 'lucide-react';
import { Instrument, MultiTimeframeAnalysis, SignalType, ActionType, Timeframe, Strategy, Candlestick, TradeSetup } from '../types';
import { fetchTimeSeries, PriceStore, resampleCandles, isMarketOpen } from '../services/twelveDataService';
import { audioService } from '../utils/audioService';
import InstrumentIcon from './InstrumentIcon';

export const DESKTOP_GRID_COLUMNS = '64px 200px 100px 96px 61px 365px 105px 126px 72px minmax(0, 1fr) 84px';

export const GlobalAnalysisCache: Record<string, { 
  analysis: MultiTimeframeAnalysis, 
  trigger: number, 
  newSignalTriggerId?: number | null, 
  lastAction?: ActionType | null,
  isBookmarked?: boolean 
}> = {};

interface InstrumentRowProps {
  instrument: Instrument;
  isConnected: boolean;
  onToggleConnect: (id: string) => void;
  globalRefreshTrigger: number;
  strategy: Strategy;
  onAnalysisUpdate?: (id: string, data: MultiTimeframeAnalysis | null) => void;
  isTestMode?: boolean;
  onOpenChart: (symbol: string) => void;
  onOpenTutorial: () => void;
  onPinChange: () => void;
  chartStatus?: 'visible' | 'minimized';
  stats?: { totalSignals: number; winRatePct: number | null; avgResultPct: number | null } | null;
  experimentalSlEnabled: boolean;
  isPreview?: boolean;
  onRequestRegistration?: () => void;
}

const ChartMonitorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="2.5" y="3" width="19" height="13" rx="2" />
    <path d="M8 21h8M10 16v5M14 16v5" />
    <path d="M5.5 13l4.2-2.7 1.8 1.3 3.4-3.6 2.6 1.6" />
    <path d="M7.5 11V8.7M11 12V9M14.5 9.4V6.8M18 11.2V8.5" />
  </svg>
);

const calculateProfitDisplay = (tp: number, entry: number, instrument: Instrument): { value: string, unit: string } => {
    const profitDistance = Math.abs(tp - entry);
    
    if (instrument.type === 'forex') {
        const isJpyPair = instrument.symbol.includes('JPY');
        const pips = isJpyPair ? profitDistance * 100 : profitDistance * 10000;
        return { value: pips.toFixed(1), unit: 'PIPS' };
    }
    
    if (instrument.type === 'crypto' || instrument.type === 'stocks' || instrument.type === 'commodities') {
        if (profitDistance >= 10) return { value: profitDistance.toFixed(1), unit: 'PTS' };
        if (profitDistance >= 1) return { value: profitDistance.toFixed(2), unit: 'PTS' };
        return { value: profitDistance.toFixed(4), unit: 'PTS' };
    }

    return { value: profitDistance.toFixed(2), unit: 'PROFIT' };
};

const formatSetupValue = (value: number): string => {
  if (value >= 1000) return value.toFixed(2);
  if (value >= 1) return value.toFixed(4);
  return value.toFixed(6);
};

const formatInstrumentPrice = (value: number): { primary: string; fraction: string } => {
  const formatted = value.toLocaleString('en-US', { maximumFractionDigits: 6 });
  const decimalIndex = formatted.indexOf('.');

  if (decimalIndex === -1) return { primary: `$${formatted}`, fraction: '' };

  return {
    primary: `$${formatted.slice(0, decimalIndex + 3)}`,
    fraction: formatted.slice(decimalIndex + 3)
  };
};

const InstrumentRow: React.FC<InstrumentRowProps> = ({ 
  instrument, isConnected, onToggleConnect, globalRefreshTrigger, strategy, onAnalysisUpdate, isTestMode = false, onOpenChart, onOpenTutorial, onPinChange, chartStatus, stats, experimentalSlEnabled, isPreview = false, onRequestRegistration
}) => {
  const [analysis, setAnalysis] = useState<MultiTimeframeAnalysis | null>(() => GlobalAnalysisCache[instrument.id]?.analysis || null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(PriceStore[instrument.symbol] || 0);
  const [isBookmarked, setIsBookmarked] = useState(() => {
    const saved = localStorage.getItem('bookmarks');
    return saved ? JSON.parse(saved).includes(instrument.id) : false;
  });
  const [newSignalTriggerId, setNewSignalTriggerId] = useState<number | null>(null);
  const [tradeSetup, setTradeSetup] = useState<TradeSetup | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isSlInfoOpen, setIsSlInfoOpen] = useState(false);
  
  const lastRefreshTriggerRef = useRef<number>(GlobalAnalysisCache[instrument.id]?.trigger ?? -1);
  const previousChartStatusRef = useRef(chartStatus);

  // Sincronizar la fijación con el caché global para priorizar la fila arriba.
  useEffect(() => {
    if (GlobalAnalysisCache[instrument.id]) {
      GlobalAnalysisCache[instrument.id].isBookmarked = isBookmarked;
    }
  }, [isBookmarked, instrument.id]);

  useEffect(() => {
    if (chartStatus !== 'minimized' || isBookmarked) return;

    const saved = localStorage.getItem('bookmarks');
    const pinnedRows = saved ? JSON.parse(saved) : [];
    if (!pinnedRows.includes(instrument.id)) {
      localStorage.setItem('bookmarks', JSON.stringify([...pinnedRows, instrument.id]));
    }
    if (GlobalAnalysisCache[instrument.id]) {
      GlobalAnalysisCache[instrument.id].isBookmarked = true;
    }
    setIsBookmarked(true);
    onPinChange();
  }, [chartStatus, instrument.id, isBookmarked, onPinChange]);

  useEffect(() => {
    if (previousChartStatusRef.current && !chartStatus && isBookmarked) {
      setIsBookmarked(false);
    }
    previousChartStatusRef.current = chartStatus;
  }, [chartStatus, isBookmarked]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (PriceStore[instrument.symbol]) {
        setCurrentPrice(PriceStore[instrument.symbol]);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [instrument.symbol]);

  const handleCopySetupValue = (label: string, value: number) => {
    navigator.clipboard.writeText(value.toFixed(5));
    setCopyStatus(label);
    setTimeout(() => setCopyStatus(null), 1500);
  };

  const togglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !isBookmarked;
    const saved = localStorage.getItem('bookmarks');
    let list = saved ? JSON.parse(saved) : [];
    if (newState) {
      if (!list.includes(instrument.id)) list.push(instrument.id);
    } else {
      list = list.filter((id: string) => id !== instrument.id);
    }
    localStorage.setItem('bookmarks', JSON.stringify(list));
    if (GlobalAnalysisCache[instrument.id]) {
      GlobalAnalysisCache[instrument.id].isBookmarked = newState;
    }
    setIsBookmarked(newState);
    onPinChange();
  };

  const playAlertSound = useCallback((type: 'entry' | 'exit') => {
    audioService.play(type);
  }, []);

  const performAnalysis = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      const data5m = await fetchTimeSeries(instrument.symbol, '5min', 5000);
      
      if (data5m.length >= 100) {
        const combinedData: Partial<Record<Timeframe, Candlestick[]>> = {
          '5min': data5m,
          '15min': resampleCandles(data5m, 3),
          '1h': resampleCandles(data5m, 12),
          '4h': resampleCandles(data5m, 48)
        };

        const result = strategy.analyze(instrument.symbol, combinedData as any, false, instrument);
        
        if (result.tradeSetup) setTradeSetup(result.tradeSetup);
        else setTradeSetup(null);
        
        const lastActionInCache = GlobalAnalysisCache[instrument.id]?.lastAction;
        const isNewEntry = result.action === ActionType.ENTRAR_AHORA && lastActionInCache !== ActionType.ENTRAR_AHORA;
        const isNewExit = result.action === ActionType.SALIR && lastActionInCache !== ActionType.SALIR;
        
        let signalTriggerForUpdate = GlobalAnalysisCache[instrument.id]?.newSignalTriggerId;

        if (isNewEntry || isNewExit) {
          // Alarma se dispara en useEffect vinculado al badge NOW
          signalTriggerForUpdate = globalRefreshTrigger;
          setNewSignalTriggerId(signalTriggerForUpdate);
        }

        // Registrar la señal en el historial compartido (una vez por señal nueva, no por usuario ni por polling)
        if (isNewEntry && result.tradeSetup && result.price) {
          import('../services/supabaseClient').then(({ supabase }) => {
            supabase.rpc('record_new_signal', {
              p_symbol: instrument.symbol,
              p_type: instrument.type,
              p_direction: result.mainSignal === SignalType.SALE ? 'sell' : 'buy',
              p_score: result.powerScore || 0,
              p_entry: result.tradeSetup!.entry,
              p_tp: result.tradeSetup!.tp,
              p_rr: result.tradeSetup!.rr || null,
              p_current_price: result.price,
              p_sl: result.tradeSetup!.sl || null,
              p_sl_structure_price: result.tradeSetup!.slStructurePrice || null,
              p_sl_atr: result.tradeSetup!.slAtr || null,
              p_sl_margin: result.tradeSetup!.slMargin || null,
            }).then(({ error }) => {
              if (error) console.error(`[SignalHistory] Error registrando ${instrument.symbol}:`, error.message);
            });
          });
        }
        
        setAnalysis(result);
        if (result.price) setCurrentPrice(result.price);
        
        const wasBookmarked = GlobalAnalysisCache[instrument.id]?.isBookmarked === true;
        GlobalAnalysisCache[instrument.id] = { 
            analysis: result, 
            trigger: globalRefreshTrigger,
            newSignalTriggerId: signalTriggerForUpdate,
            lastAction: result.action,
          isBookmarked: wasBookmarked,
        };
        
        if (onAnalysisUpdate) onAnalysisUpdate(instrument.id, result);
      } else {
         if (onAnalysisUpdate) onAnalysisUpdate(instrument.id, null);
      }
    } catch (err)
 {
      console.error(`Error ${instrument.symbol}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [instrument, strategy, onAnalysisUpdate, playAlertSound, globalRefreshTrigger]);

  // Authoritative effect to sync "NOW" state from global cache and handle cleanup.
  useEffect(() => {
    const signalInfo = GlobalAnalysisCache[instrument.id];

    if (signalInfo?.newSignalTriggerId && signalInfo.newSignalTriggerId === globalRefreshTrigger) {
      // Case 1: A "NOW" signal exists for the CURRENT refresh cycle. Show it.
      setNewSignalTriggerId(signalInfo.newSignalTriggerId);
    } else {
      // Case 2: No current signal or signal is old. Ensure local state is cleared.
      setNewSignalTriggerId(null);
      // And if it's an old signal, clean the cache too.
      if (signalInfo?.newSignalTriggerId && signalInfo.newSignalTriggerId < globalRefreshTrigger) {
        signalInfo.newSignalTriggerId = null;
      }
    }
  }, [globalRefreshTrigger, instrument.id]);

  // Disparar alarma cuando aparece el badge NOW
  useEffect(() => {
    if (newSignalTriggerId === globalRefreshTrigger) {
      const action = GlobalAnalysisCache[instrument.id]?.lastAction;
      const currentAnalysis = GlobalAnalysisCache[instrument.id]?.analysis;
      console.log(`[Alarma] Badge NOW visible para ${instrument.symbol}, acción: ${action}`);
      
      if (action === ActionType.ENTRAR_AHORA) {
        console.log(`[Alarma] 🔔 Disparando alarma de ENTRADA para ${instrument.symbol}`);
        playAlertSound('entry');
      } else if (action === ActionType.SALIR) {
        console.log(`[Alarma] 🔔 Disparando alarma de SALIDA para ${instrument.symbol}`);
        playAlertSound('exit');
      }
    }
  }, [newSignalTriggerId, globalRefreshTrigger, instrument.id, instrument.symbol, instrument.type, tradeSetup, playAlertSound]);

  // Effect to run analysis on global refresh
  useEffect(() => { 
    if (globalRefreshTrigger !== lastRefreshTriggerRef.current) {
      lastRefreshTriggerRef.current = globalRefreshTrigger;
      performAnalysis();
    }
  }, [globalRefreshTrigger, performAnalysis]);

  const getActionColor = (action?: ActionType, score: number = 0, mainSignal?: SignalType) => {
    if (isLoading) return 'text-neutral-700 border-white/5';
    if (action === ActionType.MERCADO_CERRADO) return 'text-neutral-600 bg-neutral-900 border-neutral-800';
    if (action === ActionType.ENTRAR_AHORA && score >= 85) {
        if (mainSignal === SignalType.SALE) return 'text-rose-400 bg-rose-500/10 border-rose-500/40';
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/40';
    }
    switch(action) {
      case ActionType.SALIR: return 'text-rose-400 bg-rose-500/10 border-rose-500/40';
      case ActionType.ESPERAR: return 'text-neutral-400 bg-neutral-800/50 border-neutral-700';
      default: return 'text-neutral-600 bg-transparent border-neutral-800';
    }
  };

  const getActionText = (action?: ActionType, score: number = 0, mainSignal?: SignalType) => {
    if (action === ActionType.ENTRAR_AHORA && score >= 85) {
      return mainSignal === SignalType.SALE ? 'VENDER' : 'COMPRAR';
    }
    if (action === ActionType.MERCADO_CERRADO) return 'CERRADO';
    return action || 'STANDBY';
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-neutral-600';
  };
  
  const getRRColor = (rr?: number) => {
    if (!rr) return 'text-neutral-400';
    if (rr >= 2.5) return 'text-cyan-300'; // A+ signal
    if (rr >= 2.0) return 'text-emerald-400'; // Exceptional
    return 'text-amber-400'; // High quality base
  };

  const getSignalQualityMessage = (rr?: number) => {
    if (!rr) return null;
    if (rr >= 2.5) return { label: 'A+  Setup premium', color: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5' };
    if (rr >= 2.0) return { label: 'A   Alta calidad', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' };
    return { label: 'B   Estándar', color: 'text-neutral-400 border-neutral-700 bg-transparent' };
  };

  const getSignalDotColor = (tf: Timeframe) => {
    if (isLoading || !analysis || !analysis.signals) return 'bg-neutral-800';
    const sig = analysis.signals[tf];
    if (sig === SignalType.BUY) return 'bg-emerald-500';
    if (sig === SignalType.SALE) return 'bg-rose-500';
    return 'bg-neutral-800';
  };
  
  const marketOpen = isMarketOpen(instrument.type, instrument.symbol);
  const isHighSignal = analysis?.action === ActionType.ENTRAR_AHORA && (analysis?.powerScore || 0) >= 85;
  const profitInfo = tradeSetup ? calculateProfitDisplay(tradeSetup.tp, tradeSetup.entry, instrument) : null;
  const requestRegistration = () => onRequestRegistration?.();
  const isChartMinimized = chartStatus === 'minimized';
  const shouldHighlightPin = isBookmarked || isChartMinimized;
  const compactPrice = currentPrice > 0 ? formatInstrumentPrice(currentPrice) : null;

  return (
    <>
      {/* Desktop Layout */}
      <div style={{ gridTemplateColumns: DESKTOP_GRID_COLUMNS }} className={`hidden md:grid min-h-[48px] items-center gap-3 px-3 py-1.5 rounded-xl border transition-colors duration-200
        ${isBookmarked ? 'bg-white/[0.04] border-white/10' : 'bg-white/[0.02] border-white/[0.06]'}
        hover:bg-white/[0.04] hover:border-white/10
        ${newSignalTriggerId === globalRefreshTrigger ? 'animate-pulse-new-signal' : ''}`}>
      
      <style jsx>{`
        @keyframes pulseNewSignal {
          0% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          1% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          2% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          3% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          4% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          5% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          6% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          7% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          8% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          9% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          10% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          11.5% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          13% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          15% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          17% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          19.5% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          22% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          25% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          28% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          32% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          36% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          42% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          48% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          56% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          64% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          74% { opacity: 0.4; background-color: rgba(6, 182, 212, 0.02); }
          84% { opacity: 1; background-color: rgba(6, 182, 212, 0.08); }
          100% { opacity: 1; background-color: transparent; }
        }
        .animate-pulse-new-signal {
          animation: pulseNewSignal 30s cubic-bezier(0.4, 0, 0.6, 1);
        }
      `}</style>
      
      <div className="flex items-center justify-center gap-1.5 w-16">
        <span className={`text-[8px] uppercase tracking-wider ${isLoading ? 'text-neutral-500' : marketOpen ? 'text-emerald-500' : 'text-neutral-700'}`}>
          {isLoading ? 'Espera' : marketOpen ? 'Abierto' : 'Cerrado'}
        </span>
        <div className="h-4 w-7 rounded-full transition-all duration-200 flex items-center p-0.5 bg-neutral-900 border border-neutral-800">
          <div className={`h-3 w-3 rounded-full transition-all duration-300 ${isLoading ? 'bg-neutral-600 translate-x-0' : (!marketOpen ? 'bg-neutral-700 translate-x-0' : 'bg-emerald-500 translate-x-3')}`} />
        </div>
      </div>

      <div className="flex w-[200px] shrink-0 items-center gap-1.5 overflow-hidden">
        <InstrumentIcon instrument={instrument} />
        <span className="shrink-0 font-mono text-sm tracking-tight text-white">{instrument.symbol}</span>
        {newSignalTriggerId === globalRefreshTrigger && (
          <span className="shrink-0 rounded border border-cyan-500/25 bg-cyan-500/15 px-1 py-0.5 text-[7px] uppercase tracking-widest text-cyan-400">
            NOW
          </span>
        )}
        {compactPrice && (
          <span className="shrink-0 font-mono leading-none text-neutral-200">
            <span className="text-xs font-semibold">{compactPrice.primary}</span>
            {compactPrice.fraction && <span className="text-[8px] text-neutral-500">{compactPrice.fraction}</span>}
          </span>
        )}
        <span className="hidden truncate text-[8px] font-medium text-neutral-500 xl:inline">{instrument.name}</span>
        <button onClick={togglePin} className={`ml-auto shrink-0 p-0.5 transition-colors ${shouldHighlightPin ? 'text-amber-300' : 'text-neutral-700 hover:text-neutral-400'}`} title={shouldHighlightPin ? 'Quitar fijación' : 'Fijar arriba'}>
          <Pin className="h-4 w-4" fill={shouldHighlightPin ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="w-[100px] shrink-0 flex items-center justify-center">
        <button onClick={() => onOpenChart(instrument.symbol)} className={`w-[110px] flex items-center justify-center gap-2 rounded border px-2 py-1 text-[9px] uppercase tracking-wider transition-colors ${getActionColor(analysis?.action, analysis?.powerScore, analysis?.mainSignal)} ${chartStatus === 'minimized' ? 'ring-2 ring-cyan-400/80 border-cyan-300 bg-cyan-500/15 text-cyan-100 animate-pulse' : chartStatus === 'visible' ? 'ring-1 ring-cyan-500/40' : ''}`} title="Abrir gráfico y ver acción">
          <span className="flex items-center gap-2">
          <ChartMonitorIcon className="h-3 w-3" />
          <span>{getActionText(analysis?.action, analysis?.powerScore, analysis?.mainSignal)}</span>
          </span>
        </button>
      </div>

      <div className="grid w-[96px] shrink-0 grid-cols-4 gap-1">
        {(['4h', '1h', '15min', '5min'] as Timeframe[]).map(tf => (
          <div key={tf} className="flex min-w-0 flex-col gap-0.5">
            <span className="text-center text-[7px] uppercase text-neutral-600">{tf}</span>
            <div className={`mx-auto h-1 w-1/2 rounded-sm transition-colors duration-200 ${getSignalDotColor(tf)}`}></div>
          </div>
        ))}
      </div>

      <div className="flex w-[61px] shrink-0 items-center justify-center gap-1">
        <span className={`font-mono text-base ${getScoreColor(analysis?.powerScore || 0)}`}>
            {isLoading ? '--' : `${analysis?.powerScore || 0}`}
        </span>
        <span className="text-[7px] uppercase tracking-wider text-neutral-700">Score</span>
      </div>

      <div className="w-[365px] shrink-0">
        {tradeSetup && isHighSignal && (
            <div className="relative flex items-center justify-between gap-3 rounded border border-neutral-800 bg-neutral-900 px-3 py-1 font-mono text-[10px]">
                <button onClick={() => handleCopySetupValue('ENTRY', tradeSetup.entry)} className="min-w-0 whitespace-nowrap text-left hover:opacity-80 transition-opacity" title="Copiar ENTRY">
                  <span className="text-[9px] text-cyan-400">{copyStatus === 'ENTRY' ? 'Copiado' : 'ENTRY'} </span>
                  <span className={`text-xs text-cyan-200 ${isPreview ? 'blur-sm select-none' : ''}`}>{formatSetupValue(tradeSetup.entry)}</span>
                </button>
                <button onClick={() => handleCopySetupValue('TakeProfit', tradeSetup.tp)} className="min-w-0 whitespace-nowrap text-left hover:opacity-80 transition-opacity" title="Copiar TakeProfit">
                  <span className="text-[9px] text-cyan-400">{copyStatus === 'TakeProfit' ? 'Copiado' : 'TP'} </span>
                  <span className={`text-xs text-cyan-200 ${isPreview ? 'blur-sm select-none' : ''}`}>{formatSetupValue(tradeSetup.tp)}</span>
                </button>
                {experimentalSlEnabled && tradeSetup.sl ? (
                  <button onClick={() => handleCopySetupValue('StopLoss', tradeSetup.sl)} className="min-w-0 whitespace-nowrap text-left hover:opacity-80 transition-opacity" title="Copiar StopLoss">
                    <span className="text-[9px] text-amber-400">{copyStatus === 'StopLoss' ? 'Copiado' : 'SL'} </span>
                    <span className={`text-xs text-amber-100 ${isPreview ? 'blur-sm select-none' : ''}`}>{formatSetupValue(tradeSetup.sl)}</span>
                  </button>
                ) : (
                  <div className="min-w-0 whitespace-nowrap">
                    <span className="text-[9px] text-amber-400">SL </span>
                    <span className="text-xs text-amber-100">--</span>
                  </div>
                )}
                {isPreview && <button type="button" onClick={requestRegistration} className="absolute inset-0 flex items-center justify-center rounded bg-black/45 text-[9px] font-bold uppercase tracking-wider text-emerald-200 backdrop-blur-[1px]">Crear cuenta para desbloquear</button>}
            </div>
        )}
      </div>

      <div className="flex w-[105px] shrink-0 items-center justify-center">
        {profitInfo && tradeSetup?.rr && !copyStatus && (() => {
          const qualityMsg = getSignalQualityMessage(tradeSetup.rr);
          return (
            <button type="button" onClick={isPreview ? requestRegistration : undefined} className="relative flex items-center gap-1">
              <div className="flex items-baseline gap-1">
                <span className={`font-mono text-base leading-none ${getRRColor(tradeSetup.rr)} ${isPreview ? 'blur-sm select-none' : ''}`}>{profitInfo.value}</span>
                <span className="text-[8px] text-neutral-500">{profitInfo.unit}</span>
              </div>
              {qualityMsg && <div className={`rounded border px-1 py-0.5 font-mono text-[8px] leading-tight ${qualityMsg.color} ${isPreview ? 'blur-sm select-none' : ''}`}>{qualityMsg.label.replace('Setup ', '')}</div>}
            </button>
          );
        })()}
      </div>

      <div className="flex items-center justify-center">
        {stats && stats.totalSignals > 0 ? (
          <button type="button" onClick={isPreview ? requestRegistration : undefined} className="flex items-baseline gap-1 font-mono">
            <div className={`${stats.winRatePct !== null && stats.winRatePct >= 50 ? 'text-emerald-400 text-base' : 'text-rose-400 text-base'} ${isPreview ? 'blur-sm select-none' : ''}`}>
              {stats.winRatePct ?? '--'}%
            </div>
            <div className={`text-[8px] text-neutral-500 ${isPreview ? 'blur-sm select-none' : ''}`}>{stats.totalSignals} cerradas</div>
          </button>
        ) : (
          <span className="text-[9px] text-neutral-700">Sin datos</span>
        )}
      </div>

      <div className="text-center">
        {experimentalSlEnabled && <span className="text-[9px] text-neutral-700">En evaluación</span>}
      </div>

      <div aria-hidden="true" />

      <div className="text-center">
        <button onClick={onOpenTutorial} className="rounded border border-cyan-400/40 px-2 py-1 text-[8px] font-bold tracking-wider text-cyan-200 transition-colors hover:bg-cyan-400/10 hover:text-white">TUTORIAL</button>
      </div>

    </div>

    {/* Mobile Layout - Card Style */}
    <div className={`md:hidden flex flex-col gap-3 p-3 rounded-lg border transition-colors duration-200
      ${isBookmarked ? 'bg-white/[0.04] border-white/10' : 'bg-white/[0.02] border-white/[0.06]'}
      ${newSignalTriggerId === globalRefreshTrigger ? 'animate-pulse-new-signal' : ''}`}>
      
      {/* Row 1: Symbol, Status, Pin */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2">
            <InstrumentIcon instrument={instrument} />
            <span className="font-mono text-white text-sm tracking-tight">{instrument.symbol}</span>
            {newSignalTriggerId === globalRefreshTrigger && (
              <span className="px-1.5 py-0.5 rounded text-[7px] uppercase tracking-widest bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                NOW
              </span>
            )}
            <div className="h-4 w-7 rounded-full transition-all duration-200 flex items-center p-0.5 bg-neutral-900 border border-neutral-800 ml-auto">
              <div className={`h-3 w-3 rounded-full transition-all duration-300 ${isLoading ? 'bg-neutral-600 translate-x-0' : (!marketOpen ? 'bg-neutral-700 translate-x-0' : 'bg-emerald-500 translate-x-3')}`} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] text-neutral-500 font-medium">{instrument.name}</span>
            <span className="text-[8px] text-neutral-700 uppercase">{instrument.type}</span>
          </div>
        </div>
        <button onClick={togglePin} className={`p-1 rounded transition-colors ${shouldHighlightPin ? 'text-amber-300' : 'text-neutral-700'}`} title={shouldHighlightPin ? 'Quitar fijación' : 'Fijar arriba'}>
          <Pin className="w-6 h-6" fill={shouldHighlightPin ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Row 2: Price, Score, Chart Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {compactPrice && (
            <span className="font-mono leading-none text-neutral-300">
              <span className="text-sm font-semibold">{compactPrice.primary}</span>
              {compactPrice.fraction && <span className="text-[9px] text-neutral-500">{compactPrice.fraction}</span>}
            </span>
          )}
          <div className="flex flex-col items-center">
            <span className={`text-sm font-mono ${getScoreColor(analysis?.powerScore || 0)}`}>
              {isLoading ? '--' : `${analysis?.powerScore || 0}`}
            </span>
            <span className="text-[7px] text-neutral-700 uppercase">Score</span>
          </div>
        </div>
        <button onClick={() => onOpenChart(instrument.symbol)} className={`w-[118px] flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded border text-[9px] uppercase tracking-wider transition-colors ${getActionColor(analysis?.action, analysis?.powerScore, analysis?.mainSignal)} ${chartStatus === 'minimized' ? 'ring-2 ring-cyan-400/80 border-cyan-300 bg-cyan-500/15 text-cyan-100 animate-pulse' : chartStatus === 'visible' ? 'ring-1 ring-cyan-500/40' : ''}`}>
          <span className="flex items-center gap-2">
            <ChartMonitorIcon className="w-4 h-4" />
            <span>{getActionText(analysis?.action, analysis?.powerScore, analysis?.mainSignal)}</span>
          </span>
          {chartStatus === 'minimized' && <span className="text-[7px] tracking-widest text-cyan-200">GRÁFICO FIJADO</span>}
        </button>
      </div>

      {/* Row 3: Trade Setup (if available) */}
      {tradeSetup && isHighSignal && (
        <div className="relative flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-[10px] font-mono w-full">
          <div className="flex items-center gap-3">
            <button onClick={() => handleCopySetupValue('ENTRY', tradeSetup.entry)} className="text-left text-cyan-200 hover:opacity-80 transition-opacity" title="Copiar ENTRY">
              <span className="text-cyan-400">ENTRY: </span><span className={isPreview ? 'blur-sm select-none' : ''}>{copyStatus === 'ENTRY' ? 'Copiado' : tradeSetup.entry.toFixed(4)}</span>
            </button>
            <button onClick={() => handleCopySetupValue('TakeProfit', tradeSetup.tp)} className="text-left text-cyan-200 hover:opacity-80 transition-opacity" title="Copiar TakeProfit">
              <span className="text-cyan-400">TakeProfit: </span><span className={isPreview ? 'blur-sm select-none' : ''}>{copyStatus === 'TakeProfit' ? 'Copiado' : tradeSetup.tp.toFixed(4)}</span>
            </button>
            {experimentalSlEnabled && tradeSetup.sl && (
              <button onClick={() => handleCopySetupValue('StopLoss', tradeSetup.sl)} className="text-left text-amber-100 hover:opacity-80 transition-opacity" title="Copiar StopLoss">
                <span className="text-amber-300">StopLoss: </span><span className={isPreview ? 'blur-sm select-none' : ''}>{copyStatus === 'StopLoss' ? 'Copiado' : formatSetupValue(tradeSetup.sl)}</span>
              </button>
            )}
          </div>
          {profitInfo && (
            <div className="flex flex-col items-center">
              <span className={`text-sm font-mono ${getRRColor(tradeSetup.rr || 0)} ${isPreview ? 'blur-sm select-none' : ''}`}>{profitInfo.value}</span>
              <span className="text-[7px] text-neutral-600">{profitInfo.unit}</span>
            </div>
          )}
          {isPreview && <button type="button" onClick={requestRegistration} className="absolute inset-0 flex items-center justify-center rounded bg-black/45 text-[9px] font-bold uppercase tracking-wider text-emerald-200 backdrop-blur-[1px]">Crear cuenta para desbloquear</button>}
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-1.5 rounded border border-white/10 bg-white/[0.02] text-[10px] font-mono w-full">
        <span className="text-neutral-400">Precisión</span>
        {stats && stats.totalSignals > 0 ? (
          <button type="button" onClick={isPreview ? requestRegistration : undefined} className={`${stats.winRatePct !== null && stats.winRatePct >= 50 ? 'text-emerald-400 text-xs' : 'text-rose-400 text-xs'} ${isPreview ? 'blur-sm select-none' : ''}`}>{stats.winRatePct ?? '--'}% · {stats.totalSignals} cerradas</button>
        ) : (
          <span className="text-neutral-700">Sin datos</span>
        )}
      </div>

      {experimentalSlEnabled && (
        <>
          {tradeSetup?.sl && (
            <button onClick={() => setIsSlInfoOpen(true)} className="flex items-center justify-between px-3 py-1.5 rounded border border-amber-500/20 bg-amber-500/5 text-[10px] font-mono w-full">
              <span className="text-amber-300">SL experimental</span>
              <span className="flex items-center gap-1 text-amber-100">{formatSetupValue(tradeSetup.sl)} <Info className="w-3 h-3" /></span>
            </button>
          )}
          <div className="flex items-center justify-between px-3 py-1.5 rounded border border-amber-500/20 bg-amber-500/5 text-[10px] font-mono w-full">
            <span className="text-amber-300">Validación SL</span>
            <span className="text-neutral-600">En evaluación</span>
          </div>
        </>
      )}

      {experimentalSlEnabled && isSlInfoOpen && tradeSetup?.sl && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4" onClick={() => setIsSlInfoOpen(false)}>
          <div className="w-full max-w-md border border-amber-500/30 bg-[#111] p-5 rounded-lg text-sm" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-amber-300 font-semibold">SL experimental · {instrument.symbol}</div>
              <button onClick={() => setIsSlInfoOpen(false)} className="text-neutral-500 hover:text-white">Cerrar</button>
            </div>
            <div className="space-y-2 font-mono text-xs text-neutral-300">
              <div>Dirección: <span className="text-white">{analysis?.mainSignal === SignalType.SALE ? 'VENTA' : 'COMPRA'}</span></div>
              <div>Entry: <span className="text-white">{formatSetupValue(tradeSetup.entry)}</span> · TP: <span className="text-white">{formatSetupValue(tradeSetup.tp)}</span></div>
              <div>{analysis?.mainSignal === SignalType.SALE ? 'Máximo estructural' : 'Mínimo estructural'}: <span className="text-white">{formatSetupValue(tradeSetup.slStructurePrice || 0)}</span></div>
              <div>ATR: <span className="text-white">{formatSetupValue(tradeSetup.slAtr || 0)}</span> · Margen: <span className="text-white">{formatSetupValue(tradeSetup.slMargin || 0)}</span></div>
              <div className="pt-2 border-t border-white/10 text-amber-100">SL = estructura {analysis?.mainSignal === SignalType.SALE ? '+' : '-'} 20% del ATR = {formatSetupValue(tradeSetup.sl)}</div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-neutral-500">Nivel calculado para evaluación con las últimas 20 velas de 5 minutos. No es una orden automática.</p>
          </div>
        </div>
      )}

      <button onClick={onOpenTutorial} className="rounded border border-cyan-400/40 px-2 py-1.5 text-[9px] font-bold tracking-wider text-cyan-200 transition-colors hover:bg-cyan-400/10 hover:text-white w-full">TUTORIAL</button>
    </div>
    </>
  );
};

export default memo(InstrumentRow);