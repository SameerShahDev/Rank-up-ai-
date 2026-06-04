"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
import PremiumChart from './trade/PremiumChart';

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

/* ─── Old CandlestickChart removed — using PremiumChart from trade/ ───── */

/* ─── Number formatters (kept for controls area) ─────────────────────── */
function formatPriceDisplay(v: number): string {
  if (v >= 1000000) return v.toFixed(0);
  if (v >= 10000) return v.toFixed(0);
  if (v >= 1000) return v.toFixed(1);
  if (v >= 100) return v.toFixed(2);
  if (v >= 1) return v.toFixed(3);
  return v.toFixed(4);
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
    }, 800);
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

      {/* ── Top bar: symbol + price + 24h stats ──────────────────── */}
      <div className="shrink-0 flex items-center px-3 py-2" style={{ borderBottom: '1px solid rgba(56,70,90,0.3)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base font-black shadow-lg" style={{ background: `${asset.color}18`, color: asset.color, border: `1px solid ${asset.color}30` }}>
            {asset.icon}
          </div>
          <div className="flex flex-col leading-none">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white tracking-tight">{asset.id}/INR</span>
              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>10x</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[9px] font-medium text-slate-500">Bitcoin · Spot</span>
              <span className="text-[9px] text-slate-600">|</span>
              <span className="text-[8px] font-mono text-slate-500">24H <span className="text-slate-400 font-bold">{high24 >= 1000 ? high24.toFixed(0) : high24.toFixed(2)}</span></span>
              <span className="text-[8px] font-mono text-slate-500">L <span className="text-slate-400 font-bold">{low24 >= 1000 ? low24.toFixed(0) : low24.toFixed(2)}</span></span>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-end leading-none gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tabular-nums tracking-tight" style={{ color: isPriceUp ? C.up : C.down }}>
              {price >= 1000 ? price.toFixed(0) : price.toFixed(2)}
            </span>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: isPriceUp ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,84,0.12)' }}>
              {isPriceUp ? <TrendingUp className="w-2.5 h-2.5" style={{ color: C.up }} strokeWidth={3} /> : <TrendingDown className="w-2.5 h-2.5" style={{ color: C.down }} strokeWidth={3} />}
              <span className="text-[9px] font-bold tabular-nums" style={{ color: isPriceUp ? C.up : C.down }}>
                {isPriceUp ? '+' : ''}{priceChangePct.toFixed(2)}%
              </span>
            </div>
          </div>
          <span className="text-[9px] font-medium tabular-nums text-slate-400">
            {isPriceUp ? '+' : ''}₹{Math.abs(priceChange).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* ── Timeframe + Asset selector ──────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-2 py-1.5" style={{ borderBottom: '1px solid rgba(56,70,90,0.2)' }}>
        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTf(t.id)}
              className="px-2.5 py-1 text-[10px] font-bold rounded-md transition-all"
              style={tf === t.id
                ? { background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }
                : { color: '#64748b' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {ASSETS.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAsset(a)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-all"
              style={asset.id === a.id
                ? { background: `${a.color}18`, color: '#fff', border: `1px solid ${a.color}30` }
                : { background: 'rgba(56,70,90,0.15)', color: '#94a3b8', border: '1px solid transparent' }
              }
            >
              <span style={{ color: a.color }}>{a.icon}</span>
              <span>{a.id}</span>
              <span className="text-[8px] ml-0.5" style={{ color: '#fbbf24' }}>{a.yield}%</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Premium Chart ─────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative" style={{ background: '#080c14' }}>
        <PremiumChart
          candles={candles}
          livePrice={price}
          activeTrades={activeTrades}
          primaryTrade={primaryTrade}
          symbol={asset.id}
          assetColor={asset.color}
        />
      </div>

      {/* ── Bottom controls ─────────────────────────────────────── */}
      <div className="shrink-0 px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]" style={{ background: '#0a0e17' }}>

        {/* Active trades */}
        {activeTrades.length > 0 && (
          <div className="mb-2 space-y-1 max-h-[60px] overflow-y-auto">
            <div className="text-[8px] font-bold uppercase tracking-widest text-slate-600 px-1 mb-0.5">Active Positions</div>
            {activeTrades.map(t => {
              const isUp = t.type === 'UP';
              const pnl = isUp
                ? ((price - t.entryPrice) / t.entryPrice) * t.amount
                : ((t.entryPrice - price) / t.entryPrice) * t.amount;
              const isProfit = pnl >= 0;
              return (
                <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px]" style={{
                  background: isProfit ? 'rgba(38,166,154,0.06)' : 'rgba(239,83,84,0.06)',
                  border: `1px solid ${isProfit ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,84,0.15)'}`,
                }}>
                  <div className="w-5 h-5 rounded flex items-center justify-center text-[9px]" style={{ background: isProfit ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,84,0.15)' }}>
                    <span className="font-black" style={{ color: isProfit ? C.up : C.down }}>{isProfit ? '▲' : '▼'}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="font-bold text-white">{t.type}</span>
                    <span className="text-slate-400">₹{t.amount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-500">{formatTime(t.timeLeft)}</span>
                    <span className="font-black tabular-nums text-[11px]" style={{ color: isProfit ? C.up : C.down }}>
                      {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Amount & Duration labels */}
        <div className="flex gap-1.5 mb-1">
          <div className="flex-1 text-[8px] font-bold uppercase tracking-widest text-slate-600 px-1">Amount</div>
          <div className="flex-1 text-[8px] font-bold uppercase tracking-widest text-slate-600 px-1">Duration</div>
        </div>
        <div className="flex gap-1.5 mb-1">
          <div className="flex-1 flex items-center h-9 rounded-lg overflow-hidden" style={{ background: C.surface, border: '1px solid rgba(56,70,90,0.4)' }}>
            <button type="button" onClick={() => setAmount(a => Math.max(100, a - 100))}
              className="w-8 h-full flex items-center justify-center hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors">
              <Minus className="w-3 h-3 text-slate-500" />
            </button>
            <div className="flex-1 flex flex-col items-center justify-center leading-none">
              <span className="text-[13px] font-black text-white tabular-nums">₹{amount}</span>
              <span className="text-[7px] font-mono text-slate-600 mt-0.5">{asset.id}</span>
            </div>
            <button type="button" onClick={() => setAmount(a => a + 100)}
              className="w-8 h-full flex items-center justify-center hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors">
              <Plus className="w-3 h-3 text-slate-500" />
            </button>
          </div>
          <div className="flex-1 flex items-center h-9 rounded-lg overflow-hidden" style={{ background: C.surface, border: '1px solid rgba(56,70,90,0.4)' }}>
            <button type="button" onClick={() => setDuration(d => Math.max(10, d - 10))}
              className="w-8 h-full flex items-center justify-center hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors">
              <Minus className="w-3 h-3 text-slate-500" />
            </button>
            <div className="flex-1 flex flex-col items-center justify-center leading-none">
              <span className="text-[13px] font-black text-white tabular-nums">{formatTime(duration)}</span>
              <span className="text-[7px] font-mono text-slate-600 mt-0.5">min:sec</span>
            </div>
            <button type="button" onClick={() => setDuration(d => d + 10)}
              className="w-8 h-full flex items-center justify-center hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors">
              <Plus className="w-3 h-3 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Sentiment */}
        <SentimentBar upPct={sentiment} />

        {/* Trade buttons */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            type="button"
            onClick={() => handleTrade('UP')}
            disabled={balance < amount}
            className="h-11 rounded-xl flex items-center justify-center gap-1.5 font-black text-sm active:scale-[0.97] transition-all disabled:opacity-30 relative overflow-hidden group"
            style={{ background: `linear-gradient(135deg, #1b8a5e, ${C.up})`, color: '#fff', boxShadow: '0 4px 15px rgba(38,166,154,0.25)' }}
          >
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.06] transition-all" />
            <ArrowUp className="w-4 h-4" strokeWidth={3} />
            <span>UP · {asset.yield}%</span>
          </button>
          <button
            type="button"
            onClick={() => handleTrade('DOWN')}
            disabled={balance < amount}
            className="h-11 rounded-xl flex items-center justify-center gap-1.5 font-black text-sm active:scale-[0.97] transition-all disabled:opacity-30 relative overflow-hidden group"
            style={{ background: `linear-gradient(135deg, #c62828, ${C.down})`, color: '#fff', boxShadow: '0 4px 15px rgba(239,83,84,0.25)' }}
          >
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.06] transition-all" />
            <ArrowDown className="w-4 h-4" strokeWidth={3} />
            <span>DOWN · {asset.yield}%</span>
          </button>
        </div>
      </div>

      {/* ── Floating balance / actions ──────────────────────────── */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowDeposit(true)}
          className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all hover:brightness-110"
          style={{ background: 'rgba(38,166,154,0.15)', border: '1px solid rgba(38,166,154,0.3)', color: C.up }}
        >
          <Wallet className="w-3 h-3 inline mr-1" strokeWidth={2.5} />
          Deposit
        </button>
        <button
          type="button"
          onClick={() => setShowWithdraw(true)}
          className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all hover:brightness-110"
          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}
        >
          <ArrowDownToLine className="w-3 h-3 inline mr-1" strokeWidth={2.5} />
          Withdraw
        </button>
      </div>

      {/* Balance pill */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
        <AccountToggle mode={accountMode} onChange={setAccountMode} compact />
        <span className={`text-[10px] font-black tabular-nums px-2.5 py-1 rounded-lg ${isDemo ? 'text-amber-400' : 'text-white'}`} style={{ background: 'rgba(10,14,23,0.9)', border: '1px solid rgba(56,70,90,0.3)', backdropFilter: 'blur(8px)' }}>
          ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
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

      {/* ── Modals ──────────────────────────────────────────────── */}
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

/* ─── OHLC Cell (kept for potential future use) ──────────────────────── */

export default TradingDashboard;
