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

/* ─── Professional Candlestick Chart ─────────────────────────────────── */
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
    const pad = { top: 16, right: 62, bottom: 28, left: 10 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    /* ── Background ────────────────────────────────────────────── */
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#111827');
    bgGrad.addColorStop(0.5, '#0f1420');
    bgGrad.addColorStop(1, '#0b0f1a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    if (candles.length < 1) return;

    /* ── Price range ──────────────────────────────────────────── */
    const allHighs = candles.map(c => c.high);
    const allLows = candles.map(c => c.low);
    const maxP = Math.max(...allHighs, livePrice);
    const minP = Math.min(...allLows, livePrice);
    const range = maxP - minP || 1;
    const padRange = range * 0.12;
    const adjMax = maxP + padRange;
    const adjMin = minP - padRange;
    const adjRange = adjMax - adjMin;

    const toY = (p: number) => pad.top + ((adjMax - p) / adjRange) * plotH;
    const barW = Math.max(2.5, Math.min(8, (plotW / candles.length) * 0.5));
    const gap = plotW / candles.length;

    /* ── Grid — professional dotted style ──────────────────────── */
    const gridCount = 5;
    for (let i = 0; i <= gridCount; i++) {
      const y = pad.top + (plotH * i) / gridCount;
      ctx.strokeStyle = 'rgba(148,163,184,0.06)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([1, 3]);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const vStep = Math.max(1, Math.floor(candles.length / 6));
    for (let i = 0; i < candles.length; i += vStep) {
      const x = pad.left + (i + 0.5) * gap;
      ctx.strokeStyle = 'rgba(148,163,184,0.04)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([1, 4]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    /* ── Volume bars ───────────────────────────────────────────── */
    const maxVol = Math.max(...candles.map(c => c.volume || 0), 1);
    const volH = plotH * 0.12;
    const volTop = pad.top + plotH - volH;
    candles.forEach((c, i) => {
      const x = pad.left + (i + 0.5) * gap;
      const isUp = c.close >= c.open;
      const vH = ((c.volume || 0) / maxVol) * volH;
      const volColor = isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
      ctx.fillStyle = volColor;
      ctx.fillRect(x - barW / 2, volTop + volH - vH, barW, vH);
    });

    /* ── Moving averages ───────────────────────────────────────── */
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

    const drawMA = (period: number, color: string, alpha: number) => {
      const ma = calcMA(period);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
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
      ctx.globalAlpha = 1;
    };

    drawMA(7, '#f59e0b', 0.5);
    drawMA(25, '#8b5cf6', 0.35);

    /* ── Candles — anti-aliased with gradient fills ─────────────── */
    candles.forEach((c, i) => {
      const x = pad.left + (i + 0.5) * gap;
      const isUp = c.close >= c.open;
      const bodyTop = toY(Math.max(c.open, c.close));
      const bodyBot = toY(Math.min(c.open, c.close));
      const bodyH = Math.max(1, bodyBot - bodyTop);

      // Wick
      const wickColor = isUp ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)';
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, toY(c.high));
      ctx.lineTo(x, toY(c.low));
      ctx.stroke();

      // Body with gradient
      const bodyGrad = ctx.createLinearGradient(0, bodyTop, 0, bodyBot);
      if (isUp) {
        bodyGrad.addColorStop(0, '#22c55e');
        bodyGrad.addColorStop(1, '#16a34a');
      } else {
        bodyGrad.addColorStop(0, '#ef4444');
        bodyGrad.addColorStop(1, '#dc2626');
      }
      ctx.fillStyle = bodyGrad;

      // Rounded body
      const r = Math.min(1.5, barW / 4);
      ctx.beginPath();
      ctx.moveTo(x - barW / 2 + r, bodyTop);
      ctx.lineTo(x + barW / 2 - r, bodyTop);
      ctx.quadraticCurveTo(x + barW / 2, bodyTop, x + barW / 2, bodyTop + r);
      ctx.lineTo(x + barW / 2, bodyBot - r);
      ctx.quadraticCurveTo(x + barW / 2, bodyBot, x + barW / 2 - r, bodyBot);
      ctx.lineTo(x - barW / 2 + r, bodyBot);
      ctx.quadraticCurveTo(x - barW / 2, bodyBot, x - barW / 2, bodyBot - r);
      ctx.lineTo(x - barW / 2, bodyTop + r);
      ctx.quadraticCurveTo(x - barW / 2, bodyTop, x - barW / 2 + r, bodyTop);
      ctx.closePath();
      ctx.fill();

      // Glow on larger candles
      if (bodyH > 4) {
        ctx.shadowColor = isUp ? '#22c55e' : '#ef4444';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    /* ── Area fill under live price ─────────────────────────────── */
    const liveY = toY(livePrice);
    const isLiveUp = candles.length > 0 && livePrice >= candles[candles.length - 1].open;
    const lineColor = isLiveUp ? '#22c55e' : '#ef4444';

    // Area gradient
    const areaGrad = ctx.createLinearGradient(0, liveY - 40, 0, liveY);
    areaGrad.addColorStop(0, isLiveUp ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)');
    areaGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.moveTo(pad.left, liveY);
    for (let i = 0; i < candles.length; i++) {
      const x = pad.left + (i + 0.5) * gap;
      const y = toY(candles[i].close);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(pad.left + (candles.length - 0.5) * gap, liveY);
    ctx.lineTo(pad.left, liveY);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    /* ── Live price line — crisp dashed ────────────────────────── */
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, liveY);
    ctx.lineTo(W - pad.right, liveY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

    // Animated dot at the end
    ctx.beginPath();
    ctx.arc(W - pad.right + 2, liveY, 3, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    /* ── Live price label — premium pill ────────────────────────── */
    const priceLabel = livePrice >= 1000 ? livePrice.toFixed(0) : livePrice.toFixed(2);
    ctx.font = 'bold 10px -apple-system, "SF Pro Text", system-ui, sans-serif';
    const plW = ctx.measureText(priceLabel).width + 18;
    const plH = 22;
    const plX = W - pad.right - 1;
    const plY = liveY - plH / 2;
    const plR = 6;

    // Pill background with gradient
    const pillGrad = ctx.createLinearGradient(plX, plY, plX + plW, plY);
    pillGrad.addColorStop(0, lineColor);
    pillGrad.addColorStop(1, isLiveUp ? '#16a34a' : '#dc2626');

    ctx.beginPath();
    ctx.moveTo(plX + plR, plY);
    ctx.lineTo(plX + plW - plR, plY);
    ctx.quadraticCurveTo(plX + plW, plY, plX + plW, plY + plR);
    ctx.lineTo(plX + plW, plY + plH - plR);
    ctx.quadraticCurveTo(plX + plW, plY + plH, plX + plW - plR, plY + plH);
    ctx.lineTo(plX + plR, plY + plH);
    ctx.quadraticCurveTo(plX, plY + plH, plX, plY + plH - plR);
    ctx.lineTo(plX, plY + plR);
    ctx.quadraticCurveTo(plX, plY, plX + plR, plY);
    ctx.closePath();
    ctx.fillStyle = pillGrad;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(priceLabel, plX + 9, liveY + 3.5);

    /* ── Price axis labels ──────────────────────────────────────── */
    ctx.font = '9px -apple-system, "SF Mono", monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i <= gridCount; i++) {
      const v = adjMax - (adjRange * i) / gridCount;
      const y = pad.top + (plotH * i) / gridCount;
      const label = v >= 100000 ? `${(v / 1000).toFixed(1)}k` : v >= 1000 ? v.toFixed(0) : v.toFixed(2);
      ctx.fillStyle = 'rgba(148,163,184,0.45)';
      ctx.fillText(label, W - pad.right + 8, y + 3);
    }

    /* ── Time axis labels ───────────────────────────────────────── */
    ctx.textAlign = 'center';
    ctx.font = '9px -apple-system, "SF Mono", monospace';
    const timeStep = Math.max(1, Math.floor(candles.length / 6));
    for (let i = 0; i < candles.length; i += timeStep) {
      const x = pad.left + (i + 0.5) * gap;
      const d = new Date(candles[i].time);
      const t = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      ctx.fillStyle = 'rgba(148,163,184,0.35)';
      ctx.fillText(t, x, H - 10);
    }

    /* ── Active trade entry lines ───────────────────────────────── */
    activeTrades.forEach(trade => {
      const y = toY(trade.entryPrice);
      const tradeColor = trade.type === 'UP' ? '#22c55e' : '#ef4444';
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = tradeColor;
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Small entry label
      const entryLabel = trade.entryPrice >= 1000 ? trade.entryPrice.toFixed(0) : trade.entryPrice.toFixed(2);
      ctx.font = '8px -apple-system, monospace';
      ctx.fillStyle = tradeColor;
      ctx.globalAlpha = 0.5;
      ctx.textAlign = 'right';
      ctx.fillText(`ENTRY ${entryLabel}`, W - pad.right - 4, y - 5);
      ctx.globalAlpha = 1;
    });

    /* ── Time remaining arc ─────────────────────────────────────── */
    if (primaryTrade && primaryTrade.timeLeft > 0) {
      const progress = 1 - (primaryTrade.timeLeft / primaryTrade.duration);
      const arcX = pad.left + 22;
      const arcY = pad.top + 20;
      const arcR = 16;
      const isUp = primaryTrade.type === 'UP';
      const arcColor = isUp ? '#22c55e' : '#ef4444';

      // Background track
      ctx.beginPath();
      ctx.arc(arcX, arcY, arcR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(148,163,184,0.08)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Progress arc
      ctx.shadowColor = arcColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(arcX, arcY, arcR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = arcColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.shadowBlur = 0;

      // Time text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px -apple-system, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${primaryTrade.timeLeft}s`, arcX, arcY);
      ctx.textBaseline = 'alphabetic';

      // Vertical current candle line
      const currentX = pad.left + (candles.length - 0.5) * gap;
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(239,68,68,0.2)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(currentX, pad.top);
      ctx.lineTo(currentX, pad.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* ── Top-left price watermark ───────────────────────────────── */
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const change = ((lastCandle.close - lastCandle.open) / lastCandle.open * 100);
      ctx.font = 'bold 13px -apple-system, "SF Pro Text", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = change >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)';
      const priceStr = livePrice >= 1000 ? livePrice.toFixed(0) : livePrice.toFixed(2);
      const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
      ctx.fillText(`${priceStr}  ${changeStr}`, pad.left + 4, pad.top + 18);
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
  bg: '#0f1420',
  up: '#22c55e',
  down: '#ef4444',
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

/* ─── Majority Opinion Bar ─────────────────────────────────────────────── */
const MajorityOpinion = () => {
  const upPct = 40 + Math.floor(Math.random() * 20);
  const downPct = 100 - upPct;
  return (
    <div className="px-1 py-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Market Sentiment</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.03]">
        <div className="rounded-l-full transition-all duration-500" style={{ width: `${upPct}%`, background: 'linear-gradient(90deg, #22c55e, #16a34a)' }} />
        <div className="rounded-r-full transition-all duration-500" style={{ width: `${downPct}%`, background: 'linear-gradient(90deg, #ef4444, #dc2626)' }} />
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
  const [toast] = useState<string | null>(null);
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
    <div className="fixed inset-0 z-40 flex flex-col text-white overflow-hidden" style={{ background: '#0b0f1a' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5" style={{ background: 'linear-gradient(180deg, #111827 0%, #0f1520 100%)', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
        <button
          type="button"
          onClick={() => setShowDeposit(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}
        >
          <Wallet className="w-3.5 h-3.5" />
          Deposit
        </button>
        <div className="flex flex-col items-center">
          <AccountToggle mode={accountMode} onChange={setAccountMode} compact />
          <span className={`text-lg font-black tabular-nums mt-0.5 tracking-tight ${isDemo ? 'text-amber-400' : 'text-white'}`}>
            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowWithdraw(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Withdraw
        </button>
      </header>

      {/* ── Asset Tabs ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 overflow-x-auto" style={{ background: '#0f1520', borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
        {ASSETS.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAsset(a)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              asset.id === a.id
                ? 'text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            style={asset.id === a.id ? { background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.1)' } : { border: '1px solid transparent' }}
          >
            <span style={{ color: a.color }}>{a.icon}</span>
            <span>{a.name}</span>
            <span className={`text-[10px] font-bold ${asset.id === a.id ? 'text-amber-400' : 'text-slate-600'}`}>{a.yield}%</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl shrink-0" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.6)' }} />
          <span className="text-xs font-mono font-bold tabular-nums text-blue-400">
            ₹{price >= 1000 ? price.toFixed(0) : price.toFixed(2)}
          </span>
        </div>
      </div>

      {/* ── Chart ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative" style={{ background: 'linear-gradient(180deg, #111827 0%, #0b0f1a 100%)' }}>
        <CandlestickChart
          candles={candles}
          livePrice={price}
          activeTrades={activeTrades}
          primaryTrade={primaryTrade}
        />

        {/* Asset info overlay — top left */}
        <div className="absolute top-3 left-3 pointer-events-none">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(15,20,32,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(148,163,184,0.06)' }}>
            <span className="text-lg" style={{ color: asset.color }}>{asset.icon}</span>
            <div>
              <p className="text-[11px] font-bold text-white tracking-wide">{asset.name}</p>
              <p className="text-[10px] font-mono font-bold tabular-nums" style={{ color: isPriceUp ? '#22c55e' : '#ef4444' }}>
                {isPriceUp ? '+' : ''}{priceChange.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* OHLCV overlay — top right */}
        {candles.length > 0 && (
          <div className="absolute top-3 right-3 pointer-events-none">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(15,20,32,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(148,163,184,0.06)' }}>
              <OHLCDisplay candle={candles[candles.length - 1]} />
            </div>
          </div>
        )}

        {/* MA Legend — bottom left */}
        <div className="absolute bottom-8 left-3 pointer-events-none flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ background: '#f59e0b' }} />
            <span className="text-[9px] font-mono text-amber-500/60">MA7</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ background: '#8b5cf6' }} />
            <span className="text-[9px] font-mono text-violet-500/60">MA25</span>
          </div>
        </div>
      </div>

      {/* ── Controls ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-3 pb-[max(10px,env(safe-area-inset-bottom))]" style={{ background: 'linear-gradient(180deg, #111827 0%, #0f1520 100%)', borderTop: '1px solid rgba(148,163,184,0.06)' }}>

        {/* Active trades */}
        {activeTrades.length > 0 && (
          <div className="mb-2.5 space-y-1.5 max-h-20 overflow-y-auto">
            {activeTrades.map(t => {
              const isUp = t.type === 'UP';
              const pnl = isUp
                ? ((price - t.entryPrice) / t.entryPrice) * t.amount
                : ((t.entryPrice - price) / t.entryPrice) * t.amount;
              const isProfit = pnl >= 0;
              return (
                <div key={t.id} className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs" style={{
                  background: isProfit ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                  border: `1px solid ${isProfit ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}`,
                }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black" style={{
                    background: isProfit ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: isProfit ? C.up : C.down,
                  }}>
                    {isProfit ? '▲' : '▼'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-[11px]">₹{t.amount} · {t.type}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{
                        background: isProfit ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                        color: isProfit ? C.up : C.down,
                      }}>
                        {isProfit ? 'PROFIT' : 'LOSS'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] font-mono text-slate-500">{formatTime(t.timeLeft)} left</span>
                      <span className="text-xs font-black tabular-nums" style={{ color: isProfit ? C.up : C.down }}>
                        {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Amount & Time — premium controls */}
        <div className="flex gap-3 mb-2.5">
          <div className="flex-1">
            <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block px-1">Amount</label>
            <div className="flex items-center h-11 rounded-xl overflow-hidden" style={{ background: '#1a2332', border: '1px solid rgba(148,163,184,0.08)' }}>
              <button type="button" onClick={() => setAmount(a => Math.max(100, a - 100))}
                className="w-10 h-full flex items-center justify-center transition-colors active:bg-white/5">
                <Minus className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <div className="flex-1 flex items-center justify-center">
                <span className="text-sm font-black text-white tabular-nums">₹{amount}</span>
              </div>
              <button type="button" onClick={() => setAmount(a => a + 100)}
                className="w-10 h-full flex items-center justify-center transition-colors active:bg-white/5">
                <Plus className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block px-1">Duration</label>
            <div className="flex items-center h-11 rounded-xl overflow-hidden" style={{ background: '#1a2332', border: '1px solid rgba(148,163,184,0.08)' }}>
              <button type="button" onClick={() => setDuration(d => Math.max(10, d - 10))}
                className="w-10 h-full flex items-center justify-center transition-colors active:bg-white/5">
                <Minus className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <div className="flex-1 flex items-center justify-center">
                <span className="text-sm font-black text-white tabular-nums">{formatTime(duration)}</span>
              </div>
              <button type="button" onClick={() => setDuration(d => d + 10)}
                className="w-10 h-full flex items-center justify-center transition-colors active:bg-white/5">
                <Plus className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Earnings */}
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Potential Earnings</span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-emerald-400">+{asset.yield}%</span>
            <span className="text-sm font-black text-white tabular-nums">₹{payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.00</span>
          </div>
        </div>

        {/* Sentiment */}
        <MajorityOpinion />

        {/* Trade buttons — premium */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button
            type="button"
            onClick={() => handleTrade('UP')}
            disabled={balance < amount}
            className="h-13 rounded-2xl flex items-center justify-center gap-2 font-black text-sm tracking-wide active:scale-[0.97] transition-all disabled:opacity-30"
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              boxShadow: '0 4px 20px rgba(34,197,94,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              height: '52px',
            }}
          >
            <ArrowUp className="w-5 h-5" strokeWidth={3} />
            <span>UP</span>
          </button>
          <button
            type="button"
            onClick={() => handleTrade('DOWN')}
            disabled={balance < amount}
            className="h-13 rounded-2xl flex items-center justify-center gap-2 font-black text-sm tracking-wide active:scale-[0.97] transition-all disabled:opacity-30"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              boxShadow: '0 4px 20px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              height: '52px',
            }}
          >
            <ArrowDown className="w-5 h-5" strokeWidth={3} />
            <span>DOWN</span>
          </button>
        </div>
      </div>

      {/* ── Result Popup ───────────────────────────────────────────── */}
      {result && (
        <div className="absolute inset-x-0 top-16 z-[100] flex justify-center pointer-events-none animate-[slideUp_0.3s_ease-out]">
          <div className="flex items-center gap-5 px-8 py-5 rounded-2xl backdrop-blur-xl" style={{
            background: result.win ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${result.win ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            boxShadow: result.win
              ? '0 0 60px rgba(34,197,94,0.15), 0 8px 32px rgba(0,0,0,0.5)'
              : '0 0 60px rgba(239,68,68,0.15), 0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{
              background: result.win ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            }}>
              {result.win
                ? <TrendingUp className="w-8 h-8" strokeWidth={2.5} style={{ color: C.up }} />
                : <TrendingDown className="w-8 h-8" strokeWidth={2.5} style={{ color: C.down }} />}
            </div>
            <div>
              <p className="text-[11px] font-black tracking-widest uppercase" style={{ color: result.win ? C.up : C.down }}>
                {result.win ? 'PROFIT' : 'LOSS'}
              </p>
              <p className="text-3xl font-black tabular-nums mt-1" style={{ color: result.win ? C.up : C.down }}>
                {result.amt >= 0 ? '+' : ''}₹{Math.abs(result.amt).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ──────────────────────────────────────────────────── */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[120] px-4 py-2 rounded-xl" style={{ background: '#1a2332', border: '1px solid rgba(251,191,36,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <p className="text-xs font-bold text-amber-400">{toast}</p>
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

/* ─── OHLC Display Component ───────────────────────────────────────────── */
const OHLCDisplay = ({ candle }: { candle: Candle }) => {
  const fmt = (v: number) => v >= 1000 ? v.toFixed(0) : v.toFixed(2);
  return (
    <div className="flex items-center gap-2.5 text-[10px] font-mono">
      <span className="text-slate-500">O <span className="text-slate-300">{fmt(candle.open)}</span></span>
      <span className="text-slate-500">H <span style={{ color: '#22c55e' }}>{fmt(candle.high)}</span></span>
      <span className="text-slate-500">L <span style={{ color: '#ef4444' }}>{fmt(candle.low)}</span></span>
      <span className="text-slate-500">C <span className="text-white">{fmt(candle.close)}</span></span>
    </div>
  );
};

export default TradingDashboard;
