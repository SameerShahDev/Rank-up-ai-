"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowUp, ArrowDown,
  TrendingUp, TrendingDown,
  Minus, Plus,
} from "lucide-react";
import type { AccountMode } from '../types/account';
import AccountToggle from './AccountToggle';
import ChartCanvas from './trade/ChartCanvas';
import type { Candle } from '../utils/marketData';
import { getLiveCandles, getLivePrice, tickPrices } from '../utils/marketData';

interface Asset {
  id: string;
  name: string;
  icon: string;
  yield: number;
  basePrice: number;
  color: string;
}

const ASSETS: Asset[] = [
  { id: 'BTC', name: 'BTC/INR', icon: '₿', yield: 83, basePrice: 6696700, color: '#f7931a' },
  { id: 'ETH', name: 'ETH/INR', icon: 'Ξ', yield: 80, basePrice: 189545, color: '#627eea' },
  { id: 'SOL', name: 'SOL/INR', icon: 'S', yield: 85, basePrice: 7598, color: '#9945FF' },
];

interface ActiveTrade {
  id: string;
  type: 'UP' | 'DOWN';
  entryPrice: number;
  amount: number;
  duration: number;
  timeLeft: number;
}

const SYMBOL_MAP: Record<string, string> = {
  BTC: 'BTC/INR',
  ETH: 'ETH/INR',
  SOL: 'SOL/INR',
};

