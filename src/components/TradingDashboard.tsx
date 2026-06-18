"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowUp, ArrowDown,
  Minus, Plus,
} from "lucide-react";
import type { AccountMode } from '../types/account';
import AccountToggle from './AccountToggle';
import type { Candle } from '../utils/marketData';
import { getLiveCandles, getLivePrice, tickPrices } from '../utils/marketData';
import TradeChart from './trade/TradeChart';

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
  placedInMode: 'demo' | 'real';
}

const SYMBOL_MAP: Record<string, string> = {
  BTC: 'BTC/INR',
  ETH: 'ETH/INR',
  SOL: 'SOL/INR',
};


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
  realBalance: number;
  addTransaction: (tx: Record<string, string>) => void;
}> = ({
  accountMode, setAccountMode, balance, setBalance, realBalance,
  setDemoBalance, setRealBalance,
  addTransaction,
}) => {
  const isDemo = accountMode === 'demo';

  const [asset, setAsset] = useState(ASSETS[0]);
  const [amount, setAmount] = useState(100);
  const [duration, setDuration] = useState(3);
  const [sentiment, setSentiment] = useState(55);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [price, setPrice] = useState(asset.basePrice);
  const [candles, setCandles] = useState<Candle[]>([]);
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
    }, 100);
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
      const payout = trade.amount * 2;
      const settleBalance = trade.placedInMode === 'demo' ? setDemoBalance : setRealBalance;
      if (isWin) {
        settleBalance(prev => prev + payout);
        window.navigator.vibrate?.([50, 150, 50]);
      } else {
        window.navigator.vibrate?.(100);
      }
      addTransaction({
        id: `TX-${Math.random().toString(36).toUpperCase().slice(2, 8)}`,
        type: trade.type === 'UP' ? 'buy' : 'sell',
        coin: asset.id,
        amount: isWin ? `+${payout}` : `-${trade.amount}`,
        usd: isWin ? `+₹${trade.amount.toLocaleString('en-IN')}` : `-₹${trade.amount.toLocaleString('en-IN')}`,
        price: `₹${trade.entryPrice.toFixed(2)}`,
        fee: '₹0',
        account: trade.placedInMode,
        status: 'completed',
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      });
    });
    setActiveTrades(prev => prev.filter(t => t.timeLeft > 0));
  }, [activeTrades, asset, setBalance, addTransaction, accountMode]);

  const handleTrade = (type: 'UP' | 'DOWN') => {
    if (balance < amount || amount < 1) return;
    window.navigator.vibrate?.([15, 30, 15]);
    const deductBalance = accountMode === 'demo' ? setDemoBalance : setRealBalance;
    deductBalance(prev => prev - amount);
    setActiveTrades(prev => [...prev, {
      id: Math.random().toString(36).slice(2, 11),
      type,
      entryPrice: price,
      amount,
      duration,
      timeLeft: duration,
      placedInMode: accountMode,
    }]);
  };

  const primaryTrade = activeTrades.length > 0 ? activeTrades[activeTrades.length - 1] : null;

  const dayOpen = candles.length > 0 ? candles[0].open : price;
  const priceChange = price - dayOpen;
  const priceChangePct = (priceChange / dayOpen) * 100;
  const isPriceUp = priceChange >= 0;

  return (
    <div className="flex flex-col h-full w-full text-white overflow-hidden" style={{ background: '#0a0e17' }}>

      {/* ── Compact Header ─────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 md:px-5 md:py-3" style={{ borderBottom: '1px solid rgba(56,70,90,0.25)' }}>
        <div className="flex items-center gap-2">
          <AccountToggle mode={accountMode} onChange={m => { if (activeTrades.length > 0) return; setAccountMode(m); }} compact />
          <span className={`text-[13px] font-black tabular-nums px-3 py-1.5 rounded-md ${isDemo ? 'text-amber-400' : 'text-white'}`} style={{ background: 'rgba(10,14,23,0.85)', border: '1px solid rgba(56,70,90,0.3)' }}>
            <span className="text-[10px] text-slate-500 mr-1">₹</span>
            {balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="text-right">
          <span className="text-sm font-black tabular-nums" style={{ color: isPriceUp ? C.up : C.down }}>
            {price >= 1000 ? price.toFixed(0) : price.toFixed(2)}
          </span>
          <span className="text-[9px] font-bold tabular-nums ml-1" style={{ color: isPriceUp ? C.up : C.down }}>
            {isPriceUp ? '+' : ''}{priceChangePct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* ── Content Area ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">

        {/* ── Left: Chart + OHLC ──────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="flex-1 min-h-0 relative" style={{ background: '#111119' }}>
            <TradeChart 
              candles={candles} 
              livePrice={price} 
              trades={activeTrades.map(t => ({
                id: t.id,
                type: t.type,
                entryPrice: t.entryPrice,
                amount: t.amount,
                duration: t.duration,
                timeLeft: t.timeLeft
              }))}
              activeTrade={primaryTrade ? {
                id: primaryTrade.id,
                type: primaryTrade.type,
                entryPrice: primaryTrade.entryPrice,
                amount: primaryTrade.amount,
                duration: primaryTrade.duration,
                timeLeft: primaryTrade.timeLeft
              } : null}
            />
          </div>

          {candles.length > 0 && (
            <div className="shrink-0 flex items-center gap-3 px-3 py-1.5 md:px-5 md:py-2" style={{
              background: '#0a0e17',
              borderTop: '1px solid rgba(56,70,90,0.15)',
            }}>
              {[
                { label: 'OPEN', value: candles[candles.length - 1].open.toFixed(price >= 1000 ? 0 : 2) },
                { label: 'HIGH', value: candles[candles.length - 1].high.toFixed(price >= 1000 ? 0 : 2), up: true },
                { label: 'LOW', value: candles[candles.length - 1].low.toFixed(price >= 1000 ? 0 : 2), up: false },
                { label: 'VOL', value: (candles[candles.length - 1].volume ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) },
              ].map((m, i) => (
                <div key={m.label} className="flex items-center gap-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(140,156,178,0.5)' }}>{m.label}</span>
                  <span className={`text-[10px] font-bold tabular-nums ${m.up === true ? 'text-emerald-400' : m.up === false ? 'text-rose-400' : 'text-slate-300'}`}>
                    {m.value}
                  </span>
                  {i < 3 && <span className="text-[8px]" style={{ color: 'rgba(140,156,178,0.2)' }}>|</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Controls Panel ────────────────────────────── */}
        <div className="shrink-0 w-full md:w-[300px] lg:w-[340px] flex flex-col overflow-y-auto border-t md:border-t-0 md:border-l" style={{ borderColor: 'rgba(56,70,90,0.25)', background: '#0a0e17' }}>

          {/* Active Trades */}
          {activeTrades.length > 0 && (
            <div className="px-3 py-2 space-y-1 md:px-4 md:py-3 border-b" style={{ borderColor: 'rgba(56,70,90,0.15)' }}>
              {activeTrades.map(t => {
                const isUp = t.type === 'UP';
                const pnl = isUp
                  ? ((price - t.entryPrice) / t.entryPrice) * t.amount
                  : ((t.entryPrice - price) / t.entryPrice) * t.amount;
                const isProfit = pnl >= 0;
                return (
                  <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px]" style={{
                    background: isProfit ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                    border: `1px solid ${isProfit ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
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

          {/* Amount & Duration */}
          <div className="px-3 py-3 space-y-3 md:px-4 md:py-4">
            {/* Amount */}
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Amount</span>
              <div className="flex items-center h-11 rounded-xl overflow-hidden" style={{ background: C.surface, border: '1px solid rgba(56,70,90,0.4)' }}>
                <button type="button" onClick={() => setAmount(a => Math.max(100, a - 100))}
                  className="w-10 h-full flex items-center justify-center active:bg-white/5">
                  <Minus className="w-4 h-4 text-slate-500" />
                </button>
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-[15px] font-black text-white tabular-nums">₹{amount}</span>
                </div>
                <button type="button" onClick={() => setAmount(a => a + 100)}
                  className="w-10 h-full flex items-center justify-center active:bg-white/5">
                  <Plus className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Duration */}
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Duration</span>
              <div className="grid grid-cols-5 gap-1.5">
                {[3, 5, 10, 30, 60].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className="h-10 rounded-lg text-[11px] font-bold transition-all"
                    style={duration === d
                      ? { background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.5)' }
                      : { background: C.surface, color: '#64748b', border: '1px solid rgba(56,70,90,0.4)' }
                    }
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            {/* Trade Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTrade('UP')}
                disabled={balance < amount}
                className="h-14 rounded-xl flex items-center justify-center gap-2 font-black text-[15px] active:scale-[0.97] transition-all disabled:opacity-30"
                style={{ background: C.up, color: '#fff' }}
              >
                <ArrowUp className="w-5 h-5" strokeWidth={3} />
                UP
              </button>
              <button
                type="button"
                onClick={() => handleTrade('DOWN')}
                disabled={balance < amount}
                className="h-14 rounded-xl flex items-center justify-center gap-2 font-black text-[15px] active:scale-[0.97] transition-all disabled:opacity-30"
                style={{ background: C.down, color: '#fff' }}
              >
                <ArrowDown className="w-5 h-5" strokeWidth={3} />
                DOWN
              </button>
            </div>

            {/* Sentiment */}
            <SentimentBar upPct={sentiment} />
          </div>
        </div>

      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default TradingDashboard;
