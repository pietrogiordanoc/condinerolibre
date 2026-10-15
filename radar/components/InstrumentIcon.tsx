import React, { useState } from 'react';
import { Bitcoin, CandlestickChart, Coins, Landmark } from 'lucide-react';
import { Instrument } from '../types';

const ICON_FILES: Record<string, string> = {
  'BTC/USD': 'BTCUSD.png',
  'DOGE/USD': 'DOGEUSD.png',
  'NZD/USD': 'NZDUSD.png',
  'USD/CAD': 'USDCAD.png',
  'USD/JPY': 'USDJPY_bg.svg',
  'USD/MXN': 'USDMXN.png',
  'XAG/USD': 'XAGUSD.png',
  'XAU/USD': 'XAUUSD.png',
  AAPL: 'apple.svg',
  TSLA: 'tesla.svg',
};

const FALLBACK_ICONS: Record<Instrument['type'], React.ComponentType<{ className?: string }>> = {
  crypto: Bitcoin,
  commodities: Coins,
  forex: Landmark,
  stocks: CandlestickChart,
};

interface InstrumentIconProps {
  instrument: Instrument;
  className?: string;
}

const InstrumentIcon: React.FC<InstrumentIconProps> = ({ instrument, className = '' }) => {
  const [hasLoadError, setHasLoadError] = useState(false);
  const iconFile = ICON_FILES[instrument.symbol];
  const FallbackIcon = FALLBACK_ICONS[instrument.type];

  if (iconFile && !hasLoadError) {
    return (
      <img
        src={`../images/tic_icons/${iconFile}`}
        alt=""
        aria-hidden="true"
        className={`h-5 w-5 shrink-0 rounded-full object-cover ${className}`}
        onError={() => setHasLoadError(true)}
      />
    );
  }

  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-cyan-300 ${className}`}
      title={`Icono de ${instrument.name}`}
      aria-hidden="true"
    >
      <FallbackIcon className="h-3 w-3" />
    </span>
  );
};

export default InstrumentIcon;