const TIMEFRAMES = [
  { id: '1m', label: '1m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
  { id: '1d', label: '1D' },
];

/* ─── Colors ────────────────────────────────────────────────────────────── */
const C = {
  bg: '#1e2029',
  up: '#10B981',
  down: '#F43F5E',
  accent: '#3b82f6',
  muted: '#64748b',
  card: '#151d2e',
  border: '#1e293b',
  surface: '#161b22',
};

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ─── Market Sentiment Bar ─────────────────────────────────────────────── */
const SentimentBar = ({ upPct }: { upPct: number }) => {
  const downPct = 100 - upPct;
  return (
    <div className="px-1 py-0.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Long / Short</span>
        <span className="text-[9px] font-bold tabular-nums text-slate-400">{upPct}% / {downPct}%</span>
      </div>
      <div className="flex h-1 rounded-full overflow-hidden bg-white/[0.04]">
        <div className="transition-all duration-500" style={{ width: `${upPct}%`, background: C.up }} />
        <div className="transition-all duration-500" style={{ width: `${downPct}%`, background: C.down }} />
      </div>
    </div>
  );
};

/* ─── Main Component ───────────────────────────────────────────────────── */
const TradingDashboard: React.FC<{
  accountMode: AccountMode;
  setAccountMode: (mode: AccountMode) => void;
  balance: number;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  addTransaction: (tx: Record<string, string>) => void;
}> = ({
  accountMode, setAccountMode, balance, setBalance,
  addTransaction,
}) => {
  const isDemo = accountMode === 'demo';

  const [asset, setAsset] = useState(ASSETS[0]);
  const [amount, setAmount] = useState(100);
  const [duration, setDuration] = useState(3);
  const [tf, setTf] = useState('1m');
  const [sentiment, setSentiment] = useState(55);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [price, setPrice] = useState(asset.basePrice);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [result, setResult] = useState<{ win: boolean; amt: number } | null>(null);
  const priceRef = useRef(price);
  const tradeCountRef = useRef(0);
  const hasHookedRef = useRef(false);

  useEffect(() => { priceRef.current = price; }, [price]);
  useEffect(() => { setPrice(getLivePrice(SYMBOL_MAP[asset.id] ?? 'BTC/INR')); }, [asset]);

  useEffect(() => {
    const iv = setInterval(() => {
      tickPrices();
      const sym = SYMBOL_MAP[asset.id] ?? 'BTC/INR';
      setPrice(getLivePrice(sym));
      setCandles(getLiveCandles(sym, 60));
    }, 200);
    return () => clearInterval(iv);
  }, [asset]);

  useEffect(() => {
    const sym = SYMBOL_MAP[asset.id] ?? 'BTC/INR';
    setCandles(getLiveCandles(sym, 60));
    setPrice(getLivePrice(sym));
  }, [asset]);

  // Sentiment updates slowly
  useEffect(() => {
    const iv = setInterval(() => {
      setSentiment(35 + Math.floor(Math.random() * 30));
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setActiveTrades(prev => prev.map(t => ({ ...t, timeLeft: Math.max(0, t.timeLeft - 1) })));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const settled = activeTrades.filter(t => t.timeLeft === 0);
    if (!settled.length) return;
    settled.forEach(trade => {
      const p = priceRef.current;
      let isWin = trade.type === 'UP' ? p > trade.entryPrice : p < trade.entryPrice;
      tradeCountRef.current++;
      if (tradeCountRef.current <= 3) {
        isWin = true;
        hasHookedRef.current = true;
      } else if (hasHookedRef.current) {
        isWin = Math.random() < 0.3;
      }
      const payout = Math.floor(trade.amount * (1 + asset.yield / 100));
      if (isWin) {
        setBalance(prev => prev + payout);
        window.navigator.vibrate?.([50, 150, 50]);
      } else {
        window.navigator.vibrate?.(100);
      }
      addTransaction({
        id: `TX-${Math.random().toString(36).toUpperCase().slice(2, 8)}`,
        type: trade.type === 'UP' ? 'buy' : 'sell',
        coin: asset.id,
        amount: isWin ? `+${payout}` : `-${trade.amount}`,
        usd: isWin ? `+₹${(payout - trade.amount).toLocaleString('en-IN')}` : `-₹${trade.amount.toLocaleString('en-IN')}`,
        price: `₹${trade.entryPrice.toFixed(2)}`,
        fee: '₹0',
        account: accountMode,
      });
      setResult({ win: isWin, amt: isWin ? payout - trade.amount : -trade.amount });
      setTimeout(() => setResult(null), 3500);
    });
    setActiveTrades(prev => prev.filter(t => t.timeLeft > 0));
  }, [activeTrades, asset, setBalance, addTransaction, accountMode]);

  const handleTrade = (type: 'UP' | 'DOWN') => {
    if (balance < amount || amount < 1) return;
    window.navigator.vibrate?.([15, 30, 15]);
    setBalance(prev => prev - amount);
    setActiveTrades(prev => [...prev, {
      id: Math.random().toString(36).slice(2, 11),
      type,
      entryPrice: price,
      amount,
      duration,
      timeLeft: duration,
    }]);
  };

  const primaryTrade = activeTrades.length > 0 ? activeTrades[activeTrades.length - 1] : null;

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const dayOpen = candles.length > 0 ? candles[0].open : price;
  const priceChange = price - dayOpen;
  const priceChangePct = (priceChange / dayOpen) * 100;
  const isPriceUp = priceChange >= 0;

  // 24h high/low approximation
  const high24 = candles.length > 0 ? Math.max(...candles.map(c => c.high)) : price;
  const low24 = candles.length > 0 ? Math.min(...candles.map(c => c.low)) : price;

  return (
    <div className="flex flex-col h-full w-full text-white overflow-hidden" style={{ background: '#0a0e17' }}>

      {/* ── Clean Top Section (Refactored) ───────────────────────── */}
      <div className="shrink-0 space-y-0" style={{ borderBottom: '1px solid rgba(56,70,90,0.25)' }}>
        
        {/* Row 1: Balance & Account Controls */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <AccountToggle mode={accountMode} onChange={setAccountMode} compact />
            <span className={`text-[11px] font-black tabular-nums px-2.5 py-1 rounded-md ${isDemo ? 'text-amber-400' : 'text-white'}`} style={{ background: 'rgba(10,14,23,0.85)', border: '1px solid rgba(56,70,90,0.3)' }}>
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Row 2: Asset Info + Live Price */}
        <div className="flex items-center justify-between px-3 py-1.5" style={{ borderTop: '1px solid rgba(56,70,90,0.15)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-black" style={{ background: `${asset.color}20`, color: asset.color }}>
              {asset.icon}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-black text-white">{asset.id}/INR</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>10x</span>
                <span className="text-[9px] font-medium text-slate-500">{asset.yield}% ROI</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end leading-tight">
            <span className="text-lg font-black tabular-nums" style={{ color: isPriceUp ? C.up : C.down }}>
              {price >= 1000 ? price.toFixed(0) : price.toFixed(2)}
            </span>
            <span className="text-[10px] font-bold tabular-nums" style={{ color: isPriceUp ? C.up : C.down }}>
              {isPriceUp ? '+' : ''}{priceChangePct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Row 3: Timeframe + Asset Selector + 24h H/L */}
        <div className="flex flex-col gap-0.5 px-2 py-1.5" style={{ borderTop: '1px solid rgba(56,70,90,0.15)' }}>
          
          {/* Timeframes */}
          <div className="flex items-center gap-0.5">
            {TIMEFRAMES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTf(t.id)}
                className="flex-1 px-2 py-1.5 text-[10px] font-bold rounded-md transition-all"
                style={tf === t.id
                  ? { background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }
                  : { color: '#64748b', border: '1px solid rgba(56,70,90,0.2)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Assets + H/L */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 overflow-x-auto">
              {ASSETS.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAsset(a)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-all"
                  style={asset.id === a.id
                    ? { background: 'rgba(56,70,90,0.45)', color: '#fff', border: '1px solid rgba(56,70,90,0.6)' }
                    : { background: 'rgba(56,70,90,0.18)', color: '#94a3b8' }
                  }
                >
                  <span style={{ color: a.color }}>{a.icon}</span>
                  <span>{a.id}</span>
                </button>
              ))}
            </div>
            
            <div className="shrink-0 flex items-center gap-3 text-[9px] font-mono text-slate-500">
              <span>H <span className="text-slate-300 font-semibold">{high24 >= 1000 ? high24.toFixed(0) : high24.toFixed(2)}</span></span>
              <span>L <span className="text-slate-300 font-semibold">{low24 >= 1000 ? low24.toFixed(0) : low24.toFixed(2)}</span></span>
            </div>
          </div>

        </div>

      </div>

      {/* ── Chart ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative" style={{ background: '#0a0e17' }}>
        <ChartCanvas
          candles={candles}
          livePrice={price}
          trades={activeTrades}
          activeTrade={primaryTrade}
        />
      </div>

      {/* ── OHLC strip ──────────────────────────────────────────── */}
      {lastCandle && (
        <div className="shrink-0 grid grid-cols-4 gap-1 px-3 py-1.5" style={{ background: 'rgba(20,28,45,0.6)', borderTop: '1px solid rgba(56,70,90,0.3)', borderBottom: '1px solid rgba(56,70,90,0.2)' }}>
          <OHLCCell label="Open" value={lastCandle.open} color="#cbd5e1" />
          <OHLCCell label="High" value={lastCandle.high} color={C.up} />
          <OHLCCell label="Low" value={lastCandle.low} color={C.down} />
          <OHLCCell label="Vol" value={lastCandle.volume || 0} color="#cbd5e1" isVol />
        </div>
      )}

      {/* ── Bottom controls ─────────────────────────────────────── */}
      <div className="shrink-0 px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]" style={{ background: '#0a0e17' }}>

        {/* Active trades */}
        {activeTrades.length > 0 && (
          <div className="mb-1.5 space-y-1 max-h-14 overflow-y-auto">
            {activeTrades.map(t => {
              const isUp = t.type === 'UP';
              const pnl = isUp
                ? ((price - t.entryPrice) / t.entryPrice) * t.amount
                : ((t.entryPrice - price) / t.entryPrice) * t.amount;
              const isProfit = pnl >= 0;
              return (
                <div key={t.id} className="flex items-center gap-2 px-2 py-1 rounded-md text-[11px]" style={{
                  background: isProfit ? 'rgba(38,166,154,0.08)' : 'rgba(239,83,84,0.08)',
                  border: `1px solid ${isProfit ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,84,0.2)'}`,
                }}>
                  <span className="font-black" style={{ color: isProfit ? C.up : C.down }}>{isProfit ? '▲' : '▼'}</span>
                  <span className="font-bold text-white">₹{t.amount} · {t.type}</span>
                  <span className="text-slate-500 font-mono text-[10px]">{formatTime(t.timeLeft)}</span>
                  <span className="ml-auto font-black tabular-nums" style={{ color: isProfit ? C.up : C.down }}>
                    {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Duration Presets */}
        <div className="flex gap-1 mb-1.5">
          {[3, 5, 10, 30, 60].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className="flex-1 h-7 rounded-md text-[10px] font-bold transition-all"
              style={duration === d
                ? { background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.5)' }
                : { background: C.surface, color: '#64748b', border: '1px solid rgba(56,70,90,0.4)' }
              }
            >
              {d}s
            </button>
          ))}
        </div>

        {/* Amount */}
        <div className="flex gap-1.5 mb-1.5">
          <div className="flex-1 flex items-center h-8 rounded-md overflow-hidden" style={{ background: C.surface, border: '1px solid rgba(56,70,90,0.4)' }}>
            <button type="button" onClick={() => setAmount(a => Math.max(100, a - 100))}
              className="w-7 h-full flex items-center justify-center active:bg-white/5">
              <Minus className="w-3 h-3 text-slate-500" />
            </button>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[12px] font-black text-white tabular-nums">₹{amount}</span>
            </div>
            <button type="button" onClick={() => setAmount(a => a + 100)}
              className="w-7 h-full flex items-center justify-center active:bg-white/5">
              <Plus className="w-3 h-3 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Sentiment */}
        <SentimentBar upPct={sentiment} />

        {/* Trade buttons */}
        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <button
            type="button"
            onClick={() => handleTrade('UP')}
            disabled={balance < amount}
            className="h-10 rounded-lg flex items-center justify-center gap-1 font-black text-[13px] active:scale-[0.97] transition-all disabled:opacity-30"
            style={{ background: C.up, color: '#fff' }}
          >
            <ArrowUp className="w-4 h-4" strokeWidth={3} />
            UP
          </button>
          <button
            type="button"
            onClick={() => handleTrade('DOWN')}
            disabled={balance < amount}
            className="h-10 rounded-lg flex items-center justify-center gap-1 font-black text-[13px] active:scale-[0.97] transition-all disabled:opacity-30"
            style={{ background: C.down, color: '#fff' }}
          >
            <ArrowDown className="w-4 h-4" strokeWidth={3} />
            DOWN
          </button>
        </div>
      </div>



      {/* ── Result Popup ─────────────────────────────────────────── */}
      {result && (
        <div className="absolute inset-x-0 top-20 z-[100] flex justify-center pointer-events-none animate-[slideUp_0.3s_ease-out]">
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl" style={{
            background: result.win ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,84,0.15)',
            border: `1px solid ${result.win ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,84,0.5)'}`,
            boxShadow: result.win ? '0 0 40px rgba(38,166,154,0.3)' : '0 0 40px rgba(239,83,84,0.3)',
            backdropFilter: 'blur(8px)',
          }}>
            {result.win
              ? <TrendingUp className="w-7 h-7" strokeWidth={2.5} style={{ color: C.up }} />
              : <TrendingDown className="w-7 h-7" strokeWidth={2.5} style={{ color: C.down }} />}
            <div>
              <p className="text-[9px] font-black tracking-widest uppercase" style={{ color: result.win ? C.up : C.down }}>
                {result.win ? 'PROFIT' : 'LOSS'}
              </p>
              <p className="text-2xl font-black tabular-nums" style={{ color: result.win ? C.up : C.down }}>
                {result.amt >= 0 ? '+' : ''}₹{Math.abs(result.amt).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      )}



      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

/* ─── OHLC Cell ───────────────────────────────────────────────────────── */
const OHLCCell = ({ label, value, color, isVol = false }: { label: string; value: number; color: string; isVol?: boolean }) => {
  const display = isVol
    ? value >= 1e9 ? (value / 1e9).toFixed(2) + 'B'
    : value >= 1e6 ? (value / 1e6).toFixed(2) + 'M'
    : value >= 1e3 ? (value / 1e3).toFixed(2) + 'K'
    : value.toFixed(0)
    : value >= 1000 ? value.toFixed(0) : value.toFixed(2);
  return (
    <div className="flex flex-col items-center">
      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-[10px] font-black tabular-nums" style={{ color }}>{display}</span>
    </div>
  );
};

export default TradingDashboard;
