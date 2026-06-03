"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowUp, ArrowDown,
  TrendingUp, TrendingDown, Wallet, ArrowDownToLine,
  Minus, Plus, Clock, ShieldCheck, Zap,
} from "lucide-react";
import type { AccountMode } from '../types/account';
import AccountToggle from './AccountToggle';
import DepositModal from './DepositModal';
import WithdrawModal from './WithdrawModal';
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
  { id: 'BTC', name: 'Crypto IDX', icon: '₿', yield: 83, basePrice: 6696700, color: '#f7931a' },
  { id: 'ETH', name: 'Altcoin IDX', icon: 'Ξ', yield: 80, basePrice: 189545, color: '#627eea' },
  { id: 'SOL', name: 'Asia IDX', icon: 'S', yield: 85, basePrice: 7598, color: '#9945FF' },
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

/* ─── Candlestick Chart with Time Remaining Arc ───────────────────────── */
const CandlestickChart = ({
  candles,
  livePrice,
  activeTrades,
  primaryTrade,
}: {
  candles: Candle[];
  livePrice: number;
  activeTrades: ActiveTrade[];
  primaryTrade: ActiveTrade | null;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    const pad = { top: 20, right: 52, bottom: 20, left: 8 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    // Background
    ctx.fillStyle = '#131722';
    ctx.fillRect(0, 0, W, H);

    if (candles.length < 1) return;

    // Price range
    const allHighs = candles.map(c => c.high);
    const allLows = candles.map(c => c.low);
    const maxP = Math.max(...allHighs, livePrice);
    const minP = Math.min(...allLows, livePrice);
    const range = maxP - minP || 1;
    const padRange = range * 0.08;
    const adjMax = maxP + padRange;
    const adjMin = minP - padRange;
    const adjRange = adjMax - adjMin;

    const toY = (p: number) => pad.top + ((adjMax - p) / adjRange) * plotH;
    const barW = Math.max(4, Math.min(14, (plotW / candles.length) * 0.65));
    const gap = plotW / candles.length;

    // Horizontal grid lines — subtle
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 6; i++) {
      const y = pad.top + (plotH * i) / 6;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }

    // Vertical grid lines — subtle
    const vStep = Math.max(1, Math.floor(candles.length / 6));
    for (let i = 0; i < candles.length; i += vStep) {
      const x = pad.left + (i + 0.5) * gap;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
    }

    // Price axis labels (right side)
    ctx.fillStyle = '#555e6e';
    ctx.font = '10px -apple-system, monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i <= 6; i++) {
      const v = adjMax - (adjRange * i) / 6;
      const y = pad.top + (plotH * i) / 6;
      const label = v >= 100000 ? `${(v / 1000).toFixed(1)}k` : v >= 1000 ? v.toFixed(0) : v.toFixed(2);
      ctx.fillText(label, W - pad.right + 4, y + 3);
    }

    // Time axis labels (bottom)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3d4450';
    ctx.font = '9px -apple-system, monospace';
    const timeStep = Math.max(1, Math.floor(candles.length / 5));
    for (let i = 0; i < candles.length; i += timeStep) {
      const x = pad.left + (i + 0.5) * gap;
      const d = new Date(candles[i].time);
      const t = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      ctx.fillText(t, x, H - 4);
    }

    // Candles — solid filled like reference
    candles.forEach((c, i) => {
      const x = pad.left + (i + 0.5) * gap;
      const isUp = c.close >= c.open;
      const bodyTop = toY(Math.max(c.open, c.close));
      const bodyBot = toY(Math.min(c.open, c.close));
      const bodyH = Math.max(1.5, bodyBot - bodyTop);

      // Wick
      ctx.strokeStyle = isUp ? '#26a69a' : '#ef5350';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, toY(c.high));
      ctx.lineTo(x, toY(c.low));
      ctx.stroke();

      // Body — solid filled (both green and red)
      ctx.fillStyle = isUp ? '#26a69a' : '#ef5350';
      ctx.beginPath();
      ctx.roundRect(x - barW / 2, bodyTop, barW, bodyH, 1);
      ctx.fill();
    });

    // Live price dotted line
    const liveY = toY(livePrice);
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(pad.left, liveY);
    ctx.lineTo(W - pad.right, liveY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Live price label on axis
    const priceLabel = livePrice >= 1000 ? livePrice.toFixed(0) : livePrice.toFixed(2);
    ctx.font = 'bold 10px -apple-system, monospace';
    const plW = ctx.measureText(priceLabel).width + 12;
    ctx.fillStyle = '#2962ff';
    ctx.beginPath();
    ctx.roundRect(W - pad.right - 1, liveY - 10, plW, 20, 3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(priceLabel, W - pad.right + 5, liveY + 3);

    // Active trade entry lines
    activeTrades.forEach(trade => {
      const y = toY(trade.entryPrice);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = trade.type === 'UP' ? '#26a69a' : '#ef5350';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    });

    // Time remaining arc for primary (most recent) trade
    if (primaryTrade && primaryTrade.timeLeft > 0) {
      const progress = 1 - (primaryTrade.timeLeft / primaryTrade.duration);
      const arcX = W - pad.right - 24;
      const arcY = pad.top + 10;
      const arcR = 16;
      const isUp = primaryTrade.type === 'UP';
      const arcColor = isUp ? '#26a69a' : '#ef5350';

      // Background circle
      ctx.beginPath();
      ctx.arc(arcX, arcY, arcR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Progress arc
      ctx.beginPath();
      ctx.arc(arcX, arcY, arcR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = arcColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Time text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px -apple-system, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${primaryTrade.timeLeft}s`, arcX, arcY);
      ctx.textBaseline = 'alphabetic';

      // Vertical red line at current candle (like reference)
      const currentX = pad.left + (candles.length - 0.5) * gap;
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = '#ef5350';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(currentX, pad.top);
      ctx.lineTo(currentX, pad.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

  }, [candles, livePrice, activeTrades, primaryTrade]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
};

/* ─── Colors ────────────────────────────────────────────────────────────── */
const C = {
  bg: '#131722',
  up: '#26a69a',
  down: '#ef5350',
  accent: '#2962ff',
  muted: '#555e6e',
  card: '#1e222d',
  border: '#2a2e39',
};

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ─── Majority Opinion Bar ─────────────────────────────────────────────── */
const MajorityOpinion = () => {
  const upPct = 40 + Math.floor(Math.random() * 20);
  const downPct = 100 - upPct;
  return (
    <div className="px-1 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-gray-500">Majority opinion</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
        <div className="rounded-l-full transition-all" style={{ width: `${upPct}%`, backgroundColor: C.up }} />
        <div className="rounded-r-full transition-all" style={{ width: `${downPct}%`, backgroundColor: C.down }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-bold" style={{ color: C.up }}>{upPct}%</span>
        <span className="text-[10px] font-bold" style={{ color: C.down }}>{downPct}%</span>
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
  onDeposit: (amount: number, meta?: { orderId: string; utr?: string }) => void | Promise<void>;
  onWithdraw: (amount: number) => void;
  addTransaction: (tx: Record<string, string>) => void;
}> = ({
  accountMode, setAccountMode, balance, setBalance, realBalance,
  onDeposit, onWithdraw, addTransaction,
}) => {
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const isDemo = accountMode === 'demo';

  const [asset, setAsset] = useState(ASSETS[0]);
  const [amount, setAmount] = useState(100);
  const [duration, setDuration] = useState(60);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [price, setPrice] = useState(asset.basePrice);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [result, setResult] = useState<{ win: boolean; amt: number } | null>(null);
  const priceRef = useRef(price);

  useEffect(() => { priceRef.current = price; }, [price]);
  useEffect(() => { setPrice(getLivePrice(SYMBOL_MAP[asset.id] ?? 'BTC/INR')); }, [asset]);

  // Tick market engine + update local price/candles
  useEffect(() => {
    const iv = setInterval(() => {
      tickPrices();
      const sym = SYMBOL_MAP[asset.id] ?? 'BTC/INR';
      setPrice(getLivePrice(sym));
      setCandles(getLiveCandles(sym, 60));
    }, 400);
    return () => clearInterval(iv);
  }, [asset]);

  // Initial candle load
  useEffect(() => {
    const sym = SYMBOL_MAP[asset.id] ?? 'BTC/INR';
    setCandles(getLiveCandles(sym, 60));
    setPrice(getLivePrice(sym));
  }, [asset]);

  // Trade timer
  useEffect(() => {
    const iv = setInterval(() => {
      setActiveTrades(prev => prev.map(t => ({ ...t, timeLeft: Math.max(0, t.timeLeft - 1) })));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Settle trades
  useEffect(() => {
    const settled = activeTrades.filter(t => t.timeLeft === 0);
    if (!settled.length) return;
    settled.forEach(trade => {
      const p = priceRef.current;
      const isWin = trade.type === 'UP' ? p > trade.entryPrice : p < trade.entryPrice;
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

  const payout = amount * (1 + asset.yield / 100);
  const earnings = payout - amount;

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
  const timeOpts = [10, 20, 30, 60, 120];
  const amountOpts = [100, 500, 1000, 5000];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#131722] text-white overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-[#1e222d] border-b border-[#2a2e39] px-4 py-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowDeposit(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#26a69a]/10 border border-[#26a69a]/25 text-[#26a69a] active:scale-95 transition-all"
        >
          <Wallet className="w-3.5 h-3.5" />
          Deposit
        </button>
        <div className="flex flex-col items-center">
          <AccountToggle mode={accountMode} onChange={setAccountMode} compact />
          <span className={`text-lg font-black tabular-nums mt-0.5 ${isDemo ? 'text-[#f0b90b]' : 'text-white'}`}>
            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (isDemo) { setToast('Switch to Real account to withdraw'); setTimeout(() => setToast(null), 2500); return; }
            setShowWithdraw(true);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border active:scale-95 transition-all ${
            isDemo ? 'border-white/10 text-gray-500' : 'border-[#f0b90b]/25 text-[#f0b90b] bg-[#f0b90b]/10'
          }`}
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Withdraw
        </button>
      </header>

      {/* ── Asset Tabs ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[#1e222d] border-b border-[#2a2e39] overflow-x-auto">
        {ASSETS.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAsset(a)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              asset.id === a.id
                ? 'bg-[#2a2e39] text-white border border-white/10'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            <span style={{ color: a.color }}>{a.icon}</span>
            <span>{a.name}</span>
            <span className={`text-[10px] ${asset.id === a.id ? 'text-[#f0b90b]' : 'text-gray-600'}`}>{a.yield}%</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#2962ff]/10 border border-[#2962ff]/20 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-[#26a69a] animate-pulse" />
          <span className="text-xs font-mono font-bold tabular-nums text-[#2962ff]">
            ₹{price >= 1000 ? price.toFixed(0) : price.toFixed(2)}
          </span>
        </div>
      </div>

      {/* ── Chart ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        <CandlestickChart
          candles={candles}
          livePrice={price}
          activeTrades={activeTrades}
          primaryTrade={primaryTrade}
        />
      </div>

      {/* ── Controls ───────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#1e222d] border-t border-[#2a2e39] px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">

        {/* Active trades */}
        {activeTrades.length > 0 && (
          <div className="mb-2 space-y-1 max-h-20 overflow-y-auto">
            {activeTrades.map(t => {
              const isUp = t.type === 'UP';
              const pnl = isUp
                ? ((price - t.entryPrice) / t.entryPrice) * t.amount
                : ((t.entryPrice - price) / t.entryPrice) * t.amount;
              return (
                <div key={t.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
                  isUp ? 'bg-[#26a69a]/10' : 'bg-[#ef5350]/10'
                }`}>
                  <span className="font-bold" style={{ color: isUp ? C.up : C.down }}>{t.type}</span>
                  <span className="text-white">₹{t.amount}</span>
                  <span className="ml-auto font-mono font-bold tabular-nums" style={{ color: pnl >= 0 ? C.up : C.down }}>
                    {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(0)}
                  </span>
                  <span className="text-gray-500 font-mono text-[10px]">{t.timeLeft}s</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Amount & Time — Reference style */}
        <div className="flex gap-3 mb-2">
          {/* Amount */}
          <div className="flex-1">
            <div className="flex items-center h-10 bg-[#2a2e39] rounded-lg overflow-hidden">
              <button type="button" onClick={() => setAmount(a => Math.max(100, a - 100))}
                className="w-10 h-full flex items-center justify-center active:bg-white/5 transition-colors">
                <Minus className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <div className="flex-1 flex items-center justify-center">
                <span className="text-sm font-black text-white tabular-nums">₹{amount}</span>
              </div>
              <button type="button" onClick={() => setAmount(a => a + 100)}
                className="w-10 h-full flex items-center justify-center active:bg-white/5 transition-colors">
                <Plus className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>
          {/* Time */}
          <div className="flex-1">
            <div className="flex items-center h-10 bg-[#2a2e39] rounded-lg overflow-hidden">
              <button type="button" onClick={() => setDuration(d => Math.max(10, d - 10))}
                className="w-10 h-full flex items-center justify-center active:bg-white/5 transition-colors">
                <Minus className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <div className="flex-1 flex items-center justify-center">
                <span className="text-sm font-black text-white tabular-nums">{formatTime(duration)}</span>
              </div>
              <button type="button" onClick={() => setDuration(d => d + 10)}
                className="w-10 h-full flex items-center justify-center active:bg-white/5 transition-colors">
                <Plus className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Earnings — like reference */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs text-gray-500">Earnings</span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#26a69a]">+{asset.yield}%</span>
            <span className="text-sm font-black text-white tabular-nums">₹{payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.00</span>
          </div>
        </div>

        {/* Majority Opinion */}
        <MajorityOpinion />

        {/* Trade buttons — Reference style */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            type="button"
            onClick={() => handleTrade('UP')}
            disabled={balance < amount}
            className="h-12 rounded-xl flex items-center justify-center gap-2 font-black active:scale-[0.97] transition-all disabled:opacity-40 bg-[#26a69a] shadow-[0_4px_16px_rgba(38,166,154,0.25)]"
          >
            <ArrowUp className="w-5 h-5" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={() => handleTrade('DOWN')}
            disabled={balance < amount}
            className="h-12 rounded-xl flex items-center justify-center gap-2 font-black active:scale-[0.97] transition-all disabled:opacity-40 bg-[#ef5350] shadow-[0_4px_16px_rgba(239,83,80,0.25)]"
          >
            <ArrowDown className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* ── Result Popup ───────────────────────────────────────────── */}
      {result && (
        <div className="absolute inset-x-0 top-16 z-[100] flex justify-center pointer-events-none animate-[slideUp_0.3s_ease-out]">
          <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl border-2 shadow-2xl backdrop-blur-sm ${
            result.win ? 'bg-[#26a69a]/10 border-[#26a69a]/80' : 'bg-[#ef5350]/10 border-[#ef5350]/80'
          }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              result.win ? 'bg-[#26a69a]/15' : 'bg-[#ef5350]/15'
            }`}>
              {result.win
                ? <TrendingUp className="w-6 h-6" style={{ color: C.up }} />
                : <TrendingDown className="w-6 h-6" style={{ color: C.down }} />}
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">{result.win ? 'Profit' : 'Loss'}</p>
              <p className="text-2xl font-black tabular-nums" style={{ color: result.win ? C.up : C.down }}>
                {result.amt >= 0 ? '+' : ''}₹{Math.abs(result.amt).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ──────────────────────────────────────────────────── */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[120] bg-[#2a2e39] border border-[#f0b90b]/40 px-4 py-2 rounded-xl shadow-xl">
          <p className="text-xs font-bold text-[#f0b90b]">{toast}</p>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────── */}
      {showDeposit && (
        <DepositModal
          onClose={() => setShowDeposit(false)}
          onPaymentSuccess={async (amt, meta) => { await onDeposit(amt, meta); setAccountMode('real'); }}
        />
      )}
      {showWithdraw && (
        <WithdrawModal
          balance={realBalance}
          onClose={() => setShowWithdraw(false)}
          onWithdraw={amt => { onWithdraw(amt); setShowWithdraw(false); }}
        />
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
