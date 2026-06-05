"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Candle } from "../../utils/marketData";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */
interface Trade {
  id: string;
  type: "UP" | "DOWN";
  entryPrice: number;
  amount: number;
  duration: number;
  timeLeft: number;
}

interface Props {
  candles: Candle[];
  livePrice: number;
  trades: Trade[];
  activeTrade: Trade | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Binary Options Trading Chart Spec
   ═══════════════════════════════════════════════════════════════════════════ */
const C = {
  bg: "#1C1E22",
  grid: "rgba(38, 41, 46, 0.4)",
  axisLabel: "rgba(140, 156, 178, 0.7)",
  bullish: "#00B074",
  bearish: "#F3505D",
  livePriceLine: "rgba(255, 255, 255, 0.5)",
  crosshair: "rgba(140, 156, 178, 0.35)",
};

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const snap = (v: number) => Math.round(v) + 0.5;

/* Smart price formatting - no long zeros */
function formatPrice(price: number): string {
  if (price >= 1000000) return price.toFixed(0);
  if (price >= 1000) return price.toFixed(0);
  if (price >= 100) return price.toFixed(2);
  if (price >= 10) return price.toFixed(2);
  if (price >= 1) return price.toFixed(3);
  return price.toFixed(4);
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const ChartCanvas: React.FC<Props> = ({ candles, livePrice, trades, activeTrade }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvsRef = useRef<HTMLCanvasElement>(null);

  const [range, setRange] = useState({ s: 0, e: 0 });
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);

  const drag = useRef({ on: false, x0: 0, o0: 0, vx: 0, lx: 0, lt: 0 });
  const offset = useRef(0);
  const pinch = useRef({ on: false, d0: 0, n0: 0 });

  /* ── Visible range init ──────────────────────────────────────────── */
  useEffect(() => {
    if (!candles.length) return;
    setRange(prev => {
      if (prev.s === 0 && prev.e === 0) {
        const n = Math.min(60, candles.length);
        return { s: candles.length - n, e: candles.length - 1 };
      }
      if (prev.e >= candles.length - 2) {
        const n = prev.e - prev.s + 1;
        return { s: candles.length - n, e: candles.length - 1 };
      }
      return prev;
    });
  }, [candles.length]);

  /* ── Wheel: scroll=zoom, shift+scroll=pan ────────────────────────── */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const isZoom = !e.shiftKey;
      setRange(p => {
        const n = p.e - p.s + 1;
        if (isZoom) {
          const rect = el.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const ratio = Math.min(1, Math.max(0, mouseX / rect.width));
          const delta = e.deltaY > 0 ? 3 : -3;
          const nn = Math.max(10, Math.min(candles.length, n + delta));
          const shrink = n - nn;
          const sOff = Math.round(shrink * ratio);
          return {
            s: Math.max(0, p.s + sOff),
            e: Math.min(candles.length - 1, p.e - (shrink - sOff)),
          };
        } else {
          const d = e.deltaY > 0 ? 2 : -2;
          const ns = Math.max(0, Math.min(candles.length - n, p.s + d));
          return { s: ns, e: ns + n - 1 };
        }
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [candles.length]);

  /* ── Interaction handlers ────────────────────────────────────────── */
  const onDown = (e: React.MouseEvent) => {
    drag.current = { on: true, x0: e.clientX, o0: offset.current, vx: 0, lx: e.clientX, lt: performance.now() };
  };

  const onMove = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap || !candles.length) return;
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (drag.current.on) {
      const W = rect.width;
      const n = range.e - range.s + 1;
      const dx = e.clientX - drag.current.x0;
      const no = drag.current.o0 + dx / (W / n);
      const now = performance.now();
      const dt = now - drag.current.lt;
      if (dt > 0) drag.current.vx = (e.clientX - drag.current.lx) / dt;
      drag.current.lx = e.clientX; drag.current.lt = now;
      const shift = Math.floor(no);
      offset.current = no - shift;
      const ns = Math.max(0, Math.min(candles.length - n, range.s - shift));
      setRange({ s: ns, e: ns + n - 1 });
      setHover(null);
      return;
    }
    const n = range.e - range.s + 1;
    const idx = Math.floor(mx / (rect.width / n));
    if (idx >= 0 && idx < n) setHover({ x: mx, y: my, i: idx });
    else setHover(null);
  };

  const onUp = () => {
    if (!drag.current.on) return;
    const v = drag.current.vx;
    drag.current.on = false;
    if (Math.abs(v) > 0.3) {
      const n = range.e - range.s + 1;
      setRange(p => {
        const ns = Math.max(0, Math.min(candles.length - n, p.s - Math.round(v * 10)));
        return { s: ns, e: ns + n - 1 };
      });
    }
  };

  const onLeave = () => { drag.current.on = false; setHover(null); };

