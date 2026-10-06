import React, { useState, useEffect, useMemo, useCallback } from 'react';
import fundamentalsData from '../fundamentals.json';

interface SessionInfo {
  name: string;
  status: 'open' | 'closed' | 'pre-open';
  timeLeft?: string;
  elapsed?: string;
  opensIn?: string;
  openedAt?: number;
  nextChangeAt?: number;
}

interface FundamentalEvent {
  name: string;
  description: string;
  timestamp: number;
  impact: 'high' | 'extreme';
}

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

interface MarketSession {
  timeZone: string;
  opensAt: { hour: number; minute: number };
  closesAt: { hour: number; minute: number };
}

interface TimelineSegment {
  name: string;
  startPercent: number;
  widthPercent: number;
  colorClass: string;
}

const EVENT_TIME_ZONES: Record<string, string> = {
  ET: 'America/New_York',
  GMT: 'Etc/UTC'
};

const ASIA_SESSION: MarketSession = {
  timeZone: 'Asia/Tokyo',
  opensAt: { hour: 8, minute: 0 },
  closesAt: { hour: 17, minute: 0 }
};

const EUROPE_SESSION: MarketSession = {
  timeZone: 'Europe/London',
  opensAt: { hour: 8, minute: 0 },
  closesAt: { hour: 16, minute: 30 }
};

const AMERICA_SESSION: MarketSession = {
  timeZone: 'America/New_York',
  opensAt: { hour: 9, minute: 30 },
  closesAt: { hour: 16, minute: 0 }
};

const WEEKDAY_NUMBERS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

const getZonedDateParts = (date: Date, timeZone: string): ZonedDateParts => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23'
  }).formatToParts(date);

  const getNumber = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find(part => part.type === type)?.value;
    if (!value) throw new Error(`No se pudo obtener ${type} para ${timeZone}.`);
    return Number(value);
  };
  const weekday = parts.find(part => part.type === 'weekday')?.value;
  if (!weekday || !(weekday in WEEKDAY_NUMBERS)) {
    throw new Error(`No se pudo obtener el día de la semana para ${timeZone}.`);
  }

  return {
    year: getNumber('year'),
    month: getNumber('month'),
    day: getNumber('day'),
    hour: getNumber('hour'),
    minute: getNumber('minute'),
    weekday: WEEKDAY_NUMBERS[weekday]
  };
};

const getTimeZoneOffsetMinutes = (date: Date, timeZone: string) => {
  const timeZoneName = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset'
  }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value;

  if (timeZoneName === 'GMT') return 0;
  const match = timeZoneName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`No se pudo obtener el desfase de ${timeZone}.`);

  const offset = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '+' ? offset : -offset;
};

const getZonedTimestamp = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
) => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return utcGuess.getTime() - getTimeZoneOffsetMinutes(utcGuess, timeZone) * 60_000;
};

const isWeekday = (weekday: number) => weekday >= 1 && weekday <= 5;

const getSessionInfo = (session: MarketSession, now: Date) => {
  const localNow = getZonedDateParts(now, session.timeZone);
  const openTimestamp = getZonedTimestamp(
    localNow.year,
    localNow.month,
    localNow.day,
    session.opensAt.hour,
    session.opensAt.minute,
    session.timeZone
  );
  const closeTimestamp = getZonedTimestamp(
    localNow.year,
    localNow.month,
    localNow.day,
    session.closesAt.hour,
    session.closesAt.minute,
    session.timeZone
  );
  const nowTimestamp = now.getTime();
  const isOpen = isWeekday(localNow.weekday) && nowTimestamp >= openTimestamp && nowTimestamp < closeTimestamp;

  if (isOpen) {
    return {
      isOpen,
      minutesUntilChange: Math.ceil((closeTimestamp - nowTimestamp) / 60_000),
      minutesSinceOpen: Math.floor((nowTimestamp - openTimestamp) / 60_000),
      openedAt: openTimestamp,
      nextChangeAt: closeTimestamp
    };
  }

  for (let daysAhead = 0; daysAhead <= 7; daysAhead += 1) {
    const candidate = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day + daysAhead));
    if (!isWeekday(candidate.getUTCDay())) continue;

    const nextOpen = getZonedTimestamp(
      candidate.getUTCFullYear(),
      candidate.getUTCMonth() + 1,
      candidate.getUTCDate(),
      session.opensAt.hour,
      session.opensAt.minute,
      session.timeZone
    );
    if (nextOpen > nowTimestamp) {
      return {
        isOpen,
        minutesUntilChange: Math.ceil((nextOpen - nowTimestamp) / 60_000),
        minutesSinceOpen: undefined,
        openedAt: undefined,
        nextChangeAt: nextOpen
      };
    }
  }

  throw new Error(`No se pudo calcular la próxima apertura de ${session.timeZone}.`);
};

