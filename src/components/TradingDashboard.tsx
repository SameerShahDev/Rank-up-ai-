"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowUp, ArrowDown,
  TrendingUp, TrendingDown, Wallet, ArrowDownToLine,
  Minus, Plus,
} from "lucide-react";
import type { AccountMode } from '../types/account';
import AccountToggle from './AccountToggle';
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

/* ─── Pixel-Perfect Candlestick Chart (TradingView/Binance Grade) ─────── */
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
  symbol: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; idx: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const W = Math.floor(rect.width);
    const H = Math.floor(rect.height);
    if (W === 0 || H === 0) return;

    // High-DPI canvas
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Layout: price chart 75%, volume 18%, padding 7%
    const pad = { top: 8, right: 4, bottom: 4, left: 4 };
    const labelPadR = 56; // for price labels
    const labelPadL = 8;   // for time labels
    const priceTop = pad.top;
    const priceH = (H - pad.top - pad.bottom) * 0.74;
    const volTop = priceTop + priceH + 4;
    const volH = (H - pad.top - pad.bottom) * 0.20;
    const innerLeft = pad.left + labelPadL;
    const innerRight = W - pad.right - labelPadR;
    const innerW = innerRight - innerLeft;

    /* ── Background ───────────────────────────────────────────── */
    ctx.fillStyle = '#161a25';
    ctx.fillRect(0, 0, W, H);

    if (candles.length < 1) return;

    /* ── Determine visible candle window (last N) ──────────────── */
    const MAX_VISIBLE = 60;
    const visible = candles.slice(-MAX_VISIBLE);
    const visibleCount = visible.length;

    /* ── Price range with live price included ─────────────────── */
    const allHighs = visible.map(c => c.high);
    const allLows = visible.map(c => c.low);
    let maxP = Math.max(...allHighs, livePrice);
    let minP = Math.min(...allLows, livePrice);
    const range = maxP - minP || 1;
    const padRange = range * 0.10;
    maxP += padRange;
    minP -= padRange;
    const priceRange = maxP - minP;

    // Round min/max to "nice" numbers (TradingView style)
    const niceStep = (() => {
      const rough = priceRange / 5;
      const mag = Math.pow(10, Math.floor(Math.log10(rough)));
      const norm = rough / mag;
      let step;
      if (norm < 1.5) step = 1;
      else if (norm < 3) step = 2;
      else if (norm < 7) step = 5;
      else step = 10;
      return step * mag;
    })();
    const niceMax = Math.ceil(maxP / niceStep) * niceStep;
    const niceMin = Math.floor(minP / niceStep) * niceStep;
    const niceRange = niceMax - niceMin;

    // Pixel-snap helper
    const px = (v: number) => Math.round(v) + 0.5; // +0.5 for crisp 1px lines

    const toY = (p: number) => priceTop + ((niceMax - p) / niceRange) * priceH;
    const slot = innerW / visibleCount;
    const barW = Math.max(2, Math.min(14, Math.floor(slot * 0.75)));
    const xFor = (i: number) => innerLeft + (i + 0.5) * slot;

    /* ── Color palette ────────────────────────────────────────── */
    const BULL = '#0ecb81';
    const BEAR = '#f6465d';
    const GRID = 'rgba(43, 49, 57, 0.5)';
    const GRID_STRONG = 'rgba(43, 49, 57, 0.8)';
    const TEXT = 'rgba(140, 156, 178, 0.7)';
    const TEXT_DIM = 'rgba(120, 135, 155, 0.45)';

    /* ── Horizontal price grid (5 lines) ──────────────────────── */
    ctx.font = '10px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = px(priceTop + (priceH * i) / gridLines);
      const v = niceMax - (niceRange * i) / gridLines;
      // Top/bottom lines slightly stronger
      ctx.strokeStyle = (i === 0 || i === gridLines) ? GRID_STRONG : GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(innerLeft, y);
      ctx.lineTo(innerRight, y);
      ctx.stroke();
      // Price label
      const label = formatPrice(v);
      ctx.fillStyle = TEXT;
      ctx.fillText(label, innerRight + 6, y);
    }

    /* ── Vertical time grid (sparse) ───────────────────────────── */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const vStep = Math.max(1, Math.floor(visibleCount / 6));
    for (let i = 0; i <= visibleCount; i += vStep) {
      const x = px(xFor(i) - slot / 2);
      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, priceTop);
      ctx.lineTo(x, priceTop + priceH);
      ctx.stroke();
      // Time label
      if (i < visibleCount) {
        const d = new Date(visible[i].time);
        const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        ctx.fillStyle = TEXT;
        ctx.fillText(t, xFor(i), H - 4);
      }
    }

    /* ── Volume grid line ─────────────────────────────────────── */
    ctx.strokeStyle = GRID_STRONG;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerLeft, px(volTop + volH));
    ctx.lineTo(innerRight, px(volTop + volH));
    ctx.stroke();

    /* ── Moving averages & Volume (Removed) ───────────────────── */

    /* ── Candles — pixel-snapped crisp rendering ──────────────── */
    for (let i = 0; i < visible.length; i++) {
      const c = visible[i];
      const x = xFor(i);
      const isUp = c.close >= c.open;
      const yOpen = toY(c.open);
      const yClose = toY(c.close);
      const yHigh = toY(c.high);
      const yLow = toY(c.low);
      const bodyTop = Math.min(yOpen, yClose);
      const bodyBot = Math.max(yOpen, yClose);
      const bodyH = Math.max(1, bodyBot - bodyTop);
      const left = Math.floor(x - barW / 2);

      // Wick — 2px crisp vertical line
      const wickX = px(x);
      ctx.strokeStyle = isUp ? BULL : BEAR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wickX, yHigh);
      ctx.lineTo(wickX, yLow);
      ctx.stroke();

      // Body — solid filled rectangle (no anti-alias blur)
      ctx.fillStyle = isUp ? BULL : BEAR;
      ctx.fillRect(left, Math.floor(bodyTop), barW, Math.floor(bodyH));
    }

    /* ── Last price indicator (current candle) ────────────────── */
    const lastCandle = visible[visible.length - 1];
    const lastY = toY(livePrice);
    const isLiveUp = livePrice >= lastCandle.open;
    const lineColor = isLiveUp ? BULL : BEAR;

    // Dashed price line
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(innerLeft, px(lastY));
    ctx.lineTo(innerRight, px(lastY));
    ctx.stroke();
    ctx.setLineDash([]);

    // Price label on right (pill shape)
    // Extra decimals for live price look
    const priceLabel = formatPrice(livePrice) + (livePrice % 1 === 0 ? '.0000000' : '000').slice(0, 7 - (livePrice.toString().split('.')[1]?.length || 0));
    ctx.font = '11px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    const plW = Math.round(ctx.measureText(priceLabel).width) + 16;
    const plH = 22;
    const plX = innerRight + 1;
    const plY = Math.round(lastY - plH / 2);
    
    ctx.fillStyle = 'rgba(30, 35, 45, 0.9)'; // Dark pill matching image
    ctx.beginPath();
    ctx.roundRect(plX, plY, plW, plH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 110, 120, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(plX, plY, plW, plH);

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(priceLabel, plX + plW / 2, lastY);

    // Countdown semi-circle above the label
    const arcX = plX + plW / 2;
    const arcY = plY - 14;
    ctx.beginPath();
    ctx.arc(arcX, arcY, 10, -Math.PI / 2, Math.PI * 0.7, false);
    ctx.strokeStyle = 'rgba(200, 200, 210, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(200, 200, 210, 0.8)';
    ctx.font = '9px ui-monospace, "SF Mono", monospace';
    ctx.fillText(':5', arcX + 2, arcY);

    /* ── Active trade entry lines ─────────────────────────────── */
    activeTrades.forEach(trade => {
      const y = toY(trade.entryPrice);
      const tradeColor = trade.type === 'UP' ? BULL : BEAR;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = tradeColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(innerLeft, px(y));
      ctx.lineTo(innerRight, px(y));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Entry price tag on left
      const entryLabel = formatPrice(trade.entryPrice);
      ctx.font = 'bold 9px ui-monospace, "SF Mono", monospace';
      const tagW = Math.round(ctx.measureText(entryLabel).width) + 8;
      ctx.fillStyle = tradeColor;
      ctx.fillRect(innerLeft, Math.round(y) - 8, tagW, 16);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(entryLabel, innerLeft + 4, y);
    });

    /* ── Time remaining arc (top-left) ────────────────────────── */
    if (primaryTrade && primaryTrade.timeLeft > 0) {
      const progress = 1 - (primaryTrade.timeLeft / primaryTrade.duration);
      const arcX = innerLeft + 18;
      const arcY = priceTop + 18;
      const arcR = 14;
      const isUp = primaryTrade.type === 'UP';
      const arcColor = isUp ? BULL : BEAR;

      // Background
      ctx.beginPath();
      ctx.arc(arcX, arcY, arcR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 14, 23, 0.95)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(80, 95, 120, 0.3)';
      ctx.lineWidth = 1.5;
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
      ctx.font = 'bold 10px ui-monospace, "SF Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${primaryTrade.timeLeft}s`, arcX, arcY);
    }

    /* ── Crosshair on hover ───────────────────────────────────── */
    if (hover) {
      const cx = hover.x;
      const cy = hover.y;
      const ci = hover.idx;
      if (ci >= 0 && ci < visible.length && cx >= innerLeft && cx <= innerRight) {
        // Vertical line
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(140, 156, 178, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px(cx), priceTop);
        ctx.lineTo(px(cx), priceTop + priceH);
        ctx.stroke();
        // Horizontal line
        if (cy >= priceTop && cy <= priceTop + priceH) {
          ctx.beginPath();
          ctx.moveTo(innerLeft, px(cy));
          ctx.lineTo(innerRight, px(cy));
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // Highlight candle
        if (ci >= 0 && ci < visible.length) {
          const c = visible[ci];
          const isUp = c.close >= c.open;
          const color = isUp ? BULL : BEAR;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(px(xFor(ci) - barW / 2) - 0.5, px(toY(c.high)) - 0.5, barW + 1, px(toY(c.low)) - px(toY(c.high)) + 1);
        }

        // OHLC tooltip
        if (ci >= 0 && ci < visible.length) {
          const c = visible[ci];
          const isUp = c.close >= c.open;
          const d = new Date(c.time);
          const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          const lines = [
            time,
            `O ${formatPrice(c.open)}`,
            `H ${formatPrice(c.high)}`,
            `L ${formatPrice(c.low)}`,
            `C ${formatPrice(c.close)}`,
            `V ${formatVol(c.volume || 0)}`,
          ];
          ctx.font = '10px ui-monospace, "SF Mono", monospace';
          const w = 70;
          const lh = 14;
          const th = lines.length * lh + 8;
          let tx = cx + 8;
          let ty = priceTop + 8;
          if (tx + w > innerRight) tx = cx - w - 8;
          if (ty + th > priceTop + priceH) ty = priceTop + priceH - th - 4;

          // Tooltip background
          ctx.fillStyle = 'rgba(10, 14, 23, 0.95)';
          ctx.strokeStyle = isUp ? BULL : BEAR;
          ctx.lineWidth = 1;
          ctx.fillRect(tx, ty, w, th);
          ctx.strokeRect(px(tx), px(ty), w, th);

          // Tooltip text
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          lines.forEach((line, idx) => {
            if (idx === 0) {
              ctx.fillStyle = TEXT;
            } else if (idx === 2) {
              ctx.fillStyle = BULL;
            } else if (idx === 3) {
              ctx.fillStyle = BEAR;
            } else {
              ctx.fillStyle = '#cbd5e1';
            }
            ctx.fillText(line, tx + 6, ty + 4 + idx * lh);
          });
        }

        // Price label on right for crosshair Y
        if (cy >= priceTop && cy <= priceTop + priceH) {
          // Convert cy back to price
          const v = niceMax - ((cy - priceTop) / priceH) * niceRange;
          const label = formatPrice(v);
          ctx.font = 'bold 10px ui-monospace, "SF Mono", monospace';
          const lw = Math.round(ctx.measureText(label).width) + 10;
          ctx.fillStyle = 'rgba(56, 70, 90, 0.9)';
          ctx.fillRect(innerRight + 1, Math.round(cy) - 9, lw, 18);
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, innerRight + 6, cy);
        }
      }
    }

    /* ── Vol label ────────────────────────────────────────────── */
    ctx.fillStyle = TEXT_DIM;
    ctx.font = '9px ui-monospace, "SF Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('VOL', innerLeft + 4, volTop + 2);
  }, [candles, livePrice, activeTrades, primaryTrade, hover]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || candles.length === 0) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const labelPadL = 8;
    const labelPadR = 56;
    const innerLeft = 4 + labelPadL;
    const innerRight = rect.width - 4 - labelPadR;
    const innerW = innerRight - innerLeft;

    const MAX_VISIBLE = 60;
    const visible = candles.slice(-MAX_VISIBLE);
    const slot = innerW / visible.length;
    const idx = Math.floor((x - innerLeft) / slot);
    if (idx >= 0 && idx < visible.length) {
      setHover({ x, y, idx });
    } else {
      setHover(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
};

/* ─── Number formatters ───────────────────────────────────────────────── */
function formatPrice(v: number): string {
  if (v >= 1000000) return v.toFixed(0);
  if (v >= 10000) return v.toFixed(0);
  if (v >= 1000) return v.toFixed(1);
  if (v >= 100) return v.toFixed(2);
  if (v >= 1) return v.toFixed(3);
  return v.toFixed(4);
}
function formatVol(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toFixed(0);
}

/* ─── Colors ────────────────────────────────────────────────────────────── */
const C = {
  bg: '#0a0e17',
  up: '#26a69a',
  down: '#ef5354',
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
        <CandlestickChart
          candles={candles}
          livePrice={price}
          activeTrades={activeTrades}
          primaryTrade={primaryTrade}
          symbol={asset.id}
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
