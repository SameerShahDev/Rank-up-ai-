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

interface Asset {
  id: string;
  name: string;
  icon: string;
  yield: number;
  basePrice: number;
  color: string;
}

const ASSETS: Asset[] = [
  { id: 'BTC', name: 'Crypto IDX', icon: '₿', yield: 83, basePrice: 64231.40, color: '#f7931a' },
  { id: 'ETH', name: 'Altcoin IDX', icon: 'Ξ', yield: 80, basePrice: 3421.50, color: '#627eea' },
  { id: 'NIFTY', name: 'Asia IDX', icon: 'A', yield: 85, basePrice: 22450.00, color: '#0fb359' },
];

/* ─── Simple Line Chart ────────────────────────────────────────────────── */
const LineChart = ({
  price,
  history,
  activeTrades,
}: {
  price: number;
  history: number[];
  activeTrades: ActiveTrade[];
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
    const pad = { top: 20, right: 60, bottom: 24, left: 8 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    if (history.length < 2) return;

    const min = Math.min(...history) * 0.9999;
    const max = Math.max(...history) * 1.0001;
    const range = max - min || 1;
    const toX = (i: number) => pad.left + (i / (history.length - 1)) * plotW;
    const toY = (v: number) => pad.top + plotH - ((v - min) / range) * plotH;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }

    // Price axis
    ctx.fillStyle = C.muted;
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i <= 4; i++) {
      const v = max - (range * i) / 4;
      const y = pad.top + (plotH * i) / 4;
      ctx.fillText(v.toFixed(2), W - pad.right + 4, y + 3);
    }

    // Time axis
    ctx.textAlign = 'center';
    const timeStep = Math.max(1, Math.floor(history.length / 4));
    for (let i = 0; i < history.length; i += timeStep) {
      const d = new Date(Date.now() - (history.length - 1 - i) * 1500);
      const t = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      ctx.fillText(t, toX(i), H - 4);
    }

    // Gradient fill under line
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    grad.addColorStop(0, 'rgba(11,183,131,0.15)');
    grad.addColorStop(1, 'rgba(11,183,131,0.0)');
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(history[0]));
    for (let i = 1; i < history.length; i++) {
      ctx.lineTo(toX(i), toY(history[i]));
    }
    ctx.lineTo(toX(history.length - 1), pad.top + plotH);
    ctx.lineTo(toX(0), pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Price line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(history[0]));
    for (let i = 1; i < history.length; i++) {
      ctx.lineTo(toX(i), toY(history[i]));
    }
    ctx.strokeStyle = C.up;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Current price dot
    const lastX = toX(history.length - 1);
    const lastY = toY(history[history.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = C.up;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(11,183,131,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Price label on axis
    ctx.fillStyle = C.up;
    ctx.beginPath();
    ctx.roundRect(W - pad.right - 2, lastY - 10, pad.right + 2, 20, 3);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(price.toFixed(2), W - pad.right + 4, lastY + 3);

    // Entry lines for active trades
    activeTrades.forEach(trade => {
      const y = toY(trade.entryPrice);
      ctx.beginPath();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = trade.type === 'UP' ? C.up : C.down;
      ctx.lineWidth = 1;
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = trade.type === 'UP' ? C.up : C.down;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${trade.type} ₹${trade.amount}`, pad.left + 4, y - 4);
    });

  }, [price, history, activeTrades]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
};

/* ─── Colors ────────────────────────────────────────────────────────────── */
const C = {
  bg: '#0f1118',
  up: '#0bb783',
  down: '#ff4d5c',
  gold: '#f0b90b',
  muted: '#6b7280',
};

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ─── Active Trade Card ────────────────────────────────────────────────── */
const TradeCard = ({ trade, currentPrice }: { trade: ActiveTrade; currentPrice: number }) => {
  const isUp = trade.type === 'UP';
  const pnl = isUp
    ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * trade.amount
    : ((trade.entryPrice - currentPrice) / trade.entryPrice) * trade.amount;
  const progress = ((trade.duration - trade.timeLeft) / trade.duration) * 100;

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${isUp ? 'border-[#0bb783]/20 bg-[#0bb783]/5' : 'border-[#ff4d5c]/20 bg-[#ff4d5c]/5'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isUp ? 'bg-[#0bb783]/15' : 'bg-[#ff4d5c]/15'}`}>
        {isUp
          ? <ArrowUp className="w-4 h-4" style={{ color: C.up }} />
          : <ArrowDown className="w-4 h-4" style={{ color: C.down }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white">{trade.type} · ₹{trade.amount}</span>
          <span className="text-xs font-mono font-bold" style={{ color: pnl >= 0 ? C.up : C.down }}>
            {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(0)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: isUp ? C.up : C.down }} />
          </div>
          <span className="text-[10px] font-mono font-bold text-muted tabular-nums">{formatTime(trade.timeLeft)}</span>
        </div>
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
  const [history, setHistory] = useState<number[]>([]);
  const [result, setResult] = useState<{ win: boolean; amt: number } | null>(null);
  const priceRef = useRef(price);

  useEffect(() => { priceRef.current = price; }, [price]);
  useEffect(() => { setPrice(asset.basePrice); }, [asset]);

  // Live price tick
  useEffect(() => {
    let momentum = 0;
    let ticks = 0;
    const iv = setInterval(() => {
      setPrice(prev => {
        if (ticks <= 0) {
          momentum = (Math.random() - 0.5) * prev * 0.0012;
          ticks = 20 + Math.floor(Math.random() * 40);
        }
        ticks--;
        const vol = prev * 0.0002;
        const noise = (Math.random() * vol * 2) - vol;
        const drift = (asset.basePrice - prev) * 0.0005;
        const next = prev + noise + momentum + drift;
        return next;
      });
    }, 1500);
    return () => clearInterval(iv);
  }, [asset.basePrice]);

  // Price history for chart
  useEffect(() => {
    setHistory(prev => {
      const next = [...prev, price];
      return next.length > 120 ? next.slice(-120) : next;
    });
  }, [price]);

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

  const timeOpts = [10, 20, 30, 60, 120];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0f1118] text-white overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-[#161821] border-b border-[#2a2e39] px-4 py-2.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowDeposit(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#0bb783]/10 border border-[#0bb783]/25 text-[#0bb783] active:scale-95 transition-transform"
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border active:scale-95 transition-transform ${isDemo ? 'border-white/10 text-gray-500' : 'border-[#f0b90b]/25 text-[#f0b90b] bg-[#f0b90b]/10'}`}
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Withdraw
        </button>
      </header>

      {/* ── Asset Tabs ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[#161821] border-b border-[#2a2e39] overflow-x-auto">
        {ASSETS.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAsset(a)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              asset.id === a.id
                ? 'bg-[#2a2e39] text-white border border-white/10'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            <span className="text-base" style={{ color: a.color }}>{a.icon}</span>
            <span>{a.name}</span>
            <span className={`text-xs ${asset.id === a.id ? 'text-[#f0b90b]' : 'text-gray-600'}`}>{a.yield}%</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f0b90b]/10 border border-[#f0b90b]/20 shrink-0">
          <div className="w-2 h-2 rounded-full bg-[#0bb783] animate-pulse" />
          <span className="text-sm font-mono font-black tabular-nums" style={{ color: C.gold }}>
            {price.toFixed(2)}
          </span>
        </div>
      </div>

      {/* ── Chart ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        <LineChart price={price} history={history} activeTrades={activeTrades} />
        {/* Asset name overlay */}
        <div className="absolute top-3 left-3 pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#161821]/80 backdrop-blur border border-[#2a2e39]">
            <span className="text-lg" style={{ color: asset.color }}>{asset.icon}</span>
            <div>
              <p className="text-xs font-bold text-white">{asset.name}</p>
              <p className="text-[10px] font-mono" style={{ color: C.up }}>
                {((price - asset.basePrice) / asset.basePrice * 100).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls ───────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#161821] border-t border-[#2a2e39] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">

        {/* Active trades */}
        {activeTrades.length > 0 && (
          <div className="mb-3 space-y-1.5 max-h-24 overflow-y-auto">
            {activeTrades.map(t => <TradeCard key={t.id} trade={t} currentPrice={price} />)}
          </div>
        )}

        {/* Amount & Time */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Amount</label>
            <div className="flex items-center h-11 bg-[#1e222d] rounded-xl border border-[#2a2e39] overflow-hidden">
              <button type="button" onClick={() => setAmount(a => Math.max(100, a - 100))} className="w-10 h-full flex items-center justify-center hover:bg-white/5 active:bg-white/10 transition-colors">
                <Minus className="w-4 h-4 text-gray-400" />
              </button>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(Math.max(100, Number(e.target.value)))}
                className="flex-1 bg-transparent text-center text-base font-black text-white focus:outline-none tabular-nums"
              />
              <button type="button" onClick={() => setAmount(a => a + 100)} className="w-10 h-full flex items-center justify-center hover:bg-white/5 active:bg-white/10 transition-colors">
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex gap-1.5 mt-1.5">
              {[100, 500, 1000, 5000].map(v => (
                <button key={v} type="button" onClick={() => setAmount(v)} className="flex-1 text-[10px] font-bold py-1 rounded-lg bg-[#1e222d] border border-[#2a2e39] text-gray-400 hover:text-white hover:border-white/10 transition-colors">
                  ₹{v >= 1000 ? `${v / 1000}k` : v}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Duration</label>
            <div className="flex gap-1.5 mb-1.5">
              {timeOpts.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDuration(s)}
                  className={`flex-1 text-[10px] font-bold py-1 rounded-lg transition-colors ${duration === s ? 'bg-[#f0b90b] text-black' : 'bg-[#1e222d] border border-[#2a2e39] text-gray-400 hover:text-white'}`}
                >
                  {s < 60 ? `${s}s` : `${s / 60}m`}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center h-11 bg-[#1e222d] rounded-xl border border-[#2a2e39]">
              <Clock className="w-4 h-4 text-gray-500 mr-2" />
              <span className="text-base font-black tabular-nums text-white">{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Payout info */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#1e222d] border border-[#2a2e39] mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#f0b90b]" />
            <span className="text-[11px] font-bold text-gray-400">Payout</span>
          </div>
          <span className="text-sm font-black text-[#0bb783] tabular-nums">
            +₹{payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({asset.yield}%)
          </span>
        </div>

        {/* Trade buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleTrade('UP')}
            disabled={balance < amount}
            className="h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 font-black active:scale-[0.97] transition-all disabled:opacity-40 bg-[#0bb783] shadow-[0_4px_20px_rgba(11,183,131,0.3)]"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">Higher</span>
              <ArrowUp className="w-5 h-5" strokeWidth={3} />
            </div>
            <span className="text-[10px] font-bold text-white/80">+₹{payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </button>
          <button
            type="button"
            onClick={() => handleTrade('DOWN')}
            disabled={balance < amount}
            className="h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 font-black active:scale-[0.97] transition-all disabled:opacity-40 bg-[#ff4d5c] shadow-[0_4px_20px_rgba(255,77,92,0.3)]"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">Lower</span>
              <ArrowDown className="w-5 h-5" strokeWidth={3} />
            </div>
            <span className="text-[10px] font-bold text-white/80">+₹{payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </button>
        </div>

        {/* Trust bar */}
        <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-[#2a2e39]">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#0bb783]" />
            <span className="text-[9px] font-bold text-gray-600 uppercase">SSL Secured</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[#f0b90b]" />
            <span className="text-[9px] font-bold text-gray-600 uppercase">Live Market</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#627eea]" />
            <span className="text-[9px] font-bold text-gray-600 uppercase">Instant Payout</span>
          </div>
        </div>
      </div>

      {/* ── Result Popup ───────────────────────────────────────────── */}
      {result && (
        <div className="absolute inset-x-0 top-16 z-[100] flex justify-center pointer-events-none animate-[slideUp_0.3s_ease-out]">
          <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl border-2 shadow-2xl ${result.win ? 'bg-[#0bb783]/10 border-[#0bb783]' : 'bg-[#ff4d5c]/10 border-[#ff4d5c]'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${result.win ? 'bg-[#0bb783]/15' : 'bg-[#ff4d5c]/15'}`}>
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
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[120] bg-[#1e222d] border border-[#f0b90b]/40 px-4 py-2 rounded-xl shadow-xl">
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
