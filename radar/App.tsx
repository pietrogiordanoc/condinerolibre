import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ALL_INSTRUMENTS, REFRESH_INTERVAL_MS } from './constants.tsx';
import { STRATEGIES } from './utils/tradingLogic';
import { MultiTimeframeAnalysis, ActionType } from './types';
import InstrumentRow, { GlobalAnalysisCache } from './components/InstrumentRow';
import TimerDonut from './components/TimerDonut';
import TradingViewModal from './components/TradingViewModal';
import TendencialModal from './components/TendencialModal';
import Radar from './components/Radar';
import SessionMonitor from './components/SessionMonitor';
import { audioService } from './utils/audioService';
import { supabase } from './services/supabaseClient';

type SortConfig = { key: 'symbol' | 'action' | 'signal' | 'price' | 'score'; direction: 'asc' | 'desc' } | null;

const normalizeSearchText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const pairBases = new Set(
  ALL_INSTRUMENTS
    .filter(({ symbol }) => symbol.includes('/'))
    .map(({ symbol }) => symbol.split('/')[0])
);
const TUTORIAL_VIDEO_URL = 'https://yhgqmbexjscojlrzguvh.supabase.co/storage/v1/object/public/Video%20Tutoriales/TutorialExpress.mp4';

const App: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filter, setFilter] = useState<'all' | 'forex' | 'indices' | 'stocks' | 'commodities' | 'crypto'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem('alertVolume') || '0.5'));
  const [charts, setCharts] = useState<Record<string, 'visible' | 'minimized'>>({});
  const [audioReady, setAudioReady] = useState(() => localStorage.getItem('audioActivated') === 'true');
  const [isRadarVisible, setIsRadarVisible] = useState(false);
  const [isTendencialModalVisible, setIsTendencialModalVisible] = useState(false);
  const [showDebugFrames, setShowDebugFrames] = useState(false);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [experimentalSlEnabled, setExperimentalSlEnabled] = useState(false);
  const [metricInfo, setMetricInfo] = useState<'history' | 'sl' | null>(null);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialVideoError, setTutorialVideoError] = useState(false);
  const [signalStats, setSignalStats] = useState<Record<string, { totalSignals: number; winRatePct: number | null; avgResultPct: number | null }>>({});
  
  const analysesRef = useRef<Record<string, MultiTimeframeAnalysis>>({});
  const [forceUpdateTrigger, forceUpdate] = useState(0);

  // Formatear números con punto como separador de miles (formato español)
  const formatNumber = (num: number, decimals: number = 0): string => {
    const parts = num.toFixed(decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decimals > 0 ? parts.join(',') : parts[0];
  };

  // Guardar volumen de alertas en localStorage
  useEffect(() => {
    localStorage.setItem('alertVolume', volume.toString());
    audioService.setVolume(volume);
  }, [volume]);

  // Cargar estadísticas históricas de aciertos por instrumento (una sola vez, no es polling)
  useEffect(() => {
    supabase
      .from('radar_signal_stats')
      .select('instrument_symbol, total_signals, win_rate_pct, avg_result_pct')
      .then(({ data, error }) => {
        if (error) {
          console.error('[SignalStats] Error cargando estadísticas:', error.message);
          return;
        }
        if (data) {
          const map: Record<string, { totalSignals: number; winRatePct: number | null; avgResultPct: number | null }> = {};
          data.forEach((row: any) => {
            map[row.instrument_symbol] = {
              totalSignals: row.total_signals,
              winRatePct: row.win_rate_pct,
              avgResultPct: row.avg_result_pct,
            };
          });
          setSignalStats(map);
        }
      });
  }, []);

  useEffect(() => {
    audioService.setVolume(volume);
  }, []);

  // Listener para Shift + F10 (toggle debug frames)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'F10') {
        e.preventDefault();
        setShowDebugFrames(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Auto-activar audio en el primer click del usuario (bypass autoplay policy)
  useEffect(() => {
    if (audioReady) return; // Ya activado previamente

    const activateAudio = async () => {
      // Asegurar que el contexto está inicializado
      audioService.initialize();
      const ctx = audioService.getContext();
      console.log('[AudioService] Estado del contexto:', ctx?.state);
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
        console.log('[AudioService] AudioContext resumed');
      }
      setAudioReady(true);
      localStorage.setItem('audioActivated', 'true');
    };

    const handleFirstInteraction = () => {
      activateAudio();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [audioReady]);

  // Reanudar AudioContext cuando la página vuelve a estar visible (al cambiar de escritorio/pestaña)
  useEffect(() => {
    if (!audioReady) return; // Solo si ya fue activado

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        const ctx = audioService.getContext();
        if (ctx && ctx.state === 'suspended') {
          try {
            await ctx.resume();
            console.log('[AudioService] AudioContext reanudado al volver a la pestaña');
          } catch (error) {
            console.error('[AudioService] Error al reanudar:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [audioReady]);

  // Validar acceso al radar (protección contra acceso directo sin autenticación)
  useEffect(() => {
    const validateAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Sin sesión → redirigir a login
        if (!session) {
          console.log('[Radar] Sin sesión - redirigiendo a login');
          window.location.href = '/login?next=/radar';
          return;
        }

        // Perfil incompleto (falta nombre o teléfono) → completar antes de usar el Radar
        setUserId(session.user.id);
        let profileResp = await supabase
          .from('profiles')
          .select('full_name, phone, experimental_sl_enabled')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profileResp.error) {
          // Compatibilidad de esquema: algunos entornos usan profiles.user_id en vez de profiles.id
          profileResp = await supabase
            .from('profiles')
            .select('full_name, phone, experimental_sl_enabled')
            .eq('user_id', session.user.id)
            .maybeSingle();
        }
        const profile = profileResp.data;

        const hasName = !!(profile?.full_name && profile.full_name.trim());
        const hasPhone = !!(profile?.phone && profile.phone.trim());
        setExperimentalSlEnabled(profile?.experimental_sl_enabled === true);
        if (!hasName || !hasPhone) {
          console.log('[Radar] Perfil incompleto - redirigiendo al portal');
          window.location.href = '/dashboard#radar';
          return;
        }
        
        // Validar con radar-access
        const res = await fetch('https://yhgqmbexjscojlrzguvh.supabase.co/functions/v1/radar-access', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ action: 'check' })
        });
        
        const data = await res.json();
        
        // Sin acceso → redirigir a upgrade
        if (!data.allowed) {
          console.log('[Radar] Sin tiempo freemium - redirigiendo a upgrade');
          window.location.href = '/dashboard#upgrade';
        } else {
          console.log('[Radar] Acceso validado ✅');
        }
      } catch (error) {
        console.error('[Radar] Error validando acceso:', error);
        // En caso de error, permitir acceso (fail-open para no bloquear por errores de red)
      }
    };
    
    validateAccess();
  }, []);

  const handleRefreshComplete = useCallback(() => {
    setRefreshTrigger(t => t + 1);
  }, []);

  const handleAnalysisUpdate = useCallback((id: string, data: MultiTimeframeAnalysis | null) => {
    if (!data) return;
    analysesRef.current[id] = data;
    forceUpdate(t => t + 1);
  }, []);

  const requestSort = (key: 'symbol' | 'action' | 'signal' | 'price' | 'score') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const playManualSound = (type: 'entry' | 'exit') => {
    audioService.play(type);
  };

  const handleOpenChart = useCallback((symbol: string) => {
    setCharts(prev => {
      // Mantener todos los charts existentes como están y agregar/mostrar el nuevo
      return {
        ...prev,
        [symbol]: 'visible'
      };
    });
  }, []);
  
  const handleMinimizeChart = useCallback((symbol: string) => {
    setCharts(prev => (prev[symbol] ? { ...prev, [symbol]: 'minimized' } : prev));
    const instrument = ALL_INSTRUMENTS.find(item => item.symbol === symbol);
    if (instrument) {
      const saved = localStorage.getItem('bookmarks');
      const pinnedRows = saved ? JSON.parse(saved) : [];
      if (!pinnedRows.includes(instrument.id)) {
        localStorage.setItem('bookmarks', JSON.stringify([...pinnedRows, instrument.id]));
      }
      if (GlobalAnalysisCache[instrument.id]) {
        GlobalAnalysisCache[instrument.id].isBookmarked = true;
      }
      forceUpdate(trigger => trigger + 1);
    }
  }, []);
  
  const handleCloseChart = useCallback((symbol: string) => {
    setCharts(prev => {
      const newChartsState = { ...prev };
      delete newChartsState[symbol];
      return newChartsState;
    });
    const instrument = ALL_INSTRUMENTS.find(item => item.symbol === symbol);
    if (instrument) {
      const saved = localStorage.getItem('bookmarks');
      const pinnedRows = saved ? JSON.parse(saved) : [];
      localStorage.setItem('bookmarks', JSON.stringify(pinnedRows.filter((id: string) => id !== instrument.id)));
      if (GlobalAnalysisCache[instrument.id]) {
        GlobalAnalysisCache[instrument.id].isBookmarked = false;
      }
      forceUpdate(trigger => trigger + 1);
    }
  }, []);

  const handleOpenTutorial = useCallback(() => {
    setTutorialVideoError(false);
    setIsTutorialOpen(true);
  }, []);

  const handleSearchChange = (value: string) => {
    const uppercaseValue = value.toUpperCase();
    const compactValue = uppercaseValue.replace(/[^A-Z0-9]/g, '');
    const pairBase = compactValue.slice(0, 3);
    const hasSeparator = /[\s/\-]/.test(value);

    if (!hasSeparator && compactValue.length >= 3 && pairBases.has(pairBase)) {
      setSearchQuery(`${pairBase}/${compactValue.slice(3)}`);
      return;
    }

    setSearchQuery(uppercaseValue);
  };

  // Función helper para determinar si un instrumento debe ser VISIBLE (no eliminado)
  const isInstrumentVisible = useCallback((instrument: typeof ALL_INSTRUMENTS[0]) => {
    // Filtro por categoría
    if (filter !== 'all' && instrument.type !== filter) return false;
    
    // Filtro por búsqueda
    const normalizedQuery = normalizeSearchText(searchQuery);
    if (normalizedQuery) {
      const matchesSymbol = normalizeSearchText(instrument.symbol).includes(normalizedQuery);
      const matchesName = normalizeSearchText(instrument.name).includes(normalizedQuery);
      const matchesType = normalizeSearchText(instrument.type).includes(normalizedQuery);
      if (!matchesSymbol && !matchesName && !matchesType) return false;
    }
    
    return true;
  }, [filter, searchQuery, forceUpdateTrigger]);

  // Calcular estadísticas de actividad del mercado
  const marketQuietnessStats = useMemo(() => {
    const visibleInstruments = ALL_INSTRUMENTS.filter(i => isInstrumentVisible(i));
    const totalConnected = visibleInstruments.length;
    
    let waiting = 0;
    let entering = 0;
    let exiting = 0;
    
    visibleInstruments.forEach(inst => {
      const analysis = GlobalAnalysisCache[inst.id]?.analysis;
      if (analysis) {
        if (analysis.action === ActionType.ESPERAR) waiting++;
        else if (analysis.action === ActionType.ENTRAR_AHORA) entering++;
        else if (analysis.action === ActionType.SALIR) exiting++;
      } else {
        waiting++; // Si no hay análisis, cuenta como waiting
      }
    });
    
    const quietPercentage = totalConnected > 0 ? Math.round((waiting / totalConnected) * 100) : 0;
    
    return { totalConnected, waiting, entering, exiting, quietPercentage };
  }, [forceUpdateTrigger, filter, searchQuery]);

  const sortedInstruments = useMemo(() => {
    const items = ALL_INSTRUMENTS;
    const currentAnalyses = analysesRef.current;

    return [...items].sort((a, b) => {
      const analysisA = currentAnalyses[a.id];
      const analysisB = currentAnalyses[b.id];
      
      // 🎯 PRIORIDAD MÁXIMA: Obtener info del cache global
      const cacheA = GlobalAnalysisCache[a.id];
      const cacheB = GlobalAnalysisCache[b.id];
      const isBookmarkedA = cacheA?.isBookmarked === true;
      const isBookmarkedB = cacheB?.isBookmarked === true;
      const isNewSignalA = cacheA?.newSignalTriggerId === refreshTrigger;
      const isNewSignalB = cacheB?.newSignalTriggerId === refreshTrigger;

      // 🟢 PRIORIDAD 0: INSTRUMENTOS DESTACADOS (bookmark) van SIEMPRE PRIMERO
      if (isBookmarkedA && !isBookmarkedB) return -1;
      if (!isBookmarkedA && isBookmarkedB) return 1;

      // 🚨 PRIORIDAD 1: Señales "NOW" (nuevas) van SIEMPRE arriba, sin excepción
      if (isNewSignalA && !isNewSignalB) return -1;
      if (!isNewSignalA && isNewSignalB) return 1;
      
      // 🔥 PRIORIDAD 2: Si AMBAS son "NOW", ordenar por SCORE DESCENDENTE (mayor score primero)
      if (isNewSignalA && isNewSignalB) {
        return (analysisB?.powerScore || 0) - (analysisA?.powerScore || 0);
      }

      // 📊 PRIORIDAD 3: Para señales NO-NOW, aplicar sortConfig si existe
      if (sortConfig) {
        const { key, direction } = sortConfig;
        let valA: any, valB: any;
        
        if (key === 'action') {
          const actionOrder = {
            [ActionType.ESPERAR]: 1,
            [ActionType.NADA]: 1,
            [ActionType.ENTRAR_AHORA]: 2,
            [ActionType.SALIR]: 3,
            [ActionType.MERCADO_CERRADO]: 4,
            [ActionType.NOTICIA]: 5
          };
          valA = actionOrder[analysisA?.action || ActionType.NADA];
          valB = actionOrder[analysisB?.action || ActionType.NADA];
        } else if (key === 'symbol') { valA = a.symbol; valB = b.symbol; }
        else if (key === 'price') { valA = analysisA?.price || 0; valB = analysisB?.price || 0; }
        else if (key === 'score') { valA = analysisA?.powerScore || 0; valB = analysisB?.powerScore || 0; }
        else if (key === 'signal') { valA = analysisA?.mainSignal || ''; valB = analysisB?.mainSignal || ''; }
        
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
      }

      // 🎲 PRIORIDAD 4: Default sort por score y señales de entrada
      const isEntryA = analysisA?.action === ActionType.ENTRAR_AHORA;
      const isEntryB = analysisB?.action === ActionType.ENTRAR_AHORA;
      if (isEntryA && !isEntryB) return -1;
      if (!isEntryA && isEntryB) return 1;
      
      return (analysisB?.powerScore || 0) - (analysisA?.powerScore || 0);
    });
  }, [sortConfig, refreshTrigger, forceUpdateTrigger]);

  // Detectar si hay algún chart visible para ajustar z-index del header
  const hasVisibleChart = Object.values(charts).some(status => status === 'visible');

  return (
    <div className="min-h-screen pb-24 bg-[#050505] text-white selection:bg-emerald-500/30">
      {/* Mensaje de activación de audio */}
      {!audioReady && (
        <div className="fixed top-4 right-4 z-[500] px-4 py-2 bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 rounded-lg shadow-lg backdrop-blur-sm animate-pulse">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <span className="text-xs font-medium text-orange-300">Click anywhere to enable audio alerts</span>
          </div>
        </div>
      )}

      <header className={`sticky top-0 bg-[#050505]/95 backdrop-blur-2xl border-b border-white/5 px-4 md:px-8 py-3 md:py-5 ${hasVisibleChart ? 'z-50' : 'z-[150]'}`}>
        <div className="max-w-[1500px] mx-auto flex flex-col items-start md:items-center md:flex-row justify-between gap-3 md:gap-6">
          <div className={`flex items-center space-x-3 md:space-x-4 p-1 md:p-2 relative ${showDebugFrames ? 'border-2 border-red-500' : ''}`}>
            {showDebugFrames && <span className="absolute -top-3 left-2 bg-[#050505] px-2 text-xs text-red-500 z-50">HEADER-1: LOGO</span>}
            <div 
              className="relative w-10 h-10 md:w-14 md:h-14 cursor-pointer group"
              onClick={() => setIsRadarVisible(true)}
            >
              <div className="absolute inset-0 bg-emerald-500/10 rounded-full border-2 border-emerald-500/20 group-hover:border-emerald-500/50 transition-colors"></div>
              <div className="absolute inset-2 bg-black/20 rounded-full"></div>
              <div 
                className="absolute inset-0 w-full h-full bg-no-repeat bg-center"
                style={{
                  backgroundImage: `conic-gradient(from 0deg, transparent 0%, #10b98130 5%, transparent 20%)`,
                  animation: 'spin 4s linear infinite'
                }}
              ></div>
              <svg className="absolute inset-0 w-full h-full text-emerald-500/60" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeWidth="0.5" d="M12 2 L12 22 M2 12 L22 12" />
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="0.5" />
                <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="0.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black tracking-tighter text-white uppercase">CDLRadar V5.8</h1>
              <div className="flex items-center space-x-2">
                <span className="h-1.5 w-1.5 md:h-2 md:w-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-neutral-500">Live Market Scanner</span>
              </div>
            </div>
          </div>

          <div className={`flex flex-wrap items-center gap-2 md:space-x-6 md:gap-0 p-1 md:p-2 relative w-full md:w-auto ${showDebugFrames ? 'border-2 border-green-500' : ''}`}>
            {showDebugFrames && <span className="absolute -top-3 left-2 bg-[#050505] px-2 text-xs text-green-500 z-50">HEADER-3: CONTROLS</span>}
            <div className="hidden md:flex items-center space-x-4 bg-white/5 p-2 px-3 rounded-xl border border-white/10 relative">
              {showDebugFrames && <span className="absolute -top-3 left-2 bg-[#050505] px-1 text-[9px] text-orange-400 z-50">H3B-Audio</span>}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => playManualSound('entry')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                  title="Test Entry Sound"
                >
                  Entry
                </button>
                <button 
                  onClick={() => playManualSound('exit')}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-500 text-[9px] font-black uppercase border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                  title="Test Exit Sound"
                >
                  Exit
                </button>
              </div>
              <div className="h-6 w-px bg-white/10"></div>
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={volume} 
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-16 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <button 
                  onClick={() => {
                    console.log('[Audio Test] Estado audioReady:', audioReady);
                    console.log('[Audio Test] Estado AudioContext:', audioService.getContext()?.state);
                    audioService.play('entry');
                  }}
                  className="px-2 py-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded transition-colors"
                  title="Probar sonido de alerta"
                >
                  TEST
                </button>
                <div 
                  className={`w-2 h-2 rounded-full ${audioReady ? 'bg-emerald-500' : 'bg-yellow-500'}`}
                  title={audioReady ? 'Audio activado' : 'Haz click para activar audio'}
                ></div>
              </div>
            </div>
            <div className={`p-1 relative ${showDebugFrames ? 'border-2 border-pink-500' : ''}`}>
              {showDebugFrames && <span className="absolute -top-3 left-2 bg-[#050505] px-1 text-[9px] text-pink-400 z-50">H3D-Timer</span>}
              <TimerDonut 
              durationMs={REFRESH_INTERVAL_MS} 
              onComplete={handleRefreshComplete} 
                isPaused={false}
              onClick={handleRefreshComplete}
            />
            </div>
          </div>
        </div>
        
        {/* HEADER-4: FILTERS + MENU ROW */}
        <div className={`max-w-[1500px] mx-auto px-4 md:px-8 py-2 relative ${showDebugFrames ? 'border-2 border-purple-500' : ''}`}>
          {showDebugFrames && <span className="absolute -top-3 left-4 md:left-8 bg-[#050505] px-2 text-xs text-purple-500 z-50">HEADER-4: FILTERS+MENU</span>}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-start gap-3 md:gap-4">
            {/* Search */}
            <input 
              type="text" 
              placeholder="Buscar: EURUSD, BTC o nombre"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg md:rounded-xl px-3 md:px-4 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500/50 w-full md:w-[280px] transition-all"
            />
            
            {/* Separator - Hidden on mobile */}
            <div className="hidden md:block h-6 w-px bg-white/10"></div>
            
            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
              {(['all', 'forex', 'indices', 'stocks', 'commodities', 'crypto'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all duration-300 border whitespace-nowrap flex-shrink-0
                    ${filter === f 
                      ? 'bg-emerald-500 border-emerald-400 text-black' 
                      : 'bg-white/5 border-white/5 text-neutral-500 hover:text-white hover:bg-white/10'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            
            {/* Separator - Hidden on mobile */}
            <div className="hidden md:block h-6 w-px bg-white/10"></div>
            
            {/* Menu Buttons - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-3">
              <button onClick={() => setIsTendencialModalVisible(true)} className="text-[10px] font-bold text-neutral-500 hover:text-white transition-colors uppercase tracking-widest">Tendencial</button>
              <button className="text-[10px] font-bold text-neutral-500 hover:text-white transition-colors uppercase tracking-widest">Fundamentales</button>
              <button className="text-[10px] font-bold text-neutral-500 hover:text-white transition-colors uppercase tracking-widest">Calendario</button>
              <button className="text-[10px] font-bold text-neutral-500 hover:text-white transition-colors uppercase tracking-widest">Mercado Cripto</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 md:px-8 mt-4 md:mt-6">
        <SessionMonitor marketStats={marketQuietnessStats} />
        
        <div className="grid grid-cols-1 gap-3 md:gap-4">
          {/* Desktop table header - Hidden on mobile */}
          <div className="hidden md:flex sticky top-[104px] z-40 items-center justify-start gap-4 px-4 py-3 bg-[#080808]/95 backdrop-blur-xl rounded-xl border border-white/10 mb-4 text-[10px] uppercase tracking-widest text-neutral-600">
            <div className="w-16 text-center shrink-0">Status</div>
            <div className="w-[190px] shrink-0 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('symbol')}>Instrument</div>
            <div className="w-[110px] shrink-0 text-center">Acción</div>
            <div className="w-[124px] shrink-0 text-center">MTF Alignment</div>
            <div className="w-14 shrink-0 text-center">
              <span className="cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('score')}>Score</span>
            </div>
            <div className="w-[280px] shrink-0 text-center">Trade Setup</div>
            <div className="w-[84px] shrink-0 text-center">Pips</div>
            <div className="w-[104px] shrink-0 text-center">
              <button onClick={() => setMetricInfo('history')} className="inline-flex items-center gap-1 hover:text-white" title="Estadística de precisión">
                Precisión <span className="rounded-full border border-neutral-600 px-1 text-[8px] normal-case">i</span>
              </button>
            </div>
            {experimentalSlEnabled && (
              <div className="w-[120px] shrink-0 text-center">
                <button onClick={() => setMetricInfo('sl')} className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-100" title="Cómo se calcula Validación SL">
                  Validación SL <span className="rounded-full border border-amber-500/60 px-1 text-[8px] normal-case">i</span>
                </button>
              </div>
            )}
            <div className="w-[84px] shrink-0 text-center">Tutorial</div>
          </div>
          
          {sortedInstruments.map(instrument => {
            const isVisible = isInstrumentVisible(instrument);
            return (
              <div key={instrument.id} className={isVisible ? '' : 'hidden'}>
                <InstrumentRow
                  instrument={instrument}
                  isConnected={true}
                  onToggleConnect={() => {}}
                  globalRefreshTrigger={refreshTrigger}
                  strategy={STRATEGIES[0]}
                  onAnalysisUpdate={handleAnalysisUpdate}
                  isTestMode={false}
                  onOpenChart={handleOpenChart}
                  onOpenTutorial={handleOpenTutorial}
                  onPinChange={() => forceUpdate(trigger => trigger + 1)}
                  chartStatus={charts[instrument.symbol]}
                  stats={signalStats[instrument.symbol]}
                  experimentalSlEnabled={experimentalSlEnabled}
                />
              </div>
            );
          })}
          {sortedInstruments.filter(i => isInstrumentVisible(i)).length === 0 && (
            <div className="py-20 text-center text-neutral-600 font-bold uppercase tracking-widest border border-dashed border-white/5 rounded-3xl">
              No instruments found with current filters
            </div>
          )}
        </div>
      </main>

      <div id="chart-modals-container">
        {Object.entries(charts).map(([symbol, status], index) => {
          const instrument = ALL_INSTRUMENTS.find(i => i.symbol === symbol);
          const analysis = instrument ? analysesRef.current[instrument.id] : null;
          if (!instrument) return null;
          
          // Calcular índice para thumbnails (solo contar los minimizados antes de este)
          const minimizedBefore = Object.entries(charts)
            .slice(0, index)
            .filter(([_, s]) => s === 'minimized').length;
          
          return (
            <TradingViewModal
              key={symbol}
              instrument={instrument}
              tradeSetup={analysis?.tradeSetup || null}
              mainSignal={analysis?.mainSignal}
              experimentalSlEnabled={experimentalSlEnabled}
              onOpenTutorial={handleOpenTutorial}
              isVisible={status === 'visible'}
              onMinimize={() => handleMinimizeChart(symbol)}
              onClose={() => handleCloseChart(symbol)}
              onExpand={() => handleOpenChart(symbol)}
              thumbnailIndex={status === 'minimized' ? minimizedBefore : 0}
            />
          );
        })}
      </div>
      
      {isRadarVisible && (
        <Radar
          analyses={Object.values(analysesRef.current).filter(a => a)}
          onClose={() => setIsRadarVisible(false)}
        />
      )}

      {isTendencialModalVisible && (
        <TendencialModal
          isVisible={isTendencialModalVisible}
          onClose={() => setIsTendencialModalVisible(false)}
        />
      )}

      {metricInfo && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 p-4" onClick={() => setMetricInfo(null)}>
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111] p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className={metricInfo === 'sl' ? 'text-amber-300 font-semibold' : 'text-cyan-300 font-semibold'}>{metricInfo === 'history' ? 'Precisión' : 'Validación SL'}</h2>
              <button className="text-sm text-neutral-500 hover:text-white" onClick={() => setMetricInfo(null)}>Cerrar</button>
            </div>
            <p className="text-sm leading-relaxed text-neutral-300">
              {metricInfo === 'history'
                ? 'Estadística de aciertos.'
                : 'Métrica experimental. Cuando haya datos suficientes, comparará si el precio tocó antes el TP o el Stop Loss técnico propuesto. Hoy está en evaluación y no altera el Historial.'}
            </p>
          </div>
        </div>
      )}

      {isTutorialOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-4" onClick={() => setIsTutorialOpen(false)}>
          <div className="w-full max-w-4xl rounded-lg border border-cyan-500/30 bg-[#101820] p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-cyan-200">Tutorial de CDLRadar</h2>
              <button onClick={() => setIsTutorialOpen(false)} className="text-sm text-neutral-500 hover:text-white">Cerrar</button>
            </div>
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded border border-cyan-500/20 bg-black">
              {!tutorialVideoError && <video className="h-full w-full" controls autoPlay src={TUTORIAL_VIDEO_URL} onError={() => setTutorialVideoError(true)}>Tu navegador no puede reproducir este video.</video>}
              {tutorialVideoError && <span className="px-6 text-center text-sm text-neutral-400">No se pudo cargar el video. Verifica que el bucket <span className="text-cyan-300">Video Tutoriales</span> sea público en Supabase.</span>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;