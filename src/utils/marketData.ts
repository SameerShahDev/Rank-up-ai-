// ─── Types ────────────────────────────────────────────────────────────────
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Market {
  symbol: string;
  name: string;
  basePrice: number;
  icon: string;
  color: string;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: string;
}

// ─── Real April–May 2026 price seeds ─────────────────────────────────────
const PRICE_SEEDS: Record<string, { start: number; end: number; lo: number; hi: number }> = {
  'BTC/INR':       { start: 6162300, end: 6696700, lo: 6012000,  hi: 6847000  },
  'ETH/INR':       { start: 171175,  end: 189545,  lo: 165330,   hi: 208750   },
  'BNB/INR':       { start: 51352,   end: 55778,   lo: 49683,    hi: 57615    },
  'SOL/INR':       { start: 6930,    end: 7598,    lo: 6513,     hi: 8517     },
  'ADA/INR':       { start: 60.1,    end: 67.6,    lo: 54.3,     hi: 79.3    },
  'XRP/INR':       { start: 118.6,   end: 154.5,   lo: 108.5,    hi: 175.4   },
  'DOT/INR':       { start: 400.8,   end: 442.6,   lo: 350.7,    hi: 509.4   },
  'AVAX/INR':      { start: 1795,    end: 2237,    lo: 1587,     hi: 2547    },
  'DOGE/INR':      { start: 15.2,    end: 17.9,    lo: 13.8,     hi: 20.5    },
  'MATIC/INR':     { start: 31.7,    end: 36.7,    lo: 27.6,     hi: 43.4    },
  'GOLD/INR':      { start: 248930,  end: 269705,  lo: 245490,   hi: 272210  },
  'SILVER/INR':    { start: 2630,    end: 2739,    lo: 2522,     hi: 2881    },
  'APPLE/INR':     { start: 17368,   end: 17952,   lo: 16867,    hi: 18370   },
  'TATA/INR':      { start: 780,     end: 820,     lo: 755,      hi: 855     },
  'RELIANCE/INR':  { start: 1310,    end: 1380,    lo: 1280,     hi: 1420    },
};