const getTimelineSegments = (now: Date, userTimeZone: string): TimelineSegment[] => {
  const userDate = getZonedDateParts(now, userTimeZone);
  const dayStart = getZonedTimestamp(userDate.year, userDate.month, userDate.day, 0, 0, userTimeZone);
  const nextDay = new Date(Date.UTC(userDate.year, userDate.month - 1, userDate.day + 1));
  const dayEnd = getZonedTimestamp(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
    0,
    0,
    userTimeZone
  );
  const dayDuration = dayEnd - dayStart;
  const sessions = [
    { name: 'ASIA', definition: ASIA_SESSION, colorClass: 'bg-blue-500/20 text-blue-300' },
    { name: 'EU', definition: EUROPE_SESSION, colorClass: 'bg-indigo-500/20 text-indigo-300' },
    { name: 'NY', definition: AMERICA_SESSION, colorClass: 'bg-emerald-500/25 text-emerald-200' }
  ];

  return sessions.flatMap(({ name, definition, colorClass }) => {
    const marketDate = getZonedDateParts(now, definition.timeZone);

    for (let dayOffset = -1; dayOffset <= 1; dayOffset += 1) {
      const candidate = new Date(Date.UTC(marketDate.year, marketDate.month - 1, marketDate.day + dayOffset));
      if (!isWeekday(candidate.getUTCDay())) continue;

      const opensAt = getZonedTimestamp(
        candidate.getUTCFullYear(),
        candidate.getUTCMonth() + 1,
        candidate.getUTCDate(),
        definition.opensAt.hour,
        definition.opensAt.minute,
        definition.timeZone
      );
      const closesAt = getZonedTimestamp(
        candidate.getUTCFullYear(),
        candidate.getUTCMonth() + 1,
        candidate.getUTCDate(),
        definition.closesAt.hour,
        definition.closesAt.minute,
        definition.timeZone
      );

      if (closesAt > dayStart && opensAt < dayEnd) {
        const visibleStart = Math.max(opensAt, dayStart);
        const visibleEnd = Math.min(closesAt, dayEnd);
        return [{
          name,
          startPercent: ((visibleStart - dayStart) / dayDuration) * 100,
          widthPercent: ((visibleEnd - visibleStart) / dayDuration) * 100,
          colorClass
        }];
      }
    }

    return [];
  });
};

interface SessionMonitorProps {
  marketStats?: {
    totalConnected: number;
    waiting: number;
    entering: number;
    exiting: number;
    quietPercentage: number;
  };
}

