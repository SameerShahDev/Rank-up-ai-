"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowUp, ArrowDown,
  TrendingUp, TrendingDown, Wallet, ArrowDownToLine,
  Minus, Plus,
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

/* ─── Realistic Candlestick Chart (TradingView/Binance style) ─────────── */
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
    const pad = { top: 12, right: 58, bottom: 24, left: 8 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    /* ── Background — deep trading terminal ────────────────────── */
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    // Subtle top gradient
    const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.4);
    topGrad.addColorStop(0, 'rgba(30, 41, 59, 0.25)');
    topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, H * 0.4);

    if (candles.length < 1) return;

    /* ── Price range — generous padding ───────────────────────── */
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
    const slot = plotW / candles.length;
    // Realistic candle body width: ~72% of slot
    const barW = Math.max(3, Math.min(12, slot * 0.72));
    const gap = slot;

    /* ── Horizontal grid — crisp solid lines ─────────────────── */
    const gridCount = 5;
    for (let i = 0; i <= gridCount; i++) {
      const y = pad.top + (plotH * i) / gridCount;
      ctx.strokeStyle = i === 0 || i === gridCount
        ? 'rgba(148,163,184,0.08)'
        : 'rgba(148,163,184,0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }

    /* ── Vertical grid — sparse and subtle ────────────────────── */
    const vStep = Math.max(1, Math.floor(candles.length / 6));
    for (let i = 0; i < candles.length; i += vStep) {
      const x = pad.left + (i + 0.5) * gap;
      ctx.strokeStyle = 'rgba(148,163,184,0.03)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
    }

    /* ── Moving averages (rendered behind candles) ────────────── */
    const calcMA = (period: number) => {
      const result: (number | null)[] = [];
      for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) { result.push(null); continue; }
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
        result.push(sum / period);
      }
      return result;
    };

    const drawMA = (period: number, color: string) => {
      const ma = calcMA(period);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      ma.forEach((v, i) => {
        if (v === null) return;
        const x = pad.left + (i + 0.5) * gap;
        const y = toY(v);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    drawMA(7, 'rgba(245, 158, 11, 0.55)');
    drawMA(25, 'rgba(139, 92, 246, 0.4)');

    /* ── Candles — Binance/TradingView realistic style ────────── */
    // Bull (up): #26a69a solid filled
    // Bear (down): #ef5354 solid filled
    const bullColor = '#26a69a';
    const bearColor = '#ef5354';
    const bullWick = '#26a69a';
    const bearWick = '#ef5354';

    candles.forEach((c, i) => {
      const x = pad.left + (i + 0.5) * gap;
      const isUp = c.close >= c.open;
      const bodyTop = toY(Math.max(c.open, c.close));
      const bodyBot = toY(Math.min(c.open, c.close));
      const bodyH = Math.max(1, bodyBot - bodyTop);
      const highY = toY(c.high);
      const lowY = toY(c.low);
      const left = x - barW / 2;

      // Wick — crisp vertical line from high to low
      ctx.strokeStyle = isUp ? bullWick : bearWick;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body — solid filled rectangle
      ctx.fillStyle = isUp ? bullColor : bearColor;
      ctx.fillRect(left, bodyTop, barW, bodyH);
    });

    /* ── Live price line — bright dashed ──────────────────────── */
    const liveY = toY(livePrice);
    const isLiveUp = candles.length > 0 && livePrice >= candles[candles.length - 1].open;
    const lineColor = isLiveUp ? bullColor : bearColor;

    // Background band for the line (subtle)
    const bandGrad = ctx.createLinearGradient(0, liveY - 50, 0, liveY + 50);
    bandGrad.addColorStop(0, isLiveUp ? 'rgba(38,166,154,0)' : 'rgba(239,83,84,0)');
    bandGrad.addColorStop(0.5, isLiveUp ? 'rgba(38,166,154,0.04)' : 'rgba(239,83,84,0.04)');
    bandGrad.addColorStop(1, isLiveUp ? 'rgba(38,166,154,0)' : 'rgba(239,83,84,0)');
    ctx.fillStyle = bandGrad;
    ctx.fillRect(pad.left, liveY - 50, plotW, 100);

    // Dashed line
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, liveY);
    ctx.lineTo(W - pad.right, liveY);
    ctx.stroke();
    ctx.setLineDash([]);

    /* ── Live price label — solid color pill (Binance style) ─── */
    const priceLabel = livePrice >= 1000 ? livePrice.toFixed(2) : livePrice.toFixed(4);
    ctx.font = 'bold 11px "SF Mono", Menlo, monospace';
    const plW = ctx.measureText(priceLabel).width + 12;
    const plH = 20;
    const plX = W - pad.right;
    const plY = liveY - plH / 2;

    // Solid filled pill (no gradient — more realistic)
    ctx.fillStyle = lineColor;
    ctx.fillRect(plX, plY, plW, plH);

    // Triangle pointer on the left edge
    ctx.beginPath();
    ctx.moveTo(plX, plY);
    ctx.lineTo(plX - 4, liveY);
    ctx.lineTo(plX, plY + plH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(priceLabel, plX + 6, liveY);
    ctx.textBaseline = 'alphabetic';

    /* ── Price axis labels (right) ────────────────────────────── */
    ctx.font = '10px "SF Mono", Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= gridCount; i++) {
      const v = adjMax - (adjRange * i) / gridCount;
      const y = pad.top + (plotH * i) / gridCount;
      const label = v >= 100000 ? `${(v / 1000).toFixed(1)}k` : v >= 1000 ? v.toFixed(0) : v.toFixed(2);
      ctx.fillStyle = 'rgba(148,163,184,0.5)';
      ctx.fillText(label, W - pad.right + 6, y);
    }
    ctx.textBaseline = 'alphabetic';

    /* ── Time axis labels (bottom) ────────────────────────────── */
    ctx.textAlign = 'center';
    ctx.font = '9px "SF Mono", Menlo, monospace';
    const timeStep = Math.max(1, Math.floor(candles.length / 6));
    for (let i = 0; i < candles.length; i += timeStep) {
      const x = pad.left + (i + 0.5) * gap;
      const d = new Date(candles[i].time);
      const t = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      ctx.fillStyle = 'rgba(148,163,184,0.4)';
      ctx.fillText(t, x, H - 8);
    }

    /* ── Active trade entry lines ─────────────────────────────── */
    activeTrades.forEach(trade => {
      const y = toY(trade.entryPrice);
      const tradeColor = trade.type === 'UP' ? bullColor : bearColor;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = tradeColor;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Entry price tag on left
      const entryLabel = trade.entryPrice >= 1000 ? trade.entryPrice.toFixed(0) : trade.entryPrice.toFixed(2);
      ctx.font = 'bold 9px "SF Mono", monospace';
      ctx.fillStyle = tradeColor;
      ctx.globalAlpha = 0.9;
      const tagW = ctx.measureText(entryLabel).width + 8;
      ctx.fillRect(pad.left, y - 9, tagW, 14);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(entryLabel, pad.left + 4, y + 1);
      ctx.globalAlpha = 1;
    });

    /* ── Time remaining arc (top-right corner) ───────────────── */
    if (primaryTrade && primaryTrade.timeLeft > 0) {
      const progress = 1 - (primaryTrade.timeLeft / primaryTrade.duration);
      const arcX = pad.left + 18;
      const arcY = pad.top + 18;
      const arcR = 14;
      const isUp = primaryTrade.type === 'UP';
      const arcColor = isUp ? bullColor : bearColor;

      // Background
      ctx.beginPath();
      ctx.arc(arcX, arcY, arcR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,0.1)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Progress
      ctx.beginPath();
      ctx.arc(arcX, arcY, arcR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = arcColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Time text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px "SF Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${primaryTrade.timeLeft}`, arcX, arcY);
      ctx.textBaseline = 'alphabetic';
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
  bg: '#0d1117',
  up: '#26a69a',
  down: '#ef5354',
  accent: '#3b82f6',
  muted: '#64748b',
  card: '#151d2e',
  border: '#1e293b',
  surface: '#1a2332',
};

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ─── Market Sentiment Bar ─────────────────────────────────────────────── */
const MajorityOpinion = () => {
  const upPct = 40 + Math.floor(Math.random() * 20);
  const downPct = 100 - upPct;
  return (
    <div className="px-1 py-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Market Sentiment</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.03]">
        <div className="rounded-l-full transition-all duration-500" style={{ width: `${upPct}%`, background: C.up }} />
        <div className="rounded-r-full transition-all duration-500" style={{ width: `${downPct}%`, background: C.down }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-bold tabular-nums" style={{ color: C.up }}>{upPct}%</span>
        <span className="text-[10px] font-bold tabular-nums" style={{ color: C.down }}>{downPct}%</span>
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
  const isDemo = accountMode === 'demo';

  const [asset, setAsset] = useState(ASSETS[0]);
  const [amount, setAmount] = useState(100);
  const [duration, setDuration] = useState(60);
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
    }, 800);
    return () => clearInterval(iv);
  }, [asset]);

  useEffect(() => {
    const sym = SYMBOL_MAP[asset.id] ?? 'BTC/INR';
    setCandles(getLiveCandles(sym, 60));
    setPrice(getLivePrice(sym));
  }, [asset]);

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

  const payout = amount * (1 + asset.yield / 100);

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

  const priceChange = candles.length > 0 ? ((price - candles[0].open) / candles[0].open * 100) : 0;
  const isPriceUp = priceChange >= 0;

  return (
    <div className="flex flex-col h-full w-full text-white overflow-hidden" style={{ background: '#0d1117' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 md:px-4" style={{ background: '#0d1117', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
        <button
          type="button"
          onClick={() => setShowDeposit(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95"
          style={{ background: 'rgba(38,166,154,0.1)', border: '1px solid rgba(38,166,154,0.25)', color: '#26a69a' }}
        >
          <Wallet className="w-3.5 h-3.5" />
          Deposit
        </button>
        <div className="flex flex-col items-center">
          <AccountToggle mode={accountMode} onChange={setAccountMode} compact />
          <span className={`text-base font-black tabular-nums mt-0.5 tracking-tight ${isDemo ? 'text-amber-400' : 'text-white'}`}>
            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowWithdraw(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95"
          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Withdraw
        </button>
      </header>

      {/* ── Asset Tabs ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 md:px-4 overflow-x-auto" style={{ background: '#0d1117', borderBottom: '1px solid rgba(148,163,184,0.04)' }}>
        {ASSETS.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAsset(a)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              asset.id === a.id ? 'text-white' : 'text-slate-500'
            }`}
            style={asset.id === a.id
              ? { background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.1)' }
              : { border: '1px solid transparent' }
            }
          >
            <span style={{ color: a.color }}>{a.icon}</span>
            <span>{a.name}</span>
            <span className={`text-[10px] font-bold ${asset.id === a.id ? 'text-amber-400' : 'text-slate-600'}`}>{a.yield}%</span>
          </button>
        ))}
      </div>

      {/* ── Chart ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative" style={{ background: '#0d1117' }}>
        <CandlestickChart
          candles={candles}
          livePrice={price}
          activeTrades={activeTrades}
          primaryTrade={primaryTrade}
        />

        {/* Asset info overlay — top left */}
        <div className="absolute top-2 left-2 pointer-events-none">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(148,163,184,0.06)' }}>
            <span className="text-base" style={{ color: asset.color }}>{asset.icon}</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-300">{asset.name}</span>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: isPriceUp ? '#26a69a' : '#ef5354' }}>
                {isPriceUp ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* MA Legend — bottom left */}
        <div className="absolute bottom-7 left-2 pointer-events-none flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-px rounded-full" style={{ background: 'rgba(245,158,11,0.7)' }} />
            <span className="text-[9px] font-mono" style={{ color: 'rgba(245,158,11,0.7)' }}>MA7</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-px rounded-full" style={{ background: 'rgba(139,92,246,0.7)' }} />
            <span className="text-[9px] font-mono" style={{ color: 'rgba(139,92,246,0.7)' }}>MA25</span>
          </div>
        </div>
      </div>

      {/* ── Controls ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 pt-2.5 pb-[max(8px,env(safe-area-inset-bottom))] md:px-4" style={{ background: '#0d1117', borderTop: '1px solid rgba(148,163,184,0.06)' }}>

        {/* Active trades */}
        {activeTrades.length > 0 && (
          <div className="mb-2 space-y-1 max-h-16 overflow-y-auto">
            {activeTrades.map(t => {
              const isUp = t.type === 'UP';
              const pnl = isUp
                ? ((price - t.entryPrice) / t.entryPrice) * t.amount
                : ((t.entryPrice - price) / t.entryPrice) * t.amount;
              const isProfit = pnl >= 0;
              return (
                <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs" style={{
                  background: isProfit ? 'rgba(38,166,154,0.06)' : 'rgba(239,83,84,0.06)',
                  border: `1px solid ${isProfit ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,84,0.15)'}`,
                }}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black" style={{
                    background: isProfit ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,84,0.15)',
                    color: isProfit ? C.up : C.down,
                  }}>
                    {isProfit ? '▲' : '▼'}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <span className="font-bold text-white text-[11px]">₹{t.amount} · {t.type}</span>
                    <span className="text-[10px] font-mono text-slate-500">{formatTime(t.timeLeft)}</span>
                    <span className="text-xs font-black tabular-nums" style={{ color: isProfit ? C.up : C.down }}>
                      {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Amount & Time — compact */}
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center h-9 rounded-lg overflow-hidden" style={{ background: '#161b22', border: '1px solid rgba(148,163,184,0.08)' }}>
              <button type="button" onClick={() => setAmount(a => Math.max(100, a - 100))}
                className="w-8 h-full flex items-center justify-center active:bg-white/5">
                <Minus className="w-3 h-3 text-slate-500" />
              </button>
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[13px] font-black text-white tabular-nums">₹{amount}</span>
              </div>
              <button type="button" onClick={() => setAmount(a => a + 100)}
                className="w-8 h-full flex items-center justify-center active:bg-white/5">
                <Plus className="w-3 h-3 text-slate-500" />
              </button>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center h-9 rounded-lg overflow-hidden" style={{ background: '#161b22', border: '1px solid rgba(148,163,184,0.08)' }}>
              <button type="button" onClick={() => setDuration(d => Math.max(10, d - 10))}
                className="w-8 h-full flex items-center justify-center active:bg-white/5">
                <Minus className="w-3 h-3 text-slate-500" />
              </button>
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[13px] font-black text-white tabular-nums">{formatTime(duration)}</span>
              </div>
              <button type="button" onClick={() => setDuration(d => d + 10)}
                className="w-8 h-full flex items-center justify-center active:bg-white/5">
                <Plus className="w-3 h-3 text-slate-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Earnings row */}
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Earnings</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold" style={{ color: C.up }}>+{asset.yield}%</span>
            <span className="text-[13px] font-black text-white tabular-nums">₹{payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.00</span>
          </div>
        </div>

        {/* Sentiment */}
        <MajorityOpinion />

        {/* Trade buttons */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            type="button"
            onClick={() => handleTrade('UP')}
            disabled={balance < amount}
            className="h-11 rounded-xl flex items-center justify-center gap-1.5 font-black text-sm active:scale-[0.97] transition-all disabled:opacity-30"
            style={{
              background: C.up,
              boxShadow: '0 2px 12px rgba(38,166,154,0.25)',
            }}
          >
            <ArrowUp className="w-4 h-4" strokeWidth={3} />
            <span>UP</span>
          </button>
          <button
            type="button"
            onClick={() => handleTrade('DOWN')}
            disabled={balance < amount}
            className="h-11 rounded-xl flex items-center justify-center gap-1.5 font-black text-sm active:scale-[0.97] transition-all disabled:opacity-30"
            style={{
              background: C.down,
              boxShadow: '0 2px 12px rgba(239,83,84,0.25)',
            }}
          >
            <ArrowDown className="w-4 h-4" strokeWidth={3} />
            <span>DOWN</span>
          </button>
        </div>
      </div>

      {/* ── Result Popup ───────────────────────────────────────────── */}
      {result && (
        <div className="absolute inset-x-0 top-12 z-[100] flex justify-center pointer-events-none animate-[slideUp_0.3s_ease-out]">
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl backdrop-blur-xl" style={{
            background: result.win ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,84,0.12)',
            border: `1px solid ${result.win ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,84,0.4)'}`,
            boxShadow: result.win
              ? '0 0 40px rgba(38,166,154,0.2)'
              : '0 0 40px rgba(239,83,84,0.2)',
          }}>
            {result.win
              ? <TrendingUp className="w-7 h-7" strokeWidth={2.5} style={{ color: C.up }} />
              : <TrendingDown className="w-7 h-7" strokeWidth={2.5} style={{ color: C.down }} />}
            <div>
              <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: result.win ? C.up : C.down }}>
                {result.win ? 'PROFIT' : 'LOSS'}
              </p>
              <p className="text-2xl font-black tabular-nums" style={{ color: result.win ? C.up : C.down }}>
                {result.amt >= 0 ? '+' : ''}₹{Math.abs(result.amt).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
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
          balance={isDemo ? balance : realBalance}
          accountMode={accountMode}
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