export const MARKETS: Market[] = [
  { symbol: 'BTC/INR',      name: 'Bitcoin',             basePrice: 6696700, icon: '₿',  color: '#F7931A', change24h:  2.45, high24h: 6781200, low24h: 6578800, volume24h: '₹2,603Cr' },
  { symbol: 'ETH/INR',      name: 'Ethereum',            basePrice: 189545,  icon: 'Ξ',  color: '#627EEA', change24h: -1.12, high24h: 195490,  low24h: 184510,  volume24h: '₹1,069Cr' },
  { symbol: 'BNB/INR',      name: 'BNB',                 basePrice: 55778,   icon: 'B',  color: '#F3BA2F', change24h:  0.88, high24h: 56688,   low24h: 54682,   volume24h: '₹200Cr'  },
  { symbol: 'SOL/INR',      name: 'Solana',              basePrice: 7598,    icon: 'S',  color: '#9945FF', change24h:  3.10, high24h: 7932,    low24h: 7260,    volume24h: '₹317Cr'  },
  { symbol: 'ADA/INR',      name: 'Cardano',             basePrice: 67.6,    icon: 'A',  color: '#0033AD', change24h: -0.72, high24h: 70.5,    low24h: 65.5,    volume24h: '₹40Cr'   },
  { symbol: 'XRP/INR',      name: 'XRP',                 basePrice: 154.5,   icon: 'X',  color: '#00AAE4', change24h:  1.95, high24h: 160.3,   low24h: 148.6,   volume24h: '₹175Cr'  },
  { symbol: 'DOT/INR',      name: 'Polkadot',            basePrice: 442.6,   icon: 'D',  color: '#E6007A', change24h: -2.30, high24h: 463.4,   low24h: 425.8,   volume24h: '₹26Cr'   },
  { symbol: 'AVAX/INR',     name: 'Avalanche',           basePrice: 2237,    icon: 'V',  color: '#E84142', change24h:  4.20, high24h: 2329,    low24h: 2138,    volume24h: '₹51Cr'   },
  { symbol: 'DOGE/INR',     name: 'Dogecoin',            basePrice: 17.9,    icon: 'Ð',  color: '#C2A633', change24h:  3.55, high24h: 19.0,    low24h: 17.1,    volume24h: '₹125Cr'  },
  { symbol: 'MATIC/INR',    name: 'Polygon',             basePrice: 36.7,    icon: 'M',  color: '#8247E5', change24h: -1.40, high24h: 38.2,    low24h: 35.5,    volume24h: '₹33Cr'   },
  { symbol: 'GOLD/INR',     name: 'Gold',                basePrice: 269705,  icon: 'Au', color: '#FFD700', change24h:  0.62, high24h: 271377,  low24h: 267034,  volume24h: '₹4,022Cr'},
  { symbol: 'SILVER/INR',   name: 'Silver',              basePrice: 2739,    icon: 'Ag', color: '#C0C0C0', change24h: -0.38, high24h: 2773,    low24h: 2698,    volume24h: '₹342Cr'  },
  { symbol: 'APPLE/INR',    name: 'Apple Inc.',          basePrice: 17952,   icon: '',  color: '#555555', change24h:  1.20, high24h: 18205,   low24h: 17667,   volume24h: '₹567Cr'  },
  { symbol: 'TATA/INR',     name: 'Tata Motors',         basePrice: 820,     icon: 'T',  color: '#00327A', change24h:  2.10, high24h: 832,     low24h: 808,     volume24h: '₹100Cr'  },
  { symbol: 'RELIANCE/INR', name: 'Reliance Industries', basePrice: 1380,    icon: 'R',  color: '#1C4F9C', change24h: -0.55, high24h: 1398,    low24h: 1365,    volume24h: '₹242Cr'  },
];

// ─── Core candle generator ────────────────────────────────────────────────
function generateCandles(symbol: string, fromPrice: number, count: number, startTime: number): Candle[] {
  const seed       = PRICE_SEEDS[symbol];
  const interval   = 4 * 60 * 60 * 1000; // 4H
  const priceRange = seed.hi - seed.lo;
  const volatility = priceRange * 0.25; // 25% — wild swings

  const candles: Candle[] = [];
  let price = fromPrice;

  for (let i = 0; i < count; i++) {
    const open   = price;
    const mid    = (seed.hi + seed.lo) / 2;
    const revert = (mid - price) * 0.005; // even weaker reversion
    const change = (Math.random() - 0.48) * volatility + revert;
    const close  = Math.min(Math.max(open + change, seed.lo * 0.5), seed.hi * 1.5);

    const wickFactor = 2.0 + Math.random() * 6.0; // massive wicks 2x-8x
    const high = Math.max(open, close) + Math.abs(Math.random() * volatility * wickFactor);
    const low  = Math.min(open, close) - Math.abs(Math.random() * volatility * wickFactor);
    const volume = seed.start * (300 + Math.random() * 1200);

    candles.push({
      time: startTime + i * interval,
      open,
      high: Math.min(high, seed.hi * 2.0),
      low:  Math.max(low,  seed.lo * 0.3),
      close,
      volume,
    });
    price = close;
  }
  return candles;
}

// ─── Rolling buffer constants ─────────────────────────────────────────────
const INITIAL_COUNT  = 180;
const EXTEND_TRIGGER = 20;
const EXTEND_BATCH   = 60;
const MAX_BUFFER     = 360;
const CANDLE_INTERVAL = 4 * 60 * 60 * 1000; // 4H

// ─── Internal state ───────────────────────────────────────────────────────
const _buffer:     Record<string, Candle[]>  = {};
const _headIdx:    Record<string, number>    = {};
const _liveCandle: Record<string, Candle>    = {};
const _tickCount:  Record<string, number>    = {};
const TICKS_PER_CANDLE = 4; // 4 × 400ms = 1.6 sec per candle — fast, exciting

