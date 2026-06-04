import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, TrendingUp, TrendingDown, ChevronDown, X } from 'lucide-react';
import { MARKETS, getLiveCandles, getLivePrice, tickPrices, type Candle, type Market } from '../utils/marketData';

const TIMEFRAMES = ['15m', '1H', '4H', '1D', '1W'] as const;
type Timeframe = typeof TIMEFRAMES[number];

const TF_CANDLE_COUNT: Record<Timeframe, number> = {
  '15m': 60, '1H': 60, '4H': 60, '1D': 30, '1W': 20,
};

// ─── Candlestick Chart ───────────────────────────────────────────────────
function CandlestickChart({ candles, livePrice }: { candles: Candle[]; livePrice: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number; price: number; time: string; candle: Candle | null } | null>(null);

  const W = 360, H = 320, PAD = { top: 10, right: 60, bottom: 30, left: 55 };
  const VOL_H = 36;
  const chartW = W - PAD.left - PAD.right;
  const candleH = H - PAD.top - PAD.bottom - VOL_H - 4;

  // Bollinger Bands calculation
  const calcBB = (data: number[], period = 20, stdDev = 2) => {
    const upper: (number | null)[] = [];
    const lower: (number | null)[] = [];
    const middle: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { upper.push(null); lower.push(null); middle.push(null); continue; }
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j];
      const avg = sum / period;
      let sqSum = 0;
      for (let j = i - period + 1; j <= i; j++) sqSum += (data[j] - avg) ** 2;
      const std = Math.sqrt(sqSum / period);
      middle.push(avg);
      upper.push(avg + stdDev * std);
      lower.push(avg - stdDev * std);
    }
    return { upper, middle, lower };
  };

  if (!candles.length) return <div className="h-44 bg-gray-800 rounded-2xl animate-pulse" />;

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const maxP = Math.max(...highs, livePrice);
  const minP = Math.min(...lows, livePrice);
  const range = maxP - minP || 1;
  const volMax = Math.max(...candles.map(c => c.volume), 1);

  const toY = (p: number) => PAD.top + ((maxP - p) / range) * candleH;
  const barW = Math.max(2, (chartW / candles.length) - 0.5);

  // EMA calculation
  const calcEMA = (data: number[], period: number) => {
    const result: (number | null)[] = [];
    const k = 2 / (period + 1);
    let ema: number | null = null;
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { result.push(null); }
      else if (i === period - 1) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[j];
        ema = sum / period;
        result.push(ema);
      } else {
        ema = data[i] * k + (ema as number) * (1 - k);
        result.push(ema);
      }
    }
    return result;
  };

  const ema7 = calcEMA(closes, 7);
  const ema25 = calcEMA(closes, 25);
  const bb = calcBB(closes, 20, 2);

  const buildPath = (vals: (number | null)[]) => {
    let d = '';
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === null) continue;
      const x = PAD.left + (i / (candles.length - 1)) * chartW;
      const y = toY(vals[i]!);
      d += (d ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d;
  };

  // Build Bollinger fill path
  const buildBBFill = () => {
    let d = '';
    let started = false;
    for (let i = 0; i < bb.upper.length; i++) {
      if (bb.upper[i] === null) continue;
      const x = PAD.left + (i / (candles.length - 1)) * chartW;
      const y = toY(bb.upper[i]!);
      d += (started ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
      started = true;
    }
    for (let i = bb.lower.length - 1; i >= 0; i--) {
      if (bb.lower[i] === null) continue;
      const x = PAD.left + (i / (candles.length - 1)) * chartW;
      const y = toY(bb.lower[i]!);
      d += 'L' + x.toFixed(1) + ',' + y.toFixed(1);
    }
    d += 'Z';
    return d;
  };

  const priceSteps = 5;
  const priceLabels = Array.from({ length: priceSteps + 1 }, (_, i) => {
    const p = minP + (range * i) / priceSteps;
    return { y: toY(p), label: p >= 1000 ? `${(p / 1000).toFixed(1)}k` : p.toFixed(p < 10 ? 4 : 2) };
  });

  const fmtP = (p: number) => p >= 1000 ? p.toFixed(0) : p < 1 ? p.toFixed(4) : p.toFixed(2);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;
    if (svgX < PAD.left || svgX > W - PAD.right || svgY < PAD.top || svgY > PAD.top + candleH + VOL_H + 4) {
      setCrosshair(null);
      return;
    }
    const pct = (svgX - PAD.left) / chartW;
    const idx = Math.round(pct * (candles.length - 1));
    const ci = Math.min(idx, candles.length - 1);
    const c = candles[ci];
    const priceAtX = maxP - ((svgY - PAD.top) / candleH) * range;
    const d = new Date(c.time);
    setCrosshair({
      x: svgX,
      y: svgY,
      price: priceAtX,
      time: `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`,
      candle: c,
    });
  };
  const handleMouseLeave = () => setCrosshair(null);

  const lastCandle = candles[candles.length - 1];
  const isUp = lastCandle.close >= lastCandle.open;

  return (
    <div ref={containerRef} className="relative bg-[#080c14] rounded-2xl border border-white/[0.06] overflow-hidden">
      {/* Legend bar */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-3 text-[9px] font-mono">
        <span className="text-blue-400/90">EMA7 <span className="text-blue-400/60 font-bold">{fmtP(closes[closes.length - 1])}</span></span>
        <span className="text-purple-400/90">EMA25</span>
        <span className="text-blue-300/50">BB(20,2)</span>
      </div>
      {/* Live price badge */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold"
        style={{ background: isUp ? 'rgba(0,230,118,0.12)' : 'rgba(255,23,68,0.12)', border: `1px solid ${isUp ? 'rgba(0,230,118,0.25)' : 'rgba(255,23,68,0.25)'}`, color: isUp ? '#00e676' : '#ff1744' }}>
        <span>{fmtP(livePrice)}</span>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair"
        style={{ height: 320 }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <defs>
          <linearGradient id="volGradBull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00e676" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00e676" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="volGradBear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff1744" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff1744" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="bbGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(33,150,243,0.12)" />
            <stop offset="100%" stopColor="rgba(33,150,243,0.12)" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {priceLabels.map((pl, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={pl.y} x2={W - PAD.right} y2={pl.y}
              stroke="rgba(255,255,255,0.035)" strokeWidth="0.5" strokeDasharray="3,4" />
            <text x={PAD.left - 6} y={pl.y + 3} textAnchor="end"
              fontSize="7" fill="rgba(148,163,184,0.5)" fontFamily="'SF Mono', ui-monospace, monospace">{pl.label}</text>
          </g>
        ))}

        {/* Vertical grid lines */}
        {[0.25, 0.5, 0.75].map(pct => {
          const x = PAD.left + chartW * pct;
          return (
            <line key={pct} x1={x} y1={PAD.top} x2={x} y2={PAD.top + candleH + VOL_H + 4}
              stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" strokeDasharray="3,4" />
          );
        })}

        {/* Separator line for volume */}
        <line x1={PAD.left} y1={PAD.top + candleH + 2} x2={W - PAD.right} y2={PAD.top + candleH + 2}
          stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />

        {/* Bollinger Bands fill */}
        <path d={buildBBFill()} fill="url(#bbGrad)" />
        {/* Bollinger upper band */}
        <path d={buildPath(bb.upper)} fill="none" stroke="rgba(33,150,243,0.25)" strokeWidth="0.8" strokeDasharray="4,4" />
        {/* Bollinger lower band */}
        <path d={buildPath(bb.lower)} fill="none" stroke="rgba(33,150,243,0.25)" strokeWidth="0.8" strokeDasharray="4,4" />

        {/* Candles */}
        {candles.map((c, i) => {
          const x = PAD.left + (i / (candles.length - 1)) * chartW;
          const up = c.close >= c.open;
          const col = up ? '#00e676' : '#ff1744';
          const bodyTop = toY(Math.max(c.open, c.close));
          const bodyH = Math.max(1, Math.abs(toY(c.open) - toY(c.close)));
          return (
            <g key={i}>
              <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)}
                stroke={col} strokeWidth="1" opacity="0.5" />
              <rect x={x - barW / 2} y={bodyTop} width={barW} height={bodyH}
                fill={col} rx={barW > 3 ? 1 : 0} opacity={up ? 0.9 : 0.85} />
            </g>
          );
        })}

        {/* Volume bars */}
        {candles.map((c, i) => {
          const x = PAD.left + (i / (candles.length - 1)) * chartW;
          const up = c.close >= c.open;
          const vh = Math.max(1, ((c.volume / volMax) * VOL_H));
          return (
            <rect key={'v' + i} x={x - barW / 2} y={PAD.top + candleH + 4 + VOL_H - vh}
              width={barW} height={vh} fill={up ? 'url(#volGradBull)' : 'url(#volGradBear)'} rx={0.5}
            />
          );
        })}

        {/* EMA7 line */}
        <path d={buildPath(ema7)} fill="none" stroke="#ff9800" strokeWidth="1.2" opacity="0.85" />
        {/* EMA25 line */}
        <path d={buildPath(ema25)} fill="none" stroke="#7c4dff" strokeWidth="1.2" opacity="0.85" strokeDasharray="4,3" />

        {/* Live price horizontal line */}
        <line x1={PAD.left} y1={toY(livePrice)} x2={W - PAD.right} y2={toY(livePrice)}
          stroke={isUp ? '#00e676' : '#ff1744'} strokeWidth="0.5" strokeDasharray="5,4" opacity="0.5" />

        {/* Crosshair */}
        {crosshair && crosshair.candle && (
          <g>
            <line x1={PAD.left} y1={crosshair.y} x2={W - PAD.right} y2={crosshair.y}
              stroke="rgba(148,163,184,0.2)" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.7" />
            <line x1={crosshair.x} y1={PAD.top} x2={crosshair.x} y2={PAD.top + candleH + VOL_H + 4}
              stroke="rgba(148,163,184,0.2)" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.7" />
            {/* Candle highlight */}
            <rect x={crosshair.x - barW / 2 - 1} y={PAD.top} width={barW + 2} height={candleH}
              fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="0.5" rx={1} />
            {/* OHLC Tooltip */}
            <rect x={crosshair.x + 12} y={PAD.top + 8} width={100} height={82}
              fill="rgba(15,23,42,0.95)" rx="5" stroke={crosshair.candle.close >= crosshair.candle.open ? 'rgba(0,230,118,0.2)' : 'rgba(255,23,68,0.2)'} strokeWidth="0.5" />
            <line x1={crosshair.x + 13} y1={PAD.top + 10} x2={crosshair.x + 111} y2={PAD.top + 10}
              stroke={crosshair.candle.close >= crosshair.candle.open ? '#00e676' : '#ff1744'} strokeWidth="1.5" />
            <text x={crosshair.x + 17} y={PAD.top + 15} fontSize="6.5" fill="rgba(148,163,184,0.6)" fontFamily="'SF Mono', monospace">{crosshair.time}</text>
            {(['O', 'H', 'L', 'C'] as const).map((label, j) => {
              const val = crosshair.candle![label.toLowerCase() as keyof typeof crosshair.candle] as number;
              const isLast = j === 3;
              const color = label === 'H' ? '#00e676' : label === 'L' ? '#ff1744' : label === 'C' ? (crosshair.candle!.close >= crosshair.candle!.open ? '#00e676' : '#ff1744') : 'rgba(203,213,225,0.85)';
              return (
                <g key={label}>
                  <text x={crosshair.x + 17} y={PAD.top + 26 + j * 14} fontSize="6.5" fill="rgba(148,163,184,0.5)" fontFamily="'SF Mono', monospace">{label}</text>
                  <text x={crosshair.x + 34} y={PAD.top + 26 + j * 14} fontSize="6.5" fill={color} fontFamily="'SF Mono', monospace" fontWeight="bold">{fmtP(val)}</text>
                </g>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}

// ─── Order Book Row ───────────────────────────────────────────────────────
function OrderBookRow({ price, amount, total, side, maxTotal }: {
  price: number; amount: number; total: number; side: 'bid' | 'ask'; maxTotal: number;
}) {
  const pct = Math.min((total / maxTotal) * 100, 100);
  const fmt = (n: number) => n >= 1000 ? n.toFixed(0) : n < 1 ? n.toFixed(4) : n.toFixed(2);
  const isBid = side === 'bid';
  return (
    <div className="relative flex justify-between text-[11px] py-1 px-2 cursor-pointer hover:bg-white/[0.03] transition-colors font-mono">
      <div className={`absolute inset-y-0 ${isBid ? 'right-0' : 'left-0'} transition-all duration-300`}
        style={{ width: `${pct}%`, background: isBid ? 'rgba(0,230,118,0.08)' : 'rgba(255,23,68,0.08)' }} />
      <span className={`relative z-10 font-bold ${isBid ? 'text-[#00e676]' : 'text-[#ff1744]'}`}>{fmt(price)}</span>
      <span className="relative z-10 text-white/80">{amount.toFixed(4)}</span>
      <span className="relative z-10 text-white/50">{fmt(total)}</span>
    </div>
  );
}

// ─── Buy / Sell Modal ────────────────────────────────────────────────────
function TradeModal({ market, side, price, onClose }: {
  market: Market; side: 'buy' | 'sell'; price: number; onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitPrice, setLimitPrice] = useState(price.toFixed(price < 1 ? 4 : 2));
  const total = parseFloat(amount || '0') * (orderType === 'market' ? price : parseFloat(limitPrice || '0'));
  const isBuy = side === 'buy';

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-end justify-center font-space"
      onClick={onClose}>
      <div className="bg-[#0d0e14] rounded-t-[3rem] w-full max-w-md p-8 space-y-6 border-t-2 border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col">
            <h3 className={`text-3xl font-black tracking-tighter ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
              {isBuy ? 'LONG' : 'SHORT'} {market.symbol.split('/')[0]}
            </h3>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Execution Terminal</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full"><X className="w-6 h-6 text-gray-500" /></button>
        </div>

        {/* Order type */}
        <div className="flex bg-gray-800 rounded-xl p-1">
          {(['market', 'limit'] as const).map(t => (
            <button key={t} onClick={() => setOrderType(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${orderType === t ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Price */}
        {orderType === 'limit' && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Limit Price (₹)</label>
            <input type="number" value={limitPrice} onChange={e => setLimitPrice(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
        )}
        {orderType === 'market' && (
          <div className="flex justify-between text-sm bg-gray-800 rounded-xl p-3">
            <span className="text-gray-400">Market Price</span>
            <span className="font-mono font-semibold">₹{price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Amount ({market.symbol.split('/')[0]})</label>
          <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        {/* Quick % */}
        <div className="grid grid-cols-4 gap-2">
          {[25, 50, 75, 100].map(pct => (
            <button key={pct} onClick={() => setAmount((pct * 0.01).toFixed(4))}
              className="py-1.5 bg-gray-800 rounded-lg text-xs text-gray-300 hover:bg-gray-700 transition-colors">
              {pct}%
            </button>
          ))}
        </div>

        {/* Total */}
        <div className="flex justify-between text-sm bg-gray-800 rounded-xl p-3">
          <span className="text-gray-400">Total (₹)</span>
          <span className="font-mono font-semibold text-white">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        </div>

        {/* Submit */}
        <button
          onClick={() => { alert(`${isBuy ? 'Buy' : 'Sell'} order placed!\n${amount} ${market.name} @ ₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`); onClose(); }}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 shadow-lg ${
            isBuy ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20' : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
          }`}>
          {isBuy ? 'Buy' : 'Sell'} {market.symbol.split('/')[0]}
        </button>
      </div>
    </div>
  );
}

// ─── Market Row (in sidebar list) ────────────────────────────────────────
function MarketRow({ market, price, active, onClick }: {
  market: Market; price: number; active: boolean; onClick: () => void;
}) {
  const up = market.change24h >= 0;
  const fmtPrice = price >= 1000 ? price.toFixed(0) : price < 1 ? price.toFixed(4) : price.toFixed(2);
  return (
    <button onClick={onClick}
      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all active:scale-98 ${active ? 'bg-blue-600/15 border border-blue-500/40' : 'hover:bg-gray-800'}`}>
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ backgroundColor: market.color + '33', border: `1px solid ${market.color}66` }}>
          <span style={{ color: market.color }}>{market.icon}</span>
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold leading-none">{market.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{market.symbol}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono font-semibold">${fmtPrice}</p>
        <p className={`text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
          {up ? '+' : ''}{market.change24h.toFixed(2)}%
        </p>
      </div>
    </button>
  );
}

// ─── Main Trading Component ───────────────────────────────────────────────
const TradingView: React.FC = () => {
  const [activeMarket, setActiveMarket] = useState<Market>(MARKETS[0]);
  const [timeframe, setTimeframe] = useState<Timeframe>('4H');
  const [livePrices, setLivePrices] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    MARKETS.forEach(m => { init[m.symbol] = getLivePrice(m.symbol); });
    return init;
  });
  const [tradeModal, setTradeModal] = useState<{ side: 'buy' | 'sell' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMarkets, setShowMarkets] = useState(false);
  const [tab, setTab] = useState<'chart' | 'book'>('chart');

  const currentPrice = livePrices[activeMarket.symbol] ?? activeMarket.basePrice;

  // Tick prices every 400ms for fast movement
  useEffect(() => {
    const id = setInterval(() => {
      tickPrices();
      setLivePrices(() => {
        const next: Record<string, number> = {};
        MARKETS.forEach(m => { next[m.symbol] = getLivePrice(m.symbol); });
        return next;
      });
    }, 400);
    return () => clearInterval(id);
  }, []);

  // Candles — live sliding window that loops through 30-day history
  const count = TF_CANDLE_COUNT[timeframe];
  const candles = getLiveCandles(activeMarket.symbol, count);

  // Generate live order book
  const generateOrderBook = useCallback((price: number) => {
    const spread = price * 0.0002;
    const bids = Array.from({ length: 8 }, (_, i) => {
      const p = price - spread - i * price * 0.0001 * (1 + Math.random() * 0.5);
      const a = Math.random() * 2 + 0.1;
      return { price: p, amount: a, total: p * a };
    });
    const asks = Array.from({ length: 8 }, (_, i) => {
      const p = price + spread + i * price * 0.0001 * (1 + Math.random() * 0.5);
      const a = Math.random() * 2 + 0.1;
      return { price: p, amount: a, total: p * a };
    });
    return { bids, asks };
  }, []);

  const [orderBook, setOrderBook] = useState(() => generateOrderBook(currentPrice));
  useEffect(() => {
    const id = setInterval(() => {
      setOrderBook(generateOrderBook(livePrices[activeMarket.symbol] ?? currentPrice));
    }, 2000);
    return () => clearInterval(id);
  }, [activeMarket.symbol, livePrices, currentPrice, generateOrderBook]);

  const maxTotal = Math.max(
    ...orderBook.bids.map(b => b.total),
    ...orderBook.asks.map(a => a.total)
  );

  const filteredMarkets = MARKETS.filter(m =>
    m.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isUp = activeMarket.change24h >= 0;

  // Indian number format helper
  const fmtINR = (p: number) => {
    if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
    if (p >= 100000)  return `₹${(p / 100000).toFixed(2)} L`;
    if (p >= 1000)    return `₹${p.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    if (p < 1)        return `₹${p.toFixed(4)}`;
    return `₹${p.toFixed(2)}`;
  };
  const fmtPrice = fmtINR(currentPrice);

  return (
    <div className="flex flex-col h-full bg-[#08090d] text-white font-space">
      {/* ── Top: Market selector ── */}
      <div className="px-5 pt-5 pb-3 border-b border-white/5 bg-[#0d0e14]">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowMarkets(!showMarkets)}
            className="flex items-center gap-4 group">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg transition-transform group-active:scale-90"
              style={{ backgroundColor: activeMarket.color + '15', border: `2px solid ${activeMarket.color}30` }}>
              <span style={{ color: activeMarket.color }}>{activeMarket.icon}</span>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tighter">{activeMarket.symbol}</span>
                <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showMarkets ? 'rotate-180' : ''}`} />
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono font-black text-blue-500 text-sm">{fmtPrice}</span>
                <div className={`px-2 py-0.5 rounded-md text-[10px] font-black ${isUp ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {isUp ? '+' : '-'}{Math.abs(activeMarket.change24h).toFixed(2)}%
                </div>
              </div>
            </div>
          </button>

          <div className="hidden sm:flex flex-col items-end gap-1 text-[10px] font-black tracking-widest text-gray-500">
             <div className="flex items-center gap-2">
                <span>HIGH <span className="text-white font-mono">{fmtINR(activeMarket.high24h)}</span></span>
                <span className="w-px h-2 bg-white/10" />
                <span>LOW <span className="text-white font-mono">{fmtINR(activeMarket.low24h)}</span></span>
             </div>
             <div>VOLUME <span className="text-white font-mono">{activeMarket.volume24h}</span></div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* ── Chart / Order Book tabs ── */}
        <div className="flex bg-[#0d0e14] px-4">
          {(['chart', 'book'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${
                tab === t ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {t === 'chart' ? 'Analytics' : 'Order Flow'}
              {tab === t && <div className="absolute bottom-0 left-4 right-4 h-1 bg-blue-500 rounded-t-full shadow-[0_-4px_12px_rgba(37,99,235,0.5)]" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* ── Chart ── */}
          {tab === 'chart' && (
            <div className="p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex bg-[#161821] p-1.5 rounded-2xl border border-white/5">
                {TIMEFRAMES.map(tf => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all ${
                      timeframe === tf ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                    }`}>
                    {tf}
                  </button>
                ))}
              </div>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-blue-500/10 rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition duration-500" />
                <div className="relative">
                   <CandlestickChart candles={candles} livePrice={currentPrice} />
                </div>
              </div>
            </div>
          )}

          {/* ── Order Book ── */}
          {tab === 'book' && (
            <div className="p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="grid grid-cols-3 text-[10px] font-black text-gray-500 uppercase tracking-widest px-2 pb-2 border-b border-white/5">
                <span>Price</span><span className="text-center">Size</span><span className="text-right">Total</span>
              </div>
              <div className="space-y-0.5 font-mono">
                {[...orderBook.asks].reverse().map((a, i) => (
                  <OrderBookRow key={i} price={a.price} amount={a.amount} total={a.total}
                    side="ask" maxTotal={maxTotal} />
                ))}
              </div>
              <div className="flex items-center justify-center py-4 bg-white/[0.02] rounded-2xl border border-white/5 relative overflow-hidden group">
                <div className={`absolute inset-0 bg-gradient-to-r ${isUp ? 'from-green-500/5' : 'from-red-500/5'} to-transparent`} />
                <span className={`text-3xl font-black font-mono tracking-tighter relative z-10 ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                  {fmtPrice}
                </span>
                <span className={`ml-3 relative z-10 ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                  {isUp ? <TrendingUp className="w-6 h-6 stroke-[3]" /> : <TrendingDown className="w-6 h-6 stroke-[3]" />}
                </span>
              </div>
              <div className="space-y-0.5 font-mono">
                {orderBook.bids.map((b, i) => (
                  <OrderBookRow key={i} price={b.price} amount={b.amount} total={b.total}
                    side="bid" maxTotal={maxTotal} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Buttons ── */}
      <div className="px-6 pb-8 pt-4 border-t border-white/5 bg-[#0d0e14] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <div className="grid grid-cols-2 gap-5">
          <button onClick={() => setTradeModal({ side: 'buy' })}
            className="h-16 bg-green-500 hover:bg-green-400 rounded-3xl font-black text-xl tracking-tighter text-white shadow-[0_10px_30px_rgba(34,197,94,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3 border-b-4 border-green-700">
            <TrendingUp className="w-6 h-6 stroke-[3]" />
            <span>LONG</span>
          </button>
          <button onClick={() => setTradeModal({ side: 'sell' })}
            className="h-16 bg-red-500 hover:bg-red-400 rounded-3xl font-black text-xl tracking-tighter text-white shadow-[0_10px_30px_rgba(239,68,68,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3 border-b-4 border-red-700">
            <TrendingDown className="w-6 h-6 stroke-[3]" />
            <span>SHORT</span>
          </button>
        </div>
      </div>

      {/* ── Market dropdown ── */}
      {showMarkets && (
        <div className="fixed inset-0 bg-[#08090d]/95 backdrop-blur-2xl z-[100] animate-in fade-in duration-300">
          <div className="flex flex-col h-full p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col">
                <h3 className="font-black text-4xl tracking-tighter">MARKETS</h3>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mt-1">Global Liquidity Pool</span>
              </div>
              <button onClick={() => setShowMarkets(false)} className="p-3 bg-white/5 rounded-2xl"><X className="w-8 h-8 text-white" /></button>
            </div>
            
            <div className="relative mb-6">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500" />
              <input type="text" placeholder="Search Assets..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#161821] border-2 border-white/5 rounded-[2rem] py-5 pl-14 pr-6 text-lg font-black tracking-tight focus:outline-none focus:border-blue-500/50 transition-all shadow-inner"
              />
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
              {filteredMarkets.map(m => (
                <MarketRow key={m.symbol} market={m} price={livePrices[m.symbol] ?? m.basePrice}
                  active={activeMarket.symbol === m.symbol}
                  onClick={() => { setActiveMarket(m); setShowMarkets(false); setSearchQuery(''); }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {tradeModal && (
        <TradeModal
          market={activeMarket}
          side={tradeModal.side}
          price={currentPrice}
          onClose={() => setTradeModal(null)}
        />
      )}
    </div>
  );
};

export default TradingView;