const SessionMonitor: React.FC<SessionMonitorProps> = ({ marketStats }) => {
  const [expanded, setExpanded] = useState(false);
  const [sessions, setSessions] = useState<{
    asia: SessionInfo;
    europe: SessionInfo;
    america: SessionInfo;
    advice: string[];
  }>({
    asia: { name: 'ASIA', status: 'closed' },
    europe: { name: 'EUROPA', status: 'closed' },
    america: { name: 'AMERICA', status: 'closed' },
    advice: []
  });
  const [hasUnreadAdvice, setHasUnreadAdvice] = useState(false);
  const [lastAdviceHash, setLastAdviceHash] = useState('');

  // Calcular próximo NFP (memoizado, solo recalcula al cambiar de mes)
  const nextNFP = useMemo(() => {
    const now = new Date();
    const newYorkNow = getZonedDateParts(now, 'America/New_York');
    const year = newYorkNow.year;
    const month = newYorkNow.month - 1;
    
    // Buscar primer viernes de este mes
    let firstFriday = new Date(Date.UTC(year, month, 1));
    while (firstFriday.getDay() !== 5) {
      firstFriday.setUTCDate(firstFriday.getUTCDate() + 1);
    }
    
    let timestamp = getZonedTimestamp(
      firstFriday.getUTCFullYear(),
      firstFriday.getUTCMonth() + 1,
      firstFriday.getUTCDate(),
      8,
      30,
      'America/New_York'
    );
    
    // Si ya pasó, calcular el del próximo mes
    if (timestamp < Date.now()) {
      const nextMonth = month + 1;
      firstFriday = new Date(Date.UTC(year + Math.floor(nextMonth / 12), nextMonth % 12, 1));
      while (firstFriday.getDay() !== 5) {
        firstFriday.setUTCDate(firstFriday.getUTCDate() + 1);
      }
      timestamp = getZonedTimestamp(
        firstFriday.getUTCFullYear(),
        firstFriday.getUTCMonth() + 1,
        firstFriday.getUTCDate(),
        8,
        30,
        'America/New_York'
      );
    }
    
    return timestamp;
  }, [new Date().getUTCMonth()]); // Solo recalcula al cambiar de mes

  // Parsear eventos manuales del JSON (memoizado)
  const upcomingEvents = useMemo((): FundamentalEvent[] => {
    const now = Date.now();
    const events: FundamentalEvent[] = [];
    
    // Agregar NFP automático
    events.push({
      name: 'NFP',
      description: 'Non-Farm Payrolls (US Employment Report)',
      timestamp: nextNFP,
      impact: 'extreme'
    });
    
    // Agregar eventos manuales del JSON
    fundamentalsData.events.forEach(event => {
      if (event.type === 'manual' && event.dates) {
        event.dates.forEach(dateStr => {
          // Parsear "2026-04-10 08:30 ET"
          const [datePart, timePart, tz] = dateStr.split(' ');
          const [year, month, day] = datePart.split('-').map(Number);
          const [hour, minute] = timePart.split(':').map(Number);
          
          const timeZone = EVENT_TIME_ZONES[tz];
          if (!timeZone) {
            console.error(`Zona horaria no compatible para ${event.name}: ${tz}`);
            return;
          }
          const timestamp = getZonedTimestamp(year, month, day, hour, minute, timeZone);
          
          // Solo eventos futuros dentro de los próximos 30 días
          if (timestamp > now && timestamp < now + 30 * 24 * 60 * 60 * 1000) {
            events.push({
              name: event.name,
              description: event.description,
              timestamp,
              impact: event.impact as 'high' | 'extreme'
            });
          }
        });
      }
    });
    
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }, [nextNFP]); // Solo recalcula cuando cambia el NFP

  const getSessionStatus = useCallback(() => {
    const now = new Date();
    const utcDay = now.getUTCDay();
    const asiaSession = getSessionInfo(ASIA_SESSION, now);
    const europeSession = getSessionInfo(EUROPE_SESSION, now);
    const americaSession = getSessionInfo(AMERICA_SESSION, now);
    const asiaOpen = asiaSession.isOpen;
    const europeOpen = europeSession.isOpen;
    const americaOpen = americaSession.isOpen;

    const advice: string[] = [];

    const asiaTimeLeft = asiaOpen ? asiaSession.minutesUntilChange : 0;
    const asiaOpensIn = !asiaOpen ? asiaSession.minutesUntilChange : 0;
    const europeTimeLeft = europeOpen ? europeSession.minutesUntilChange : 0;
    const europeOpensIn = !europeOpen ? europeSession.minutesUntilChange : 0;
    const americaTimeLeft = americaOpen ? americaSession.minutesUntilChange : 0;
    const americaOpensIn = !americaOpen ? americaSession.minutesUntilChange : 0;

    // Formato tiempo
    const formatTime = (minutes: number) => {
      if (minutes <= 0) return '';
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    // CONSEJOS INTELIGENTES (tono humano y educativo)
    const overlap = europeOpen && americaOpen; // Solapamiento EU+NY
    
    if (overlap) {
      advice.push("🔥 Momento óptimo para FOREX: Europa y Nueva York operan juntas (máxima liquidez y volatilidad)");
      advice.push("Las señales de EUR/USD, GBP/USD y USD/CHF son más confiables ahora");
    } else if (europeOpen && !americaOpen) {
      advice.push("✅ Buena liquidez en pares EUR y GBP mientras Europa está activa");
      advice.push("FOREX: Liquidez moderada, espera apertura de NY para mayor movimiento");
    } else if (americaOpen && !europeOpen) {
      advice.push("✅ Wall Street operativo - Señales de acciones USA son válidas");
      advice.push("FOREX: Buena liquidez con pares del dólar (USD/JPY, USD/CAD, etc)");
    } else if (asiaOpen && !europeOpen && !americaOpen) {
      advice.push("🌏 Solo sesión asiática activa - Liquidez limitada en FOREX");
      advice.push("⚠️ Evita operar FOREX ahora si eres principiante (spreads más altos, movimientos erráticos)");
    }

    if (americaOpen && americaTimeLeft < 30) {
      advice.push("⏰ Wall Street cierra en " + formatTime(americaTimeLeft) + " - NO abras nuevas posiciones");
      advice.push("Última media hora suele tener movimientos bruscos por cierres institucionales");
    }

    if (europeOpen && europeTimeLeft < 30) {
      advice.push("⏰ Mercados europeos cierran en " + formatTime(europeTimeLeft) + " - Precaución con la liquidez en pares EUR/GBP");
    }

    if (!asiaOpen && !europeOpen && !americaOpen && (utcDay >= 1 && utcDay <= 5)) {
      advice.push("😴 Mercados principales cerrados - Es momento de descanso");
      advice.push("Solo CRYPTO opera 24/7, pero ten precaución: menor liquidez en estas horas");
      advice.push("Revisa señales acumuladas y prepara estrategia para mañana");
    }

    if (utcDay === 0) {
      // Domingo
      advice.push("📅 Domingo - Los principales mercados abren progresivamente según su zona horaria y CRYPTO opera 24/7");
      advice.push("Los mercados de acciones abren el lunes. Usa este tiempo para planificar");
    } else if (utcDay === 6) {
      // Sábado
      advice.push("📅 Fin de semana - Mercados cerrados excepto CRYPTO");
      advice.push("⚠️ Ignora señales de FOREX y ACCIONES hasta la reapertura de los mercados el domingo por la tarde (hora de Nueva York)");
      advice.push("Es buen momento para revisar tu historial y analizar trades de la semana");
    }

    // Avisos de apertura próxima
    if (!americaOpen && americaOpensIn > 0 && americaOpensIn <= 30 && utcDay >= 1 && utcDay <= 5) {
      advice.push("⏰ Wall Street abre en " + formatTime(americaOpensIn) + " - Prepárate para volatilidad inicial");
      advice.push("Los primeros 15-30 minutos suelen ser caóticos, espera a que se estabilice");
    }

    if (!europeOpen && europeOpensIn > 0 && europeOpensIn <= 30 && utcDay >= 1 && utcDay <= 5) {
      advice.push("⏰ Europa abre en " + formatTime(europeOpensIn) + " - Ten paciencia en la apertura");
    }

    // 📅 ALERTAS DE FUNDAMENTALES
    const nowTimestamp = now.getTime();
    
    upcomingEvents.forEach(event => {
      const timeUntil = event.timestamp - nowTimestamp;
      const hoursUntil = timeUntil / (1000 * 60 * 60);
      const daysUntil = timeUntil / (1000 * 60 * 60 * 24);
      
      // DURANTE el evento (30min antes a 2h después)
      if (timeUntil > -2 * 60 * 60 * 1000 && timeUntil < 30 * 60 * 1000) {
        advice.unshift(`🔴 ${event.name} ACTIVO AHORA - NO OPERAR. Volatilidad extrema en curso.`);
        advice.unshift(`Espera al menos 2 horas después de ${event.description} para retomar trading`);
      }
      // 4h antes
      else if (hoursUntil > 0 && hoursUntil <= 4) {
        const h = Math.floor(hoursUntil);
        const m = Math.round((hoursUntil - h) * 60);
        advice.unshift(`🟠 ${event.name} en ${h}h ${m}m - NO abras nuevos trades. Cierra posiciones abiertas.`);
        advice.unshift(`${event.description} causa movimientos impredecibles de 50-150 pips`);
      }
      // 24h antes
      else if (hoursUntil > 4 && hoursUntil <= 24) {
        const h = Math.floor(hoursUntil);
        advice.unshift(`🟡 ${event.name} en ${h}h - Reduce exposición. Evita trades de largo plazo.`);
        advice.unshift(`Mercado puede estar lateral hasta ${event.description}`);
      }
      // 2-7 días antes (aviso informativo)
      else if (daysUntil > 1 && daysUntil <= 7) {
        const d = Math.floor(daysUntil);
        const eventDate = new Date(event.timestamp);
        const dateStr = eventDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        advice.push(`📅 Próximo ${event.name}: ${dateStr} (en ${d} días)`);
      }
    });
    
    // Mensaje educativo sobre pasividad si no hay señales activas
    if (advice.length === 0 || (!overlap && !americaOpen && !europeOpen)) {
      advice.push("💡 Si no escuchas alertas, es porque no hay oportunidades claras en este momento");
      advice.push("Esperar es parte del trabajo. Los traders profesionales solo operan 20% del tiempo.");
      advice.push("Forzar trades cuando el mercado está lateral es la forma más rápida de perder dinero");
    }

    return {
      asia: {
        name: 'ASIA',
        status: (asiaOpen ? 'open' : 'closed') as 'open' | 'closed',
        timeLeft: asiaOpen ? formatTime(asiaTimeLeft) : undefined,
        elapsed: asiaOpen ? formatTime(asiaSession.minutesSinceOpen) : undefined,
        opensIn: !asiaOpen && asiaOpensIn > 0 ? formatTime(asiaOpensIn) : undefined,
        openedAt: asiaSession.openedAt,
        nextChangeAt: asiaSession.nextChangeAt
      },
      europe: {
        name: 'EU',
        status: (europeOpen ? 'open' : 'closed') as 'open' | 'closed',
        timeLeft: europeOpen ? formatTime(europeTimeLeft) : undefined,
        elapsed: europeOpen ? formatTime(europeSession.minutesSinceOpen) : undefined,
        opensIn: !europeOpen && europeOpensIn > 0 ? formatTime(europeOpensIn) : undefined,
        openedAt: europeSession.openedAt,
        nextChangeAt: europeSession.nextChangeAt
      },
      america: {
        name: 'NY',
        status: (americaOpen ? 'open' : 'closed') as 'open' | 'closed',
        timeLeft: americaOpen ? formatTime(americaTimeLeft) : undefined,
        elapsed: americaOpen ? formatTime(americaSession.minutesSinceOpen) : undefined,
        opensIn: !americaOpen && americaOpensIn > 0 ? formatTime(americaOpensIn) : undefined,
        openedAt: americaSession.openedAt,
        nextChangeAt: americaSession.nextChangeAt
      },
      advice
    };
  }, [upcomingEvents]); // Dependencia: solo recalcula cuando cambian los eventos

  useEffect(() => {
    const update = () => {
      const newStatus = getSessionStatus();
      setSessions(newStatus);
      
      // Detectar si los mensajes cambiaron
      const newHash = newStatus.advice.join('|');
      if (newHash !== lastAdviceHash && newHash !== '') {
        setHasUnreadAdvice(true);
        setLastAdviceHash(newHash);
      }
    };
    
    update();
    const interval = setInterval(update, 60000); // Actualizar cada minuto
    return () => clearInterval(interval);
  }, [lastAdviceHash, getSessionStatus]);

  const handleToggleExpand = useCallback(() => {
    setExpanded(prev => !prev);
    // Marcar como leído cuando expande
    if (!expanded && sessions.advice.length > 0) {
      setHasUnreadAdvice(false);
    }
  }, [expanded, sessions.advice.length]);

  const SessionBadge = ({ session }: { session: SessionInfo }) => {
    const transitionTime = session.nextChangeAt
      ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(session.nextChangeAt)
      : null;
    const isOpen = session.status === 'open';

    return (
      <div className={`min-w-[200px] rounded-lg border px-3 py-2.5 font-mono ${
        isOpen
          ? 'border-emerald-400/45 bg-emerald-500/[0.10] shadow-[0_0_24px_rgba(16,185,129,0.08)]'
          : 'border-slate-600/50 bg-slate-800/45'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <span className={`flex items-center gap-1.5 text-xs font-black tracking-wide ${isOpen ? 'text-emerald-200' : 'text-slate-300'}`}>
            <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-400'}`} />
            {session.name}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
            isOpen ? 'bg-emerald-400/20 text-emerald-300' : 'bg-slate-600/50 text-slate-300'
          }`}>
            {isOpen ? 'Activa' : 'Cerrado'}
          </span>
        </div>
        <div className={`mt-1.5 space-y-0.5 text-[10px] font-bold ${isOpen ? 'text-emerald-300' : 'text-slate-400'}`}>
          {isOpen ? (
            <>
              <p>Lleva {session.elapsed || '--'}</p>
              <p>Cierra {transitionTime || '--'} · Quedan {session.timeLeft || '--'}</p>
            </>
          ) : (
            <>
              <p>Abre {transitionTime || '--'}</p>
              <p>Faltan {session.opensIn || '--'}</p>
            </>
          )}
        </div>
      </div>
  );
  };

  const localTime = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userLocation = userTimeZone
    .split('/')
    .pop()
    ?.replace(/_/g, ' ')
    .toUpperCase() || 'HORA LOCAL';
  const userOffsetMinutes = getTimeZoneOffsetMinutes(new Date(), userTimeZone);
  const userOffsetHours = Math.floor(Math.abs(userOffsetMinutes) / 60).toString().padStart(2, '0');
  const userOffsetRemainder = (Math.abs(userOffsetMinutes) % 60).toString().padStart(2, '0');
  const userGmtOffset = `GMT${userOffsetMinutes >= 0 ? '+' : '-'}${userOffsetHours}:${userOffsetRemainder}`;
  const timelineSegments = getTimelineSegments(new Date(), userTimeZone);
  const localNow = new Date();
  const userDay = getZonedDateParts(localNow, userTimeZone);
  const localDayStart = getZonedTimestamp(userDay.year, userDay.month, userDay.day, 0, 0, userTimeZone);
  const localNextDay = new Date(Date.UTC(userDay.year, userDay.month - 1, userDay.day + 1));
  const localDayEnd = getZonedTimestamp(
    localNextDay.getUTCFullYear(),
    localNextDay.getUTCMonth() + 1,
    localNextDay.getUTCDate(),
    0,
    0,
    userTimeZone
  );
  const currentTimePercent = ((localNow.getTime() - localDayStart) / (localDayEnd - localDayStart)) * 100;
  const activeTimelineSession = [sessions.asia, sessions.europe, sessions.america].find(session => session.status === 'open');
  return (
    <div className="max-w-[1500px] mx-auto px-4 md:px-8 mb-4 md:mb-6">
      <div className="overflow-hidden rounded-xl border border-[#274254] bg-[#101d29] shadow-lg">
        {/* Strip principal siempre visible */}
        <div className="flex flex-col gap-3 px-4 py-4 xl:flex-row xl:items-center xl:justify-between md:px-6">
          <div className="flex min-w-0 items-center gap-4 overflow-x-auto pb-1 xl:pb-0">
            <span className="shrink-0 border-r border-slate-600/60 pr-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Sessions
            </span>
            <SessionBadge session={sessions.asia} />
            <SessionBadge session={sessions.europe} />
            <SessionBadge session={sessions.america} />
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1 xl:pb-0">
            <div className="shrink-0 rounded-lg border border-cyan-400/40 bg-cyan-500/[0.06] px-3 py-2 font-mono" aria-live="polite">
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-cyan-200">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden="true">
                  <circle cx="12" cy="12" r="8" />
                  <path strokeLinecap="round" d="M12 7v5l3 2" />
                </svg>
                Tu hora
              </div>
              <div className="mt-0.5 text-lg font-black leading-none text-cyan-100">{localTime}</div>
              <div className="mt-1 flex items-center gap-2 text-[9px] font-bold text-cyan-200/80">
                <span>{userLocation} ({userGmtOffset})</span>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[8px] text-emerald-300">SYNC</span>
              </div>
            </div>

            {marketStats && (
              <div className={`hidden shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 md:flex ${
                marketStats.quietPercentage >= 70
                  ? 'border-slate-600 bg-slate-800/50 text-slate-300'
                  : 'border-emerald-400/35 bg-emerald-500/[0.08] text-emerald-200'
              }`}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-md border text-lg ${
                  marketStats.quietPercentage >= 70
                    ? 'border-slate-500/50 bg-slate-700/40 text-slate-300'
                    : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                }`}>
                  {marketStats.quietPercentage >= 70 ? '−' : '↗'}
                </span>
                <div className="font-mono">
                  <p className="text-[10px] font-black uppercase tracking-wide">
                    {marketStats.quietPercentage >= 70 ? 'Mercado pasivo' : 'Mercado activo'}
                  </p>
                  <p className="text-[9px] opacity-75">
                    {marketStats.waiting} de {marketStats.totalConnected} esperando señal
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Badge de evento crítico (menos de 4h) */}
            {(() => {
              const criticalEvent = upcomingEvents.find(e => {
                const hoursUntil = (e.timestamp - Date.now()) / (1000 * 60 * 60);
                return hoursUntil > -2 && hoursUntil <= 4;
              });
              
              if (criticalEvent) {
                const hoursUntil = (criticalEvent.timestamp - Date.now()) / (1000 * 60 * 60);
                const isActive = hoursUntil < 0.5 && hoursUntil > -2;
                
                return (
                  <div className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 ${
                    isActive 
                      ? 'bg-rose-500/30 border-rose-500/50' 
                      : 'bg-orange-500/20 border-orange-500/30'
                  } border rounded-lg ${isActive ? 'animate-pulse' : ''}`}>
                    <span className="text-[10px] md:text-xs font-black text-white">
                      {isActive ? '🔴' : '🟠'} {criticalEvent.name}
                    </span>
                  </div>
                );
              }
              return null;
            })()}
            
            {sessions.advice.length > 0 && hasUnreadAdvice && (
              <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-lg animate-pulse">
                <span className="text-[10px] md:text-xs font-bold text-amber-300">
                  {sessions.advice.length} {sessions.advice.length === 1 ? 'aviso' : 'avisos'}
                </span>
              </div>
            )}
            <button
              onClick={handleToggleExpand}
              className="p-1 md:p-1.5 text-white/60 hover:text-white transition-colors"
              title={expanded ? "Colapsar" : "Ver detalles"}
            >
              <svg 
                className={`w-3.5 md:w-4 h-3.5 md:h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                strokeWidth="3"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="border-t border-[#274254] px-4 pb-4 pt-2 md:px-6">
          <div className="relative h-3 overflow-hidden rounded border border-slate-700/70 bg-[#0b1520]">
            {timelineSegments.map(segment => (
              <div
                key={segment.name}
                className={`absolute top-0 h-full border-x border-white/5 ${segment.colorClass}`}
                style={{ left: `${segment.startPercent}%`, width: `${segment.widthPercent}%` }}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black uppercase tracking-wide opacity-70">
                  {segment.name}
                </span>
              </div>
            ))}
            <div
              className="absolute top-0 z-10 h-full w-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]"
              style={{ left: `${Math.min(100, Math.max(0, currentTimePercent))}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="relative mt-1 h-4 font-mono text-[9px] font-bold text-slate-500">
            <span className="absolute left-0">00:00</span>
            <span className="absolute left-[16.67%] -translate-x-1/2">04:00</span>
            <span className="absolute left-1/3 -translate-x-1/2">08:00</span>
            <span className="absolute left-1/2 -translate-x-1/2">12:00</span>
            <span className="absolute left-[66.67%] -translate-x-1/2">16:00</span>
            <span className="absolute left-[83.33%] -translate-x-1/2">20:00</span>
            <span className="absolute right-0">23:59</span>
            {activeTimelineSession && (
              <span
                className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[9px] font-black text-emerald-300"
                style={{ left: `${Math.min(96, Math.max(4, currentTimePercent))}%` }}
              >
                ▲ {localTime} ({activeTimelineSession.name} EN CURSO)
              </span>
            )}
          </div>
        </div>

        {/* Panel expandido con consejos */}
        {expanded && sessions.advice.length > 0 && (
          <div className="border-t border-white/20 bg-black/20">
            {/* Header con botón cerrar */}
            <div className="px-3 md:px-6 py-2 flex items-center justify-between border-b border-white/5">
              <span className="text-[8px] md:text-[9px] font-black text-white/40 uppercase tracking-widest">
                MARKET ADVICE
              </span>
              <button
                onClick={() => setExpanded(false)}
                className="p-1 text-white/40 hover:text-white/80 transition-colors"
                title="Cerrar panel"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Consejos */}
            <div className="px-3 md:px-6 py-3 md:py-4 flex flex-col gap-2 md:gap-2.5 max-h-[300px] md:max-h-none overflow-y-auto">
              {sessions.advice.map((msg, idx) => (
                <div key={idx} className="flex items-start gap-2 md:gap-2.5 text-[11px] md:text-xs font-mono text-neutral-300">
                  <span className="text-cyan-400 mt-0.5 text-xs md:text-sm flex-shrink-0">•</span>
                  <span>{msg}</span>
                </div>
              ))}
            </div>

            {/* Eventos fundamentales próximos - Hidden on small mobile */}
            <div className="hidden sm:block border-t border-white/10 px-3 md:px-6 py-2 md:py-3 bg-black/10">
              <div className="text-[8px] md:text-[9px] font-black text-white/40 uppercase tracking-widest mb-2">
                📅 UPCOMING FUNDAMENTALS
              </div>
              <div className="flex flex-col gap-1.5">
                {upcomingEvents.slice(0, 3).map((event, idx) => {
                  const eventDate = new Date(event.timestamp);
                  const timeUntil = event.timestamp - Date.now();
                  const daysUntil = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
                  const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60));
                  
                  const dateStr = eventDate.toLocaleDateString('es-ES', { 
                    day: '2-digit', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  });
                  
                  const timeLabel = daysUntil > 0 
                    ? `en ${daysUntil}d ${hoursUntil % 24}h`
                    : `en ${hoursUntil}h`;
                  
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[10px] md:text-[11px] px-2 py-1.5 bg-white/[0.03] rounded border border-white/5 gap-1 sm:gap-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-black ${event.impact === 'extreme' ? 'text-rose-400' : 'text-orange-400'}`}>
                          {event.name}
                        </span>
                        <span className="text-neutral-500 text-[10px]">
                          {event.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-neutral-400 font-mono text-[10px]">
                          {dateStr}
                        </span>
                        <span className={`font-bold ${
                          hoursUntil <= 4 ? 'text-rose-400' : 
                          hoursUntil <= 24 ? 'text-orange-400' : 
                          'text-cyan-400'
                        }`}>
                          {timeLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionMonitor;