  const tStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinch.current = { on: true, d0: d, n0: range.e - range.s + 1 };
      drag.current.on = false;
      return;
    }
    drag.current = { on: true, x0: e.touches[0].clientX, o0: offset.current, vx: 0, lx: e.touches[0].clientX, lt: performance.now() };
  };

  const tMove = (e: React.TouchEvent) => {
    const wrap = wrapRef.current;
    if (!wrap || !candles.length) return;
    if (pinch.current.on && e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const scale = pinch.current.d0 / d;
      const nn = Math.max(10, Math.min(candles.length, Math.round(pinch.current.n0 * scale)));
      const mid = (range.s + range.e) / 2;
      const half = nn / 2;
      setRange({ s: Math.max(0, Math.min(candles.length - nn, Math.round(mid - half))), e: Math.max(0, Math.min(candles.length - 1, Math.round(mid + half))) });
      return;
    }
    if (drag.current.on && e.touches.length === 1) {
      const rect = wrap.getBoundingClientRect();
      const W = rect.width;
      const n = range.e - range.s + 1;
      const dx = e.touches[0].clientX - drag.current.x0;
      const no = drag.current.o0 + dx / (W / n);
      const now = performance.now();
      const dt = now - drag.current.lt;
      if (dt > 0) drag.current.vx = (e.touches[0].clientX - drag.current.lx) / dt;
      drag.current.lx = e.touches[0].clientX; drag.current.lt = now;
      const shift = Math.floor(no);
      offset.current = no - shift;
      const ns = Math.max(0, Math.min(candles.length - n, range.s - shift));
      setRange({ s: ns, e: ns + n - 1 });
    }
  };

  const tEnd = () => {
    if (pinch.current.on) { pinch.current.on = false; return; }
    if (!drag.current.on) return;
    const v = drag.current.vx;
    drag.current.on = false;
    if (Math.abs(v) > 0.3) {
      const n = range.e - range.s + 1;
      setRange(p => {
        const ns = Math.max(0, Math.min(candles.length - n, p.s - Math.round(v * 10)));
        return { s: ns, e: ns + n - 1 };
      });
    }
  };

  /* ═════════════════════════════════════════════════════════════════════════
     DRAW — optimized for 60fps
     ═════════════════════════════════════════════════════════════════════════ */
  const draw = useCallback(() => {
    const cvs = cvsRef.current;
    const wrap = wrapRef.current;
    if (!cvs || !wrap) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    cvs.width = W * dpr;
    cvs.height = H * dpr;
    ctx.scale(dpr, dpr);

    const AXIS_W = 70;
    const XL = 0, XR = W - AXIS_W, CW = XR - XL;
    const YT = 0, YB = H, CH = YB - YT;

    if (candles.length < 2) return;

    const viS = Math.max(0, range.s);
    const viE = Math.min(candles.length - 1, range.e);
    const vC = candles.slice(viS, viE + 1);
    if (!vC.length) return;
    const vN = vC.length;

    /* ── Background ───────────────────────────────────────────────── */
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    /* ── Dynamic Y-Axis Scaling (Auto-Fit Visible Candles Only) ───── */
    let hi = -Infinity, lo = Infinity;
    for (let i = 0; i < vN; i++) {
      const c = vC[i];
      if (c.high > hi) hi = c.high;
      if (c.low < lo) lo = c.low;
    }
    if (livePrice > hi) hi = livePrice;
    if (livePrice < lo) lo = livePrice;
    
    // Add 5% padding to top and bottom
    const rangeP = hi - lo || 1;
    hi += rangeP * 0.05;
    lo -= rangeP * 0.05;
    const PR = hi - lo;

    /* ── Candle Geometry (6-8px width, fixed 4px gap, no overlap) ─── */
    const CANDLE_GAP = 4;
    const MAX_CANDLE_WIDTH = 8;
    const MIN_CANDLE_WIDTH = 6;
    const availableSpace = CW - (vN - 1) * CANDLE_GAP;
    const CANDLE_WIDTH = Math.max(MIN_CANDLE_WIDTH, Math.min(MAX_CANDLE_WIDTH, availableSpace / vN));
    const TOTAL_CANDLE_WIDTH = CANDLE_WIDTH + CANDLE_GAP;
    
    const xAt = (i: number) => XL + 10 + i * TOTAL_CANDLE_WIDTH;
    const yAt = (p: number) => YT + ((hi - p) / PR) * CH;

    /* ═════════════════════════════════════════════════════════════════
       HORIZONTAL GRID LINES ONLY (No vertical grid)
       ═════════════════════════════════════════════════════════════════ */
    ctx.font = '10px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.textBaseline = "middle";

    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = snap(YT + (CH * i) / gridLines);
      const v = hi - (PR * i) / gridLines;
      
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(XL, y);
      ctx.lineTo(XR, y);
      ctx.stroke();
      
      // Y-axis labels
      ctx.fillStyle = C.axisLabel;
      ctx.textAlign = "right";
      ctx.fillText(formatPrice(v), XR - 8, y);
    }

    // Y-axis boundary line
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(XR, YT);
    ctx.lineTo(XR, YB);
    ctx.stroke();

    /* ═════════════════════════════════════════════════════════════════
       CANDLES — Pixel-Perfect Geometry
       ═════════════════════════════════════════════════════════════════ */
    for (let i = 0; i < vN; i++) {
      const c = vC[i];
      const candleX = xAt(i);
      const isUp = c.close >= c.open;
      
      const yOpen = yAt(c.open);
      const yClose = yAt(c.close);
      const yHigh = yAt(c.high);
      const yLow = yAt(c.low);
      
      const bodyTop = Math.min(yOpen, yClose);
      const bodyBot = Math.max(yOpen, yClose);
      const bodyH = Math.max(1, bodyBot - bodyTop);
      
      const candleLeft = Math.floor(candleX);
      
      // Wick — centered on candle body: Wick_X = Candle_X + (Candle_Width / 2)
      const wickX = snap(candleX + CANDLE_WIDTH / 2);
      ctx.strokeStyle = isUp ? C.bullish : C.bearish;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wickX, snap(yHigh));
      ctx.lineTo(wickX, snap(yLow));
      ctx.stroke();
      
      // Body
      ctx.fillStyle = isUp ? C.bullish : C.bearish;
      ctx.fillRect(candleLeft, Math.floor(bodyTop), CANDLE_WIDTH, Math.floor(bodyH));
    }

    /* ═════════════════════════════════════════════════════════════════
       HORIZONTAL DOTTED LIVE PRICE LINE
       ═════════════════════════════════════════════════════════════════ */
    const lpY = yAt(livePrice);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = C.livePriceLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(XL, snap(lpY));
    ctx.lineTo(XR, snap(lpY));
    ctx.stroke();
    ctx.setLineDash([]);

    /* ═════════════════════════════════════════════════════════════════
       ENTRY LINES — dotted lines for active trades
       ═════════════════════════════════════════════════════════════════ */
    for (let i = 0; i < trades.length; i++) {
      const tr = trades[i];
      const ey = yAt(tr.entryPrice);
      if (ey < YT || ey > YB) continue;

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = tr.type === 'UP' ? C.bullish : C.bearish;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(XL, snap(ey));
      ctx.lineTo(XR, snap(ey));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    /* ═════════════════════════════════════════════════════════════════
       CROSSHAIR — on hover
       ═════════════════════════════════════════════════════════════════ */
    if (hover && hover.i >= 0 && hover.i < vN) {
      const hc = vC[hover.i];
      const cx = xAt(hover.i);
      const cy = hover.y;

      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = C.crosshair;
      ctx.lineWidth = 1;

      // Vertical through candle
      ctx.beginPath();
      ctx.moveTo(snap(cx), YT);
      ctx.lineTo(snap(cx), YB);
      ctx.stroke();

      // Horizontal through cursor
      if (cy >= YT && cy <= YB) {
        ctx.beginPath();
        ctx.moveTo(XL, snap(cy));
        ctx.lineTo(XR, snap(cy));
        ctx.stroke();

        // Price label on Y-axis
        const cp = hi - ((cy - YT) / CH) * PR;
        const cpl = formatPrice(cp);
        ctx.setLineDash([]);
        ctx.font = '10px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
        const cw = ctx.measureText(cpl).width + 12;
        ctx.fillStyle = "rgba(28, 32, 38, 0.95)";
        ctx.fillRect(XR - cw - 4, Math.round(cy) - 10, cw, 20);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(cpl, XR - 8, cy);
      }
      ctx.setLineDash([]);
    }
  }, [candles, livePrice, trades, hover, range]);

  useEffect(() => { draw(); }, [draw]);
  
  // Force re-render when visible range changes
  useEffect(() => {
    draw();
  }, [range]);
  
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, [draw]);
  useEffect(() => {
    const iv = setInterval(() => draw(), 100);
    return () => clearInterval(iv);
  }, [draw]);

  const handleZoomIn = () => {
    setRange(p => {
      const n = p.e - p.s + 1;
      const nn = Math.max(10, Math.floor(n * 0.7));
      const shrink = n - nn;
      const sOff = Math.floor(shrink * 0.5);
      return {
        s: Math.max(0, p.s + sOff),
        e: Math.min(candles.length - 1, p.e - (shrink - sOff)),
      };
    });
  };

  const handleZoomOut = () => {
    setRange(p => {
      const n = p.e - p.s + 1;
      const nn = Math.min(candles.length, Math.floor(n * 1.4));
      const grow = nn - n;
      const sOff = Math.floor(grow * 0.5);
      return {
        s: Math.max(0, p.s - sOff),
        e: Math.min(candles.length - 1, p.e + (grow - sOff)),
      };
    });
  };

  return (
    <div
      ref={wrapRef}
      className="w-full h-full relative select-none"
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onLeave}
      onTouchStart={tStart}
      onTouchMove={tMove}
      onTouchEnd={tEnd}
      style={{ cursor: drag.current.on ? "grabbing" : hover ? "crosshair" : "default" }}
    >
      <canvas ref={cvsRef} className="absolute inset-0" />
      
      {/* Minimalist Transparent Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-9 h-9 bg-black/30 backdrop-blur-sm border border-white/10 rounded-lg flex items-center justify-center text-white hover:bg-black/40 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-9 h-9 bg-black/30 backdrop-blur-sm border border-white/10 rounded-lg flex items-center justify-center text-white hover:bg-black/40 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChartCanvas;
