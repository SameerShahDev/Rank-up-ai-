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

interface ChartProps {
  candles: Candle[];
  livePrice: number;
  trades: Trade[];
  activeTrade: Trade | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HEIKIN ASHI
   ═══════════════════════════════════════════════════════════════════════════ */
interface HA { t: number; o: number; h: number; l: number; c: number }

function heikinAshi(src: Candle[]): HA[] {
  if (!src.length) return [];
  const out: HA[] = [];
  out.push({ t: src[0].time, o: src[0].open, h: src[0].high, l: src[0].low, c: src[0].close });
  for (let i = 1; i < src.length; i++) {
    const s = src[i], p = out[i - 1];
    const c = (s.open + s.high + s.low + s.close) / 4;
    const o = (p.o + p.c) / 2;
    out.push({ t: s.time, o, h: Math.max(s.high, o, c), l: Math.min(s.low, o, c), c });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════════════════ */
const T = {
  // Backgrounds
  bg:          "#111119",
  bgTop:       "#16161f",
  bgBot:       "#0d0d14",

  // Grid
  gridH:       "rgba(255,255,255,0.028)",
  gridV:       "rgba(255,255,255,0.022)",
  gridAxis:    "rgba(255,255,255,0.06)",

  // Text
  txtDim:      "rgba(120,130,160,0.35)",
  txtMid:      "rgba(150,160,185,0.5)",
  txtBright:   "rgba(200,210,225,0.8)",

  // Bullish — vibrant neon green
  bull:        "#00ff88",
  bullBody:    "#00e676",
  bullWick:    "rgba(0,255,136,0.7)",
  bullGlow:    "rgba(0,255,136,0.04)",
  bullFill:    "rgba(0,255,136,0.06)",

  // Bearish — muted red
  bear:        "#e63946",
  bearBody:    "#c62828",
  bearWick:    "rgba(230,57,70,0.7)",
  bearGlow:    "rgba(230,57,70,0.04)",
  bearFill:    "rgba(230,57,70,0.06)",

  // Entry
  entryLine:   "#00ff88",
  entryTag:    "#ffd60a",

  // Timer
  timerLine:   "#e63946",

  // Expire
  expireLine:  "#ff5252",

  // Crosshair
  cross:       "rgba(150,160,185,0.18)",

  // Tooltip
  tipBg:       "rgba(12,14,22,0.96)",
  tipBorder:   "rgba(255,255,255,0.06)",

  // Price tag
  tagBg:       "#00ff88",
  tagText:     "#111119",

  // Live price
  liveUp:      "#00ff88",
  liveDown:    "#e63946",
};

/* ═══════════════════════════════════════════════════════════════════════════
   FORMATTERS
   ═══════════════════════════════════════════════════════════════════════════ */
const fmt = {
  price(v: number): string {
    return v.toFixed(8);
  },
  axis(v: number): string {
    if (v >= 1e6) return (v / 1e5).toFixed(1) + "L";
    if (v >= 1e4) return (v / 1e3).toFixed(1) + "K";
    if (v >= 1e3) return v.toFixed(1);
    if (v >= 100) return v.toFixed(2);
    if (v >= 1) return v.toFixed(3);
    return v.toFixed(4);
  },
  time(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  },
  date(ts: number): string {
    const d = new Date(ts);
    return `${d.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]}`;
  },
  countdown(s: number): string {
    const n = Math.max(0, Math.floor(s));
    return `:${String(n).padStart(2, "0")}`;
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   GRID STEP CALCULATOR
   ═══════════════════════════════════════════════════════════════════════════ */
function gridStep(range: number, target: number): number {
  const rough = range / target;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const n = rough / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DRAW HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Snap to pixel for crisp 1px lines */
const snap = (v: number) => Math.round(v) + 0.5;

/** Rounded rect path */
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHART CANVAS — MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const ChartCanvas: React.FC<ChartProps> = ({ candles, livePrice, trades, activeTrade }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvsRef = useRef<HTMLCanvasElement>(null);

  // Viewport
  const [range, setRange] = useState({ s: 0, e: 0 });
  // Hover
  const [mv, setMv] = useState<{ x: number; y: number; i: number } | null>(null);
  // Animation
  const pulse = useRef(0);
  const raf = useRef(0);
  // Drag state (smooth sub-candle precision + momentum)
  const drag = useRef({
    on: false,
    x0: 0,
    offset0: 0,       // fractional candle offset for smooth panning
    vel: 0,           // velocity for momentum
    lastX: 0,
    lastT: 0,
  });
  // Fractional offset for sub-candle smooth panning
  const offsetRef = useRef(0);
  // Touch pinch state
  const pinch = useRef({ active: false, dist0: 0, count0: 0 });

  /* ── Animation loop ─────────────────────────────────────────────── */
  useEffect(() => {
    let run = true;
    const tick = () => {
      if (!run) return;
      pulse.current = (pulse.current + 0.05) % (Math.PI * 2);
      raf.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { run = false; cancelAnimationFrame(raf.current); };
  }, []);

  /* ── Init / update visible range ────────────────────────────────── */
  useEffect(() => {
    if (!candles.length) return;
    setRange(prev => {
      if (prev.s === 0 && prev.e === 0) {
        const n = Math.min(80, candles.length);
        return { s: candles.length - n, e: candles.length - 1 };
      }
      if (prev.e >= candles.length - 2) {
        const n = prev.e - prev.s + 1;
        return { s: candles.length - n, e: candles.length - 1 };
      }
      return prev;
    });
  }, [candles.length]);

  /* ── Wheel: scroll = zoom, shift+scroll = pan ───────────────────── */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const isZoom = !e.shiftKey; // default scroll = zoom
      setRange(p => {
        const n = p.e - p.s + 1;
        if (isZoom) {
          // Zoom toward cursor position
          const rect = el.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const PW = 60;
          const cR = rect.width - PW;
          const ratio = Math.min(1, Math.max(0, mouseX / cR));
          const delta = e.deltaY > 0 ? 3 : -3;
          const nn = Math.max(12, Math.min(candles.length, n + delta));
          const shrink = n - nn;
          const sOff = Math.round(shrink * ratio);
          const eOff = shrink - sOff;
          return {
            s: Math.max(0, p.s + sOff),
            e: Math.min(candles.length - 1, p.e - eOff),
          };
        } else {
          // Pan horizontally
          const d = e.deltaY > 0 ? 4 : -4;
          const ns = Math.max(0, Math.min(candles.length - n, p.s + d));
          return { s: ns, e: ns + n - 1 };
        }
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [candles.length]);

  /* ── Mouse handlers — smooth drag + momentum ────────────────────── */
  const onDown = (e: React.MouseEvent) => {
    const n = range.e - range.s + 1;
    drag.current = {
      on: true,
      x0: e.clientX,
      offset0: offsetRef.current,
      vel: 0,
      lastX: e.clientX,
      lastT: performance.now(),
    };
  };

  const onMove = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap || !candles.length) return;
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (drag.current.on) {
      const PW = 60;
      const cR = rect.width - PW;
      const n = range.e - range.s + 1;
      const slotW = cR / n;
      const dx = e.clientX - drag.current.x0;
      const newOffset = drag.current.offset0 + dx / slotW;

      // Track velocity for momentum
      const now = performance.now();
      const dt = now - drag.current.lastT;
      if (dt > 0) {
        drag.current.vel = (e.clientX - drag.current.lastX) / dt;
      }
      drag.current.lastX = e.clientX;
      drag.current.lastT = now;

      // Apply offset as fractional scroll
      const shift = Math.floor(newOffset);
      offsetRef.current = newOffset - shift;
      const ns = Math.max(0, Math.min(candles.length - n, range.s - shift));
      setRange({ s: ns, e: ns + n - 1 });
      setMv(null);
      return;
    }

    // Hover
    const idx = Math.floor(mx / (cR / n));
    if (idx >= 0 && idx < n && mx <= cR) {
      setMv({ x: mx, y: my, i: idx });
    } else {
      setMv(null);
    }
  };

  const onUp = () => {
    if (!drag.current.on) return;
    // Apply momentum
    const vel = drag.current.vel;
    drag.current.on = false;
    if (Math.abs(vel) > 0.3) {
      const n = range.e - range.s + 1;
      const momentum = Math.round(vel * 8);
      setRange(p => {
        const ns = Math.max(0, Math.min(candles.length - n, p.s - momentum));
        return { s: ns, e: ns + n - 1 };
      });
    }
  };

  const onLeave = () => { drag.current.on = false; setMv(null); };

  /* ── Touch handlers — drag + pinch-to-zoom ──────────────────────── */
  const tStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinch.current = { active: true, dist0: Math.hypot(dx, dy), count0: range.e - range.s + 1 };
      drag.current.on = false;
      return;
    }
    drag.current = {
      on: true,
      x0: e.touches[0].clientX,
      offset0: offsetRef.current,
      vel: 0,
      lastX: e.touches[0].clientX,
      lastT: performance.now(),
    };
  };

  const tMove = (e: React.TouchEvent) => {
    const wrap = wrapRef.current;
    if (!wrap || !candles.length) return;
    const rect = wrap.getBoundingClientRect();

    // Pinch zoom
    if (pinch.current.active && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = pinch.current.dist0 / dist;
      const newN = Math.max(12, Math.min(candles.length, Math.round(pinch.current.count0 * scale)));
      const mid = (range.s + range.e) / 2;
      const half = newN / 2;
      const ns = Math.max(0, Math.min(candles.length - newN, Math.round(mid - half)));
      setRange({ s: ns, e: ns + newN - 1 });
      return;
    }

    // Single finger drag
    if (drag.current.on && e.touches.length === 1) {
      const t = e.touches[0];
      const PW = 60;
      const cR = rect.width - PW;
      const n = range.e - range.s + 1;
      const slotW = cR / n;
      const dx = t.clientX - drag.current.x0;
      const newOffset = drag.current.offset0 + dx / slotW;

      // Track velocity
      const now = performance.now();
      const dt = now - drag.current.lastT;
      if (dt > 0) {
        drag.current.vel = (t.clientX - drag.current.lastX) / dt;
      }
      drag.current.lastX = t.clientX;
      drag.current.lastT = now;

      const shift = Math.floor(newOffset);
      offsetRef.current = newOffset - shift;
      const ns = Math.max(0, Math.min(candles.length - n, range.s - shift));
      setRange({ s: ns, e: ns + n - 1 });
    }
  };

  const tEnd = (e: React.TouchEvent) => {
    if (pinch.current.active) {
      pinch.current.active = false;
      return;
    }
    if (!drag.current.on) return;
    const vel = drag.current.vel;
    drag.current.on = false;
    if (Math.abs(vel) > 0.3) {
      const n = range.e - range.s + 1;
      const momentum = Math.round(vel * 8);
      setRange(p => {
        const ns = Math.max(0, Math.min(candles.length - n, p.s - momentum));
        return { s: ns, e: ns + n - 1 };
      });
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  const draw = useCallback(() => {
    const cvs = cvsRef.current;
    const wrap = wrapRef.current;
    if (!cvs || !wrap) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    /* ── Canvas sizing ────────────────────────────────────────────── */
    const W = wrap.clientWidth || 800;
    const H = wrap.clientHeight || 500;
    const dpr = window.devicePixelRatio || 1;
    cvs.width = W * dpr;
    cvs.height = H * dpr;
    ctx.scale(dpr, dpr);

    /* ── Layout constants ─────────────────────────────────────────── */
    const AXIS_W = 60;
    const TIME_H = 22;
    const cL = 0;
    const cR = W - AXIS_W;
    const cW = cR - cL;
    const cT = 0;
    const cB = H - TIME_H;
    const cH = cB - cT;

    /* ── Background ───────────────────────────────────────────────── */
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, T.bgTop);
    bg.addColorStop(0.45, T.bg);
    bg.addColorStop(1, T.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Very subtle center radial glow
    const rg = ctx.createRadialGradient(cW * 0.5, cH * 0.4, 0, cW * 0.5, cH * 0.4, cW * 0.55);
    rg.addColorStop(0, "rgba(0,255,136,0.008)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    if (candles.length < 2) return;

    /* ── Heikin Ashi + visible window ─────────────────────────────── */
    const ha = heikinAshi(candles);
    const vS = Math.max(0, range.s);
    const vE = Math.min(candles.length - 1, range.e);
    const vHA = ha.slice(vS, vE + 1);
    const vC = candles.slice(vS, vE + 1);
    if (!vHA.length) return;
    const vN = vHA.length;

    /* ── Price range ──────────────────────────────────────────────── */
    let hi = -Infinity, lo = Infinity;
    for (const c of vHA) { if (c.h > hi) hi = c.h; if (c.l < lo) lo = c.l; }
    if (livePrice > hi) hi = livePrice;
    if (livePrice < lo) lo = livePrice;
    for (const t of trades) {
      if (t.entryPrice > hi) hi = t.entryPrice;
      if (t.entryPrice < lo) lo = t.entryPrice;
    }
    const pad = (hi - lo || 1) * 0.1;
    hi += pad; lo -= pad;
    const pR = hi - lo;

    /* ── Scaling ──────────────────────────────────────────────────── */
    const slot = cW / vN;
    const bW = Math.max(3, Math.min(14, Math.floor(slot * 0.58)));
    const xAt = (i: number) => cL + (i + 0.5) * slot;
    const yAt = (p: number) => cT + ((hi - p) / pR) * cH;

    /* ════════════════════════════════════════════════════════════════
       GRID LINES
       ════════════════════════════════════════════════════════════════ */
    const step = gridStep(pR, 6);
    const g0 = Math.ceil(lo / step) * step;

    // Horizontal grid (price)
    ctx.font = '9px "SF Mono",ui-monospace,Menlo,Consolas,monospace';
    ctx.textBaseline = "middle";
    for (let v = g0; v <= hi; v += step) {
      const y = snap(yAt(v));
      if (y < cT || y > cB) continue;
      ctx.strokeStyle = T.gridH;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(cL, y); ctx.lineTo(cR, y); ctx.stroke();
      ctx.fillStyle = T.txtDim;
      ctx.textAlign = "left";
      ctx.fillText(fmt.axis(v), cR + 6, y);
    }

    // Vertical grid (time)
    const tStep = Math.max(1, Math.floor(vN / 6));
    for (let i = 0; i < vN; i += tStep) {
      const x = snap(xAt(i));
      if (x < cL || x > cR) continue;
      ctx.strokeStyle = T.gridV;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, cT); ctx.lineTo(x, cB); ctx.stroke();
      ctx.fillStyle = T.txtDim;
      ctx.textAlign = "center";
      ctx.fillText(fmt.time(vC[i].time), xAt(i), H - TIME_H + 13);
    }

    // Axis separator lines
    ctx.strokeStyle = T.gridAxis;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(cL, snap(cB)); ctx.lineTo(cR, snap(cB)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(snap(cR), cT); ctx.lineTo(snap(cR), cB); ctx.stroke();

    /* ════════════════════════════════════════════════════════════════
       HEIKIN ASHI CANDLES
       ════════════════════════════════════════════════════════════════ */
    for (let i = 0; i < vN; i++) {
      const c = vHA[i];
      const x = xAt(i);
      const up = c.c >= c.o;
      const yO = yAt(c.o), yC = yAt(c.c);
      const yH = yAt(c.h), yL = yAt(c.l);
      const bTop = Math.min(yO, yC);
      const bBot = Math.max(yO, yC);
      const bH = Math.max(1, bBot - bTop);
      const l = Math.floor(x - bW / 2);

      // Candle glow aura
      if (bW > 5) {
        const gs = bW + 10;
        const gg = ctx.createRadialGradient(x, (bTop + bBot) / 2, 0, x, (bTop + bBot) / 2, gs);
        gg.addColorStop(0, up ? T.bullGlow : T.bearGlow);
        gg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gg;
        ctx.fillRect(x - gs, bTop - gs / 2, gs * 2, bH + gs);
      }

      // Wick
      ctx.strokeStyle = up ? T.bullWick : T.bearWick;
      ctx.lineWidth = Math.max(1, bW * 0.12);
      ctx.beginPath();
      ctx.moveTo(snap(x), Math.round(yH));
      ctx.lineTo(snap(x), Math.round(yL));
      ctx.stroke();

      // Body gradient
      const bg2 = ctx.createLinearGradient(0, bTop, 0, bTop + bH);
      if (up) {
        bg2.addColorStop(0, T.bull);
        bg2.addColorStop(1, T.bullBody);
      } else {
        bg2.addColorStop(0, T.bearBody);
        bg2.addColorStop(1, T.bear);
      }
      ctx.fillStyle = bg2;
      ctx.fillRect(l, Math.floor(bTop), bW, Math.max(1, Math.floor(bH)));

      // Subtle body border
      if (bW > 4) {
        ctx.strokeStyle = up ? "rgba(0,255,136,0.18)" : "rgba(230,57,70,0.18)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(l, Math.floor(bTop), bW, Math.max(1, Math.floor(bH)));
      }
    }

    /* ════════════════════════════════════════════════════════════════
       LIVE PRICE — DOTTED LINE + PULSE + TAG
       ════════════════════════════════════════════════════════════════ */
    const lpY = yAt(livePrice);
    const lpUp = livePrice >= (vHA[vHA.length - 1]?.o ?? livePrice);
    const lpCol = lpUp ? T.liveUp : T.liveDown;
    const pa = 0.1 + Math.sin(pulse.current) * 0.05;

    // Glow band
    const bandH = 30;
    const band = ctx.createLinearGradient(0, lpY - bandH, 0, lpY + bandH);
    const gb = lpUp ? "0,255,136" : "230,57,70";
    band.addColorStop(0, `rgba(${gb},0)`);
    band.addColorStop(0.5, `rgba(${gb},${pa})`);
    band.addColorStop(1, `rgba(${gb},0)`);
    ctx.fillStyle = band;
    ctx.fillRect(cL, lpY - bandH, cW, bandH * 2);

    // Dotted line
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = lpCol;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(cL, snap(lpY)); ctx.lineTo(cR, snap(lpY)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Price tag — right axis
    const pTag = fmt.price(livePrice);
    ctx.font = 'bold 9px "SF Mono",ui-monospace,Menlo,monospace';
    const pTW = Math.round(ctx.measureText(pTag).width) + 12;
    const pTH = 18;
    const pTX = cR + 1;
    const pTY = Math.round(lpY - pTH / 2);

    ctx.fillStyle = lpCol;
    rrect(ctx, pTX, pTY, pTW, pTH, 3);
    ctx.fill();

    // Arrow triangle
    ctx.beginPath();
    ctx.moveTo(pTX, lpY);
    ctx.lineTo(pTX - 4, lpY - 3.5);
    ctx.lineTo(pTX - 4, lpY + 3.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(pTag, pTX + 6, lpY);

    /* ════════════════════════════════════════════════════════════════
       ENTRY TRADE LINES — DOTTED GREEN + YELLOW TAG
       ════════════════════════════════════════════════════════════════ */
    for (const tr of trades) {
      const ey = yAt(tr.entryPrice);
      if (ey < cT || ey > cB) continue;

      // Dotted green line
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = T.entryLine;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.65;
      ctx.beginPath(); ctx.moveTo(cL, snap(ey)); ctx.lineTo(cR, snap(ey)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Yellow tag
      const txt = `${tr.amount} \u20b9`;
      ctx.font = 'bold 10px "SF Mono",ui-monospace,Menlo,monospace';
      const tW = Math.round(ctx.measureText(txt).width);
      const padX = 7;
      const tagH = 17;
      const tagFull = tW + padX * 2 + 12;
      const tagX = cL + 5;
      const tagY = Math.round(ey) - tagH / 2;

      // Tag body
      ctx.fillStyle = T.entryTag;
      ctx.beginPath();
      ctx.moveTo(tagX + 3, tagY);
      ctx.lineTo(tagX + tagFull - 3, tagY);
      ctx.arcTo(tagX + tagFull, tagY, tagX + tagFull, tagY + 3, 3);
      ctx.lineTo(tagX + tagFull, tagY + tagH - 3);
      ctx.arcTo(tagX + tagFull, tagY + tagH, tagX + tagFull - 3, tagY + tagH, 3);
      ctx.lineTo(tagX + tagFull - 6, tagY + tagH);
      // Arrow notch
      ctx.lineTo(tagX + tagFull, tagY + tagH / 2);
      ctx.lineTo(tagX + tagFull - 6, tagY);
      ctx.lineTo(tagX + 3, tagY);
      ctx.arcTo(tagX, tagY, tagX, tagY + 3, 3);
      ctx.closePath();
      ctx.fill();

      // Text
      ctx.fillStyle = "#111119";
      ctx.font = 'bold 10px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, tagX + padX + 4, ey);
    }

    /* ════════════════════════════════════════════════════════════════
       TIMER — DOTTED VERTICAL RED LINE + COUNTDOWN CIRCLE
       ════════════════════════════════════════════════════════════════ */
    if (activeTrade && activeTrade.timeLeft > 0) {
      const prog = 1 - activeTrade.timeLeft / activeTrade.duration;
      const tx = cR * 0.6;

      // Dotted vertical red
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = T.timerLine;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.moveTo(snap(tx), cT); ctx.lineTo(snap(tx), cB); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Countdown circle
      const cr = 17;
      const cy = cT + 32;

      // Glow
      const cg = ctx.createRadialGradient(tx, cy, cr - 2, tx, cy, cr + 12);
      cg.addColorStop(0, "rgba(230,57,70,0.18)");
      cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cg;
      ctx.fillRect(tx - cr - 12, cy - cr - 12, (cr + 12) * 2, (cr + 12) * 2);

      // Dark fill
      ctx.beginPath();
      ctx.arc(tx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(14,14,22,0.95)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Track ring
      ctx.beginPath();
      ctx.arc(tx, cy, cr - 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Progress arc
      ctx.beginPath();
      ctx.arc(tx, cy, cr - 2, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
      ctx.strokeStyle = T.timerLine;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.lineCap = "butt";

      // Text
      ctx.fillStyle = "#fff";
      ctx.font = 'bold 11px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fmt.countdown(activeTrade.timeLeft), tx, cy);
    }

    /* ════════════════════════════════════════════════════════════════
       EXPIRY — SOLID VERTICAL RED LINE
       ════════════════════════════════════════════════════════════════ */
    if (activeTrade && activeTrade.timeLeft > 0) {
      const ex = cR * 0.82;

      ctx.strokeStyle = T.expireLine;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(snap(ex), cT); ctx.lineTo(snap(ex), cB); ctx.stroke();
      ctx.globalAlpha = 1;

      // Label
      ctx.fillStyle = T.expireLine;
      ctx.font = '8px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.globalAlpha = 0.75;
      ctx.fillText("EXPIRY", ex, cT + 12);
      ctx.globalAlpha = 1;
    }

    /* ════════════════════════════════════════════════════════════════
       CROSSHAIR + TOOLTIP
       ════════════════════════════════════════════════════════════════ */
    if (mv && mv.i >= 0 && mv.i < vN) {
      const cx = xAt(mv.i);
      const cy = mv.y;

      // Vertical line
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = T.cross;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(snap(cx), cT); ctx.lineTo(snap(cx), cB); ctx.stroke();

      // Horizontal line
      if (cy >= cT && cy <= cB) {
        ctx.beginPath(); ctx.moveTo(cL, snap(cy)); ctx.lineTo(cR, snap(cy)); ctx.stroke();

        // Price label on axis
        const cp = hi - ((cy - cT) / cH) * pR;
        const cpL = fmt.price(cp);
        ctx.setLineDash([]);
        ctx.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
        const cw = Math.round(ctx.measureText(cpL).width) + 10;
        ctx.fillStyle = "rgba(20,22,35,0.95)";
        rrect(ctx, cR + 1, Math.round(cy) - 9, cw, 18, 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(cpL, cR + 6, cy);
      }
      ctx.setLineDash([]);

      // Time label at bottom
      const tl = fmt.time(vC[mv.i].time);
      const dl = fmt.date(vC[mv.i].time);
      const tlW = 72;
      ctx.fillStyle = "rgba(20,22,35,0.95)";
      rrect(ctx, cx - tlW / 2, H - TIME_H, tlW, TIME_H, 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${dl} ${tl}`, cx, H - TIME_H + 11);

      // Highlight candle outline
      const hc = vHA[mv.i];
      const hcUp = hc.c >= hc.o;
      ctx.strokeStyle = hcUp ? T.bull : T.bear;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.45;
      const hcBT = Math.min(yAt(hc.o), yAt(hc.c));
      const hcBB = Math.max(yAt(hc.o), yAt(hc.c));
      ctx.strokeRect(Math.floor(cx - bW / 2) - 1, Math.floor(hcBT) - 1, bW + 2, Math.max(1, Math.floor(hcBB - hcBT)) + 2);
      ctx.globalAlpha = 1;

      /* ── OHLC Tooltip ─────────────────────────────────────────── */
      const isUp = hc.c >= hc.o;
      const chg = ((hc.c - hc.o) / hc.o) * 100;
      const tipW = 152, tipH = 106;
      let tipX = mv.x + 14;
      let tipY = cT + 10;
      if (tipX + tipW > cR - 8) tipX = mv.x - tipW - 14;
      if (tipY + tipH > cB - 8) tipY = cB - tipH - 8;

      ctx.fillStyle = T.tipBg;
      ctx.strokeStyle = T.tipBorder;
      ctx.lineWidth = 1;
      rrect(ctx, tipX, tipY, tipW, tipH, 5);
      ctx.fill();
      ctx.stroke();

      // Accent bar
      ctx.fillStyle = isUp ? T.bull : T.bear;
      ctx.fillRect(tipX + 1, tipY + 1, tipW - 2, 2);

      let ty = tipY + 9;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      // Date + time
      ctx.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.fillStyle = T.txtDim;
      ctx.fillText(`${fmt.date(vC[mv.i].time)} ${fmt.time(vC[mv.i].time)}`, tipX + 10, ty);
      ty += 13;

      // Label + change
      ctx.fillStyle = isUp ? T.bull : T.bear;
      ctx.font = 'bold 10px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.fillText(`Heikin Ashi  ${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`, tipX + 10, ty);
      ty += 16;

      // OHLC
      const items: [string, number, string][] = [
        ["O", hc.o, T.txtBright],
        ["H", hc.h, T.bull],
        ["L", hc.l, T.bear],
        ["C", hc.c, isUp ? T.bull : T.bear],
      ];
      for (const [lbl, val, col] of items) {
        ctx.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
        ctx.fillStyle = T.txtDim;
        ctx.fillText(lbl, tipX + 10, ty);
        ctx.fillStyle = col;
        ctx.font = 'bold 10px "SF Mono",ui-monospace,Menlo,monospace';
        ctx.fillText(fmt.price(val), tipX + 22, ty);
        ty += 13;
      }
    }

    /* ── Scroll indicator ────────────────────────────────────────── */
    if (candles.length > vN) {
      const sbW = cW * 0.3;
      const sbH = 2;
      const sbX = cW / 2 - sbW / 2;
      const sbY = H - 3;
      const tw2 = (vN / candles.length) * sbW;
      const tx2 = sbX + (vS / candles.length) * sbW;
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(sbX, sbY, sbW, sbH);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(tx2, sbY, tw2, sbH);
    }
  }, [candles, livePrice, trades, activeTrade, mv, range]);

  /* ── Effects ────────────────────────────────────────────────────── */
  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, [draw]);
  useEffect(() => {
    const iv = setInterval(() => draw(), 80);
    return () => clearInterval(iv);
  }, [draw]);

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
      style={{ cursor: drag.current.on ? "grabbing" : mv ? "crosshair" : "default" }}
    >
      <canvas ref={cvsRef} className="absolute inset-0" />
    </div>
  );
};

export default ChartCanvas;