// ─── localStorage persistence ─────────────────────────────────────────────
const STORAGE_PREFIX = 'tryonetrade_market_';
const SAVE_THROTTLE_MS = 30000; // save every 30s max
let _lastSaveTime = 0;

interface SavedState {
  buffer: Candle[];
  headIdx: number;
  liveCandle: Candle;
  tickCount: number;
  lastSaved: number;
}

function storageKey(symbol: string): string {
  return STORAGE_PREFIX + symbol.replace('/', '_');
}

function saveMarketState(symbol: string): void {
  try {
    const state: SavedState = {
      buffer: _buffer[symbol],
      headIdx: _headIdx[symbol],
      liveCandle: _liveCandle[symbol],
      tickCount: _tickCount[symbol],
      lastSaved: Date.now(),
    };
    localStorage.setItem(storageKey(symbol), JSON.stringify(state));
  } catch {
    // localStorage full or blocked — silently ignore
  }
}

function loadMarketState(symbol: string): SavedState | null {
  try {
    const raw = localStorage.getItem(storageKey(symbol));
    if (!raw) return null;
    const state = JSON.parse(raw) as SavedState;
    if (!state.buffer || !state.liveCandle || typeof state.headIdx !== 'number') return null;
    return state;
  } catch {
    return null;
  }
}

// ─── Generate candles to fill gap when page was closed ────────────────────
function fillTimeGap(symbol: string, lastSaved: number, now: number): void {
  const gapMs = now - lastSaved;
  const gapCandles = Math.floor(gapMs / CANDLE_INTERVAL);

  if (gapCandles < 1) return;

  const buf  = _buffer[symbol];
  const maxGap = Math.min(gapCandles, 200); // cap at ~33 hours to prevent crazy generation
  const lastCandle = buf[buf.length - 1];

  const newCandles = generateCandles(symbol, lastCandle.close, maxGap, lastCandle.time + CANDLE_INTERVAL);
  buf.push(...newCandles);

  // Advance head by gap candles (simulate that market kept running)
  _headIdx[symbol] = Math.min(buf.length - 2, _headIdx[symbol] + maxGap);

  // Set live candle from new position
  const head = _headIdx[symbol];
  _liveCandle[symbol] = { ...buf[head] };

  // Trim if buffer too large
  if (buf.length > MAX_BUFFER) {
    const trim = buf.length - MAX_BUFFER;
    buf.splice(0, trim);
    _headIdx[symbol] = Math.max(0, _headIdx[symbol] - trim);
  }
}

// ─── Init all markets ─────────────────────────────────────────────────────
const now = Date.now();

MARKETS.forEach(m => {
  const saved = loadMarketState(m.symbol);

  if (saved && saved.buffer.length > 0) {
    // Restore from localStorage
    _buffer[m.symbol]    = saved.buffer;
    _headIdx[m.symbol]   = saved.headIdx;
    _liveCandle[m.symbol] = saved.liveCandle;
    _tickCount[m.symbol]  = saved.tickCount;

    // Fill gap if page was closed for a while
    fillTimeGap(m.symbol, saved.lastSaved, now);

    console.log(`[Market] Restored ${m.symbol} from localStorage (head: ${_headIdx[m.symbol]}, buffer: ${_buffer[m.symbol].length})`);
  } else {
    // Fresh generate
    const seed      = PRICE_SEEDS[m.symbol];
    const startTime = now - INITIAL_COUNT * CANDLE_INTERVAL;

    _buffer[m.symbol]     = generateCandles(m.symbol, seed.start, INITIAL_COUNT, startTime);
    _headIdx[m.symbol]    = INITIAL_COUNT - 2;
    _liveCandle[m.symbol] = { ..._buffer[m.symbol][INITIAL_COUNT - 1] };
    _tickCount[m.symbol]  = 0;

    // Save initial state
    saveMarketState(m.symbol);

    console.log(`[Market] Generated fresh ${m.symbol}`);
  }
});

