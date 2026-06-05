"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowUp, ArrowDown,
  TrendingUp, TrendingDown,
  Minus, Plus,
} from "lucide-react";
import type { AccountMode } from '../types/account';
import AccountToggle from './AccountToggle';

const BALANCE_KEY = 'tryonetrade_trade_balance';

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

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

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

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

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

const TradingDashboard: React.FC<{
  accountMode: AccountMode;
  setAccountMode: (mode: AccountMode) => void;
  balance: number;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  realBalance: number;
  addTransaction: (tx: Record<string, string>) => void;
}> = ({
  accountMode, setAccountMode, balance: _balance, setBalance, realBalance: _realBalance,
  addTransaction,
}) => {
  const isDemo = accountMode === 'demo';

  /* ─── Self-contained balance (localStorage-backed) ─────────── */
  const [localBalance, setLocalBalance] = useState(() => {
    try {
      const saved = localStorage.getItem(BALANCE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return _balance;
  });

  useEffect(() => {
    localStorage.setItem(BALANCE_KEY, JSON.stringify(localBalance));
  }, [localBalance]);

  /* Sync outward to parent less frequently */
  const syncRef = useRef(0);
  useEffect(() => {
    syncRef.current++;
    if (syncRef.current % 3 === 0) setBalance(localBalance);
  }, [localBalance, setBalance]);

  /* ─── Local state ─────────────────────────────────────────── */
  const [asset, setAsset] = useState(ASSETS[0]);
  const [amount, setAmount] = useState(100);
  const [duration, setDuration] = useState(3);
  const [sentiment, setSentiment] = useState(55);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [price, setPrice] = useState(asset.basePrice);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [result, setResult] = useState<{ win: boolean; amt: number } | null>(null);
  const txIdRef = useRef(0);
  const priceRef = useRef(price);
  const candlePtr = useRef(0);
  const chartRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => { priceRef.current = price; }, [price]);

  /* ─── Mock market loop (1s, pure client-side) ─────────────── */
  useEffect(() => {
    const base = asset.basePrice;
    const volatility = base * 0.002;
    const seed = Date.now();

    const iv = setInterval(() => {
      candlePtr.current++;
      const tick = (seededRandom(candlePtr.current + seed) - 0.5) * volatility;
      const newPrice = Math.max(base * 0.95, Math.min(base * 1.05, priceRef.current + tick));
      setPrice(newPrice);

      setCandles(prev => {
        const now = Date.now();
        const last = prev.length > 0 ? prev[prev.length - 1] : null;
        if (last && now - last.time < 1000) {
          const updated: Candle = {
            ...last,
            close: newPrice,
            high: Math.max(last.high, newPrice),
            low: Math.min(last.low, newPrice),
            volume: last.volume + Math.floor(Math.random() * 10),
          };
          const copy = [...prev];
          copy[copy.length - 1] = updated;
          return copy;
        }
        return [...prev, {
          time: now,
          open: last ? last.close : newPrice,
          high: newPrice,
          low: newPrice,
          close: newPrice,
          volume: Math.floor(Math.random() * 100) + 10,
        }].slice(-120);
      });
    }, 1000);

    return () => clearInterval(iv);
  }, [asset]);

  /* ─── Sentiment ───────────────────────────────────────────── */
  useEffect(() => {
    const iv = setInterval(() => {
      setSentiment(35 + Math.floor(Math.random() * 30));
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  /* ─── Trade countdown ─────────────────────────────────────── */
  useEffect(() => {
    const iv = setInterval(() => {
      setActiveTrades(prev => prev.map(t => ({ ...t, timeLeft: Math.max(0, t.timeLeft - 1) })));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  /* ─── Settle expired trades (50/50 random) ────────────────── */
  useEffect(() => {
    const settled = activeTrades.filter(t => t.timeLeft === 0);
    if (!settled.length) return;

    settled.forEach(trade => {
      const isWin = Math.random() < 0.5;
      const payout = Math.floor(trade.amount * (1 + asset.yield / 100));

      if (isWin) {
        setLocalBalance(prev => prev + payout);
        window.navigator.vibrate?.([50, 150, 50]);
      } else {
        window.navigator.vibrate?.(100);
      }

      const id = `TX-${String(++txIdRef.current).padStart(4, '0')}`;
      addTransaction({
        id,
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
  }, [activeTrades, asset, addTransaction, accountMode]);

  const handleTrade = useCallback((type: 'UP' | 'DOWN') => {
    if (localBalance < amount || amount < 1) return;
    window.navigator.vibrate?.([15, 30, 15]);
    setLocalBalance(prev => prev - amount);
    setActiveTrades(prev => [...prev, {
      id: Math.random().toString(36).slice(2, 11),
      type,
      entryPrice: price,
      amount,
      duration,
      timeLeft: duration,
    }]);
  }, [localBalance, amount, price, duration]);

  /* ─── Inline TradingView widget ───────────────────────────── */
  useEffect(() => {
    if (!chartRef.current) return;

    chartRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => {
      if (typeof (window as any).TradingView !== "undefined") {
        widgetRef.current = new (window as any).TradingView.widget({
          autosize: true,
          symbol: "BINANCE:BTCUSDT",
          interval: "1",
          timezone: "Asia/Kolkata",
          theme: "dark",
          style: "1",
          locale: "en",
          enable_publishing: false,
          hide_side_toolbar: true,
          allow_symbol_change: false,
          calendar: false,
          container_id: "tv_chart_container",
        });
      }
    };

    chartRef.current.appendChild(script);

    return () => {
      if (widgetRef.current && typeof widgetRef.current.remove === "function") {
        widgetRef.current.remove();
      }
      widgetRef.current = null;
      if (chartRef.current) {
        chartRef.current.innerHTML = "";
      }
    };
  }, []);

  const primaryTrade = activeTrades.length > 0 ? activeTrades[activeTrades.length - 1] : null;
  const dayOpen = candles.length > 0 ? candles[0].open : price;
  const priceChange = price - dayOpen;
  const priceChangePct = (priceChange / dayOpen) * 100;
  const isPriceUp = priceChange >= 0;

  return (
    <div className="flex flex-col h-full w-full text-white overflow-hidden" style={{ background: '#0a0e17' }}>

      {/* ── Compact Header ─────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(56,70,90,0.25)' }}>
        <div className="flex items-center gap-2">
          <AccountToggle mode={accountMode} onChange={setAccountMode} compact />
          <div className="flex items-center gap-2">
            {ASSETS.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAsset(a)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all"
                style={asset.id === a.id
                  ? { background: `${asset.color}25`, color: asset.color, border: `1px solid ${asset.color}50` }
                  : { background: 'rgba(56,70,90,0.3)', color: '#64748b' }
                }
              >
                <span className="text-xs">{a.icon}</span>
                <span>{a.id}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-black tabular-nums px-2.5 py-1 rounded-md ${isDemo ? 'text-amber-400' : 'text-white'}`} style={{ background: 'rgba(10,14,23,0.85)', border: '1px solid rgba(56,70,90,0.3)' }}>
            ₹{localBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="text-right">
            <span className="text-sm font-black tabular-nums" style={{ color: isPriceUp ? C.up : C.down }}>
              {price >= 1000 ? price.toFixed(0) : price.toFixed(2)}
            </span>
            <span className="text-[9px] font-bold tabular-nums ml-1" style={{ color: isPriceUp ? C.up : C.down }}>
              {isPriceUp ? '+' : ''}{priceChangePct.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Chart Viewport ──────────────────────────────────────── */}
      <div className="flex-1 min-h-[320px] md:min-h-[400px] relative" style={{ background: '#111119' }}>
        <div ref={chartRef} className="w-full h-full absolute inset-0" id="tv_wrapper">
          <div id="tv_chart_container" className="w-full h-full" />
        </div>
      </div>

      {/* ── OHLC Banner ─────────────────────────────────────────── */}
      {candles.length > 0 && (
        <div className="shrink-0 flex items-center gap-3 px-3 py-1.5" style={{
          background: '#0a0e17',
          borderTop: '1px solid rgba(56,70,90,0.15)',
          borderBottom: '1px solid rgba(56,70,90,0.15)',
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

      {/* ── Bottom Controls ─────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-2 pb-[max(8px,env(safe-area-inset-bottom))]" style={{ background: '#0a0e17', borderTop: '1px solid rgba(56,70,90,0.25)' }}>

        {/* Active Trades */}
        {activeTrades.length > 0 && (
          <div className="mb-2 space-y-1 max-h-20 overflow-y-auto">
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

        {/* Trade Controls Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <div className="flex items-center h-10 rounded-lg overflow-hidden" style={{ background: C.surface, border: '1px solid rgba(56,70,90,0.4)' }}>
              <button type="button" onClick={() => setAmount(a => Math.max(100, a - 100))}
                className="w-8 h-full flex items-center justify-center active:bg-white/5">
                <Minus className="w-4 h-4 text-slate-500" />
              </button>
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[13px] font-black text-white tabular-nums">₹{amount}</span>
              </div>
              <button type="button" onClick={() => setAmount(a => a + 100)}
                className="w-8 h-full flex items-center justify-center active:bg-white/5">
                <Plus className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {[3, 5, 10, 30, 60].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className="h-8 rounded-md text-[10px] font-bold transition-all"
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

          <div className="grid grid-rows-2 gap-2">
            <button
              type="button"
              onClick={() => handleTrade('UP')}
              disabled={localBalance < amount}
              className="rounded-lg flex items-center justify-center gap-2 font-black text-[14px] active:scale-[0.97] transition-all disabled:opacity-30"
              style={{ background: C.up, color: '#fff' }}
            >
              <ArrowUp className="w-5 h-5" strokeWidth={3} />
              UP
            </button>
            <button
              type="button"
              onClick={() => handleTrade('DOWN')}
              disabled={localBalance < amount}
              className="rounded-lg flex items-center justify-center gap-2 font-black text-[14px] active:scale-[0.97] transition-all disabled:opacity-30"
              style={{ background: C.down, color: '#fff' }}
            >
              <ArrowDown className="w-5 h-5" strokeWidth={3} />
              DOWN
            </button>
          </div>
        </div>

        <SentimentBar upPct={sentiment} />
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

export default TradingDashboard;