// ─── Extend buffer seamlessly ─────────────────────────────────────────────
function maybeExtend(symbol: string): void {
  const buf  = _buffer[symbol];
  const head = _headIdx[symbol];
  const remaining = buf.length - 1 - head;

  if (remaining < EXTEND_TRIGGER) {
    const lastCandle = buf[buf.length - 1];
    const newCandles = generateCandles(symbol, lastCandle.close, EXTEND_BATCH, lastCandle.time + CANDLE_INTERVAL);
    buf.push(...newCandles);

    if (buf.length > MAX_BUFFER) {
      const trim = buf.length - MAX_BUFFER;
      buf.splice(0, trim);
      _headIdx[symbol] = Math.max(0, _headIdx[symbol] - trim);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────
export function getLivePrice(symbol: string): number {
  return _liveCandle[symbol]?.close ?? MARKETS.find(m => m.symbol === symbol)?.basePrice ?? 0;
}

export function getLiveCandles(symbol: string, count = 60): Candle[] {
  const buf  = _buffer[symbol] ?? [];
  const head = _headIdx[symbol] ?? 0;
  const start = Math.max(0, head - count + 1);
  return [...buf.slice(start, head + 1), { ..._liveCandle[symbol] }];
}

export function getCandles(symbol: string): Candle[] {
  return _buffer[symbol] ?? [];
}

// ─── Tick engine — call every 600ms ──────────────────────────────────────
export function tickPrices(): void {
  MARKETS.forEach(m => {
    const buf = _buffer[m.symbol];
    _tickCount[m.symbol]++;
    const tc = _tickCount[m.symbol];

    const head       = _headIdx[m.symbol];
    const nextIdx    = Math.min(head + 1, buf.length - 1);
    const nextCandle = buf[nextIdx];
    const lc         = _liveCandle[m.symbol];

    // Smoothly build live candle tick-by-tick toward nextCandle's close
    const progress = tc / TICKS_PER_CANDLE;
    const noise    = (nextCandle.high - nextCandle.low) * (Math.random() - 0.5) * 4.0; // extreme noise
    let tickMove   = lc.open + (nextCandle.close - lc.open) * Math.min(progress, 1) + noise;

    // Frequent sharp spikes (25% chance)
    if (Math.random() < 0.25) {
      const spikeDir  = Math.random() > 0.5 ? 1 : -1;
      const spikeSize = nextCandle.close * (0.01 + Math.random() * 0.04);
      tickMove += spikeDir * spikeSize;
    }

    // Mega spike (5% chance)
    if (Math.random() < 0.05) {
      const spikeDir  = Math.random() > 0.5 ? 1 : -1;
      tickMove += spikeDir * nextCandle.close * (0.04 + Math.random() * 0.06);
    }

    lc.close = tickMove;
    lc.high  = Math.max(lc.high, lc.close, lc.open + Math.abs(noise) * 2);
    lc.low   = Math.min(lc.low,  lc.close, lc.open - Math.abs(noise) * 2);

    // Candle complete — advance head
    if (tc >= TICKS_PER_CANDLE) {
      _tickCount[m.symbol] = 0;

      // Commit completed live candle
      buf[head] = { ...lc, time: lc.time };

      // Move head forward
      _headIdx[m.symbol] = nextIdx;

      const newBase = nextCandle.close;
      _liveCandle[m.symbol] = {
        time:   Date.now(),
        open:   newBase,
        high:   newBase,
        low:    newBase,
        close:  newBase,
        volume: nextCandle.volume,
      };

      maybeExtend(m.symbol);
    }
  });

  // Throttled save to localStorage
  const tickNow = Date.now();
  if (tickNow - _lastSaveTime >= SAVE_THROTTLE_MS) {
    _lastSaveTime = tickNow;
    MARKETS.forEach(m => saveMarketState(m.symbol));
  }
}
