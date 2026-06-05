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
   HEIKIN ASHI — pre-computed outside draw loop
   ═══════════════════════════════════════════════════════════════════════════ */
interface HA { t: number; o: number; h: number; l: number; c: number }

let haCache: HA[] = [];

function computeHA(src: Candle[]): HA[] {
  if (!src.length) return [];
  const out: HA[] = [{ t: src[0].time, o: src[0].open, h: src[0].high, l: src[0].low, c: src[0].close }];
  for (let i = 1; i < src.length; i++) {
    const p = out[i - 1], s = src[i];
    const c = (s.open + s.high + s.low + s.close) / 4;
    const o = (p.o + p.c) / 2;
    out.push({ t: s.time, o, h: Math.max(s.high, o, c), l: Math.min(s.low, o, c), c });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Figma "Adaptive Trading Chart" spec
   ═══════════════════════════════════════════════════════════════════════════ */
const C = {
  bg:          "#12161A",
  bgTop:       "#181E24",
  bgBot:       "#0E1114",

  grid:        "rgba(42,46,57,0.15)",
  axisLine:    "rgba(42,46,57,0.35)",
  axisLabel:   "rgba(130,144,170,0.45)",

  bullWick:    "#00ff88",
  bullBody:    "#00ff88",
  bullGlow:    "rgba(0,255,136,0.04)",
  bullBorder:  "rgba(0,255,136,0.18)",

  bearWick:    "#e53935",
  bearBody:    "#e53935",
  bearGlow:    "rgba(229,57,53,0.04)",
  bearBorder:  "rgba(229,57,53,0.18)",

  entryLine:   "#00ff88",
  entryTag:    "#ffd60a",

  timerLine:   "#e53935",
  expireLine:  "#ff5252",

  crosshair:   "rgba(150,165,190,0.12)",
  crossLabel:  "rgba(16,20,28,0.95)",

  tipBg:       "rgba(16,20,28,0.97)",
  tipBorder:   "rgba(255,255,255,0.05)",

  liveGreen:   "#00ff88",
  liveRed:     "#e53935",
};

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const snap = (v: number) => Math.round(v) + 0.5;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function gridStep(range: number, target: number): number {
  const rough = range / target;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const n = rough / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const fmt = {
  price(v: number) { return v.toFixed(10); },
  axis(v: number) {
    if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
    if (v >= 100) return v.toFixed(2);
    if (v >= 1) return v.toFixed(3);
    return v.toFixed(4);
  },
  time(ts: number) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  },
  date(ts: number) {
    const d = new Date(ts);
    return `${d.getDate()} ${monthNames[d.getMonth()]}`;
  },
  countdown(s: number) {
    const n = Math.max(0, Math.floor(s));
    return `:${String(n).padStart(2, "0")}`;
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const ChartCanvas: React.FC<Props> = ({ candles, livePrice, trades, activeTrade }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvsRef = useRef<HTMLCanvasElement>(null);

  const [range, setRange] = useState({ s: 0, e: 0 });
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);

  const pulse = useRef(0);
  const raf = useRef(0);
  const drag = useRef({ on: false, x0: 0, o0: 0, vx: 0, lx: 0, lt: 0 });
  const offset = useRef(0);
  const pinch = useRef({ on: false, d0: 0, n0: 0 });
  // Track whether candles changed to re-compute HA
  const candleLenRef = useRef(0);

  // Pre-compute Heikin Ashi when candles change
  if (candles.length !== candleLenRef.current || candleLenRef.current === 0) {
    haCache = computeHA(candles);
    candleLenRef.current = candles.length;
  }

  useEffect(() => {
    let run = true;
    const tick = () => {
      if (!run) return;
      pulse.current = (pulse.current + 0.04) % (Math.PI * 2);
      raf.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { run = false; cancelAnimationFrame(raf.current); };
  }, []);

  /* ── Visible range init ──────────────────────────────────────────── */
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
          const ratio = Math.min(1, Math.max(0, (mouseX - 0) / (rect.width - 64)));
          const delta = e.deltaY > 0 ? 3 : -3;
          const nn = Math.max(12, Math.min(candles.length, n + delta));
          const shrink = n - nn;
          const sOff = Math.round(shrink * ratio);
          return {
            s: Math.max(0, p.s + sOff),
            e: Math.min(candles.length - 1, p.e - (shrink - sOff)),
          };
        } else {
          const d = e.deltaY > 0 ? 4 : -4;
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
      const cR = rect.width - 64;
      const n = range.e - range.s + 1;
      const dx = e.clientX - drag.current.x0;
      const no = drag.current.o0 + dx / (cR / n);
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
    const idx = Math.floor(mx / (cR / n));
    if (idx >= 0 && idx < n && mx <= cR) setHover({ x: mx, y: my, i: idx });
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
      const nn = Math.max(12, Math.min(candles.length, Math.round(pinch.current.n0 * scale)));
      const mid = (range.s + range.e) / 2;
      const half = nn / 2;
      setRange({ s: Math.max(0, Math.min(candles.length - nn, Math.round(mid - half))), e: Math.max(0, Math.min(candles.length - 1, Math.round(mid + half))) });
      return;
    }
    if (drag.current.on && e.touches.length === 1) {
      const rect = wrap.getBoundingClientRect();
      const cR = rect.width - 64;
      const n = range.e - range.s + 1;
      const dx = e.touches[0].clientX - drag.current.x0;
      const no = drag.current.o0 + dx / (cR / n);
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

    const AXIS_W = 64;
    const TIME_H = 24;
    const XL = AXIS_W, XR = W, CW = XR - XL;
    const YT = 0, YB = H - TIME_H, CH = YB - YT;

    if (candles.length < 2 || !haCache.length) return;

    const viS = Math.max(0, range.s);
    const viE = Math.min(candles.length - 1, range.e);
    const vHA = haCache.slice(viS, viE + 1);
    const vC = candles.slice(viS, viE + 1);
    if (!vHA.length) return;
    const vN = vHA.length;

    /* ── Background ───────────────────────────────────────────────── */
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    // Subtle top gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H * 0.4);
    grad.addColorStop(0, C.bgTop);
    grad.addColorStop(1, C.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H * 0.4);

    /* ── Price range ──────────────────────────────────────────────── */
    let hi = -Infinity, lo = Infinity;
    for (let i = 0; i < vN; i++) {
      const c = vHA[i];
      if (c.h > hi) hi = c.h;
      if (c.l < lo) lo = c.l;
    }
    if (livePrice > hi) hi = livePrice;
    if (livePrice < lo) lo = livePrice;
    for (let i = 0; i < trades.length; i++) {
      const p = trades[i].entryPrice;
      if (p > hi) hi = p;
      if (p < lo) lo = p;
    }
    const pad = (hi - lo || 1) * 0.12;
    hi += pad; lo -= pad;
    const PR = hi - lo;

    const slot = CW / vN;
    const bw = Math.max(3, Math.min(14, slot * 0.55 | 0));
    const xAt = (i: number) => XL + (i + 0.5) * slot;
    const yAt = (p: number) => YT + ((hi - p) / PR) * CH;

    /* ═════════════════════════════════════════════════════════════════
       GRID
       ═════════════════════════════════════════════════════════════════ */
    ctx.font = '9px "SF Mono",ui-monospace,Menlo,Consolas,monospace';
    ctx.textBaseline = "middle";

    const step = gridStep(PR, 6);
    const gS = Math.ceil(lo / step) * step;

    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    for (let v = gS; v <= hi; v += step) {
      const y = snap(yAt(v));
      if (y < YT || y > YB) continue;
      ctx.beginPath(); ctx.moveTo(XL, y); ctx.lineTo(XR, y); ctx.stroke();
      ctx.fillStyle = C.axisLabel;
      ctx.textAlign = "right";
      ctx.fillText(fmt.price(v), XL - 6, y);
    }

    const tStep = Math.max(1, vN / 6 | 0);
    for (let i = 0; i < vN; i += tStep) {
      const x = snap(xAt(i));
      if (x < XL || x > XR) continue;
      ctx.beginPath(); ctx.moveTo(x, YT); ctx.lineTo(x, YB); ctx.stroke();
      ctx.fillStyle = C.axisLabel;
      ctx.textAlign = "center";
      ctx.fillText(fmt.time(vC[i].time), xAt(i), H - TIME_H + 14);
    }

    // Axis boundary lines
    ctx.strokeStyle = C.axisLine;
    ctx.beginPath(); ctx.moveTo(XL, snap(YB)); ctx.lineTo(XR, snap(YB)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(snap(XL), YT + 1); ctx.lineTo(snap(XL), YB); ctx.stroke();

    /* ═════════════════════════════════════════════════════════════════
       CANDLES
       ═════════════════════════════════════════════════════════════════ */
    for (let i = 0; i < vN; i++) {
      const c = vHA[i];
      const x = xAt(i);
      const up = c.c >= c.o;
      const yO = yAt(c.o), yC = yAt(c.c);
      const bTop = Math.min(yO, yC);
      const bBot = Math.max(yO, yC);
      const bH = Math.max(1, bBot - bTop);
      const l = (x - bw / 2) | 0;

      // Wick
      ctx.strokeStyle = up ? C.bullWick : C.bearWick;
      ctx.lineWidth = Math.max(1.2, bw * 0.12);
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(snap(x), yAt(c.h) | 0); ctx.lineTo(snap(x), yAt(c.l) | 0); ctx.stroke();
      ctx.globalAlpha = 1;

      // Body
      ctx.fillStyle = up ? C.bullBody : C.bearBody;
      ctx.fillRect(l, bTop | 0, bw, Math.max(1, (bH | 0)));

      // Thin border
      if (bw > 4) {
        ctx.strokeStyle = up ? C.bullBorder : C.bearBorder;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(l, bTop | 0, bw, Math.max(1, (bH | 0)));
      }
    }

    /* ═════════════════════════════════════════════════════════════════
       LIVE PRICE — dotted line + pulse + badge
       ═════════════════════════════════════════════════════════════════ */
    const lpY = yAt(livePrice);
    const lpUp = livePrice >= (vHA[vHA.length - 1]?.o ?? livePrice);
    const lpCol = lpUp ? C.liveGreen : C.liveRed;
    const pulseA = 0.08 + Math.sin(pulse.current) * 0.05;

    const band = ctx.createLinearGradient(0, lpY - 24, 0, lpY + 24);
    const gb = lpUp ? "0,255,136" : "229,57,53";
    band.addColorStop(0, `rgba(${gb},0)`);
    band.addColorStop(0.5, `rgba(${gb},${pulseA})`);
    band.addColorStop(1, `rgba(${gb},0)`);
    ctx.fillStyle = band;
    ctx.fillRect(XL, lpY - 24, CW, 48);

    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = lpCol;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(XL, snap(lpY)); ctx.lineTo(XR, snap(lpY)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Current price display - green rectangular box at far right
    const priceTag = fmt.price(livePrice);
    ctx.font = 'bold 9px "SF Mono",ui-monospace,Menlo,monospace';
    const ptW = ctx.measureText(priceTag).width + 16;
    const ptH = 20;
    const ptX = XR - ptW - 4;
    const ptY = lpY - ptH / 2;

    ctx.fillStyle = C.liveGreen;
    roundRect(ctx, ptX, ptY, ptW, ptH, 4);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(priceTag, ptX + ptW / 2, lpY);

    /* ═════════════════════════════════════════════════════════════════
       ENTRY LINES — dotted green + yellow ₹ tag
       ═════════════════════════════════════════════════════════════════ */
    for (let i = 0; i < trades.length; i++) {
      const tr = trades[i];
      const ey = yAt(tr.entryPrice);
      if (ey < YT || ey > YB) continue;

      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = C.entryLine;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(XL, snap(ey)); ctx.lineTo(XR, snap(ey)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      const txt = `${tr.amount} \u20b9`;
      ctx.font = 'bold 9px "SF Mono",ui-monospace,Menlo,monospace';
      const txtW = ctx.measureText(txt).width | 0;
      const tagH = 16;
      const full = txtW + 22;
      const tagX = XL + 4;
      const tagY = Math.round(ey) - tagH / 2;

      ctx.fillStyle = C.entryTag;
      ctx.beginPath();
      ctx.moveTo(tagX + 3, tagY);
      ctx.lineTo(tagX + full - 3, tagY);
      ctx.arcTo(tagX + full, tagY, tagX + full, tagY + 3, 3);
      ctx.lineTo(tagX + full, tagY + tagH - 3);
      ctx.arcTo(tagX + full, tagY + tagH, tagX + full - 3, tagY + tagH, 3);
      ctx.lineTo(tagX + full - 5, tagY + tagH);
      ctx.lineTo(tagX + full, tagY + tagH / 2);
      ctx.lineTo(tagX + full - 5, tagY);
      ctx.lineTo(tagX + 3, tagY);
      ctx.arcTo(tagX, tagY, tagX, tagY + 3, 3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#0E1114";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, tagX + 10, ey);
    }

    /* ═════════════════════════════════════════════════════════════════
       TIMER — dotted vertical + countdown circle
       ═════════════════════════════════════════════════════════════════ */
    if (activeTrade && activeTrade.timeLeft > 0) {
      const prog = 1 - activeTrade.timeLeft / activeTrade.duration;
      const tx = XL + CW * 0.82;
      const cr = 16;
      const cy = YT + 30;

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.timerLine;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(snap(tx), YT); ctx.lineTo(snap(tx), YB); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // "TIME REMAINING" label above circle
      ctx.fillStyle = C.timerLine;
      ctx.font = '7px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.globalAlpha = 0.6;
      ctx.fillText("TIME REMAINING", tx, cy - cr - 4);
      ctx.globalAlpha = 1;

      // Countdown circle
      const cg = ctx.createRadialGradient(tx, cy, cr - 2, tx, cy, cr + 10);
      cg.addColorStop(0, "rgba(229,57,53,0.2)");
      cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cg;
      ctx.fillRect(tx - cr - 10, cy - cr - 10, (cr + 10) * 2, (cr + 10) * 2);

      ctx.beginPath(); ctx.arc(tx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(14,17,20,0.95)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath(); ctx.arc(tx, cy, cr - 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(tx, cy, cr - 2, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
      ctx.strokeStyle = C.timerLine;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.lineCap = "butt";

      ctx.fillStyle = "#fff";
      ctx.font = 'bold 10px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fmt.countdown(activeTrade.timeLeft), tx, cy);
    }

    /* ═════════════════════════════════════════════════════════════════
       EXPIRY — solid vertical line
       ═════════════════════════════════════════════════════════════════ */
    if (activeTrade && activeTrade.timeLeft > 0) {
      const ex = XL + CW * 0.85;
      ctx.strokeStyle = C.expireLine;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.65;
      ctx.beginPath(); ctx.moveTo(snap(ex), YT); ctx.lineTo(snap(ex), YB); ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = C.expireLine;
      ctx.font = '7px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.globalAlpha = 0.6;
      ctx.fillText("EXPIRY", ex, YT + 12);
      ctx.globalAlpha = 1;
    }

    /* ═════════════════════════════════════════════════════════════════
       CROSSHAIR — full interaction layer
       ═════════════════════════════════════════════════════════════════ */
    if (hover && hover.i >= 0 && hover.i < vN) {
      const hc = vHA[hover.i];
      const cx = xAt(hover.i);
      const cy = hover.y;

      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = C.crosshair;
      ctx.lineWidth = 1;

      // Vertical through candle
      ctx.beginPath(); ctx.moveTo(snap(cx), YT); ctx.lineTo(snap(cx), YB); ctx.stroke();

      // Horizontal through cursor
      if (cy >= YT && cy <= YB) {
        ctx.beginPath(); ctx.moveTo(XL, snap(cy)); ctx.lineTo(XR, snap(cy)); ctx.stroke();

        // Price label on Y-axis
        const cp = hi - ((cy - YT) / CH) * PR;
        const cpl = fmt.price(cp);
        ctx.setLineDash([]);
        ctx.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
        const cw = ctx.measureText(cpl).width + 10 | 0;
        roundRect(ctx, XL - cw - 1, Math.round(cy) - 8, cw, 16, 2);
        ctx.fillStyle = C.crossLabel;
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(cpl, XL - 6, cy);
      }
      ctx.setLineDash([]);

      // Time label on X-axis
      const tl = fmt.time(vC[hover.i].time);
      const dl = fmt.date(vC[hover.i].time);
      const tlW = 68;
      roundRect(ctx, cx - tlW / 2, H - TIME_H, tlW, TIME_H, 2);
      ctx.fillStyle = C.crossLabel;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${dl} ${tl}`, cx, H - TIME_H + 12);

      // Candle highlight
      const hcUp = hc.c >= hc.o;
      ctx.strokeStyle = hcUp ? C.bullWick : C.bearWick;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.35;
      const bhT = Math.min(yAt(hc.o), yAt(hc.c));
      const bhB = Math.max(yAt(hc.o), yAt(hc.c));
      ctx.strokeRect((cx - bw / 2 | 0) - 1, (bhT | 0) - 1, bw + 2, Math.max(1, (bhB - bhT | 0)) + 2);
      ctx.globalAlpha = 1;

      /* ── OHLC Tooltip ──────────────────────────────────────────── */
      const isUp = hc.c >= hc.o;
      const chg = ((hc.c - hc.o) / hc.o) * 100;
      const tipW = 148, tipH = 100;
      let tipX = hover.x + 14;
      let tipY = YT + 10;
      if (tipX + tipW > XR - 8) tipX = hover.x - tipW - 14;
      if (tipY + tipH > YB - 8) tipY = YB - tipH - 8;

      ctx.fillStyle = C.tipBg;
      ctx.strokeStyle = C.tipBorder;
      ctx.lineWidth = 1;
      roundRect(ctx, tipX, tipY, tipW, tipH, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isUp ? C.bullWick : C.bearWick;
      ctx.fillRect(tipX + 1, tipY + 1, tipW - 2, 2);

      let ly = tipY + 9;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      ctx.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.fillStyle = C.axisLabel;
      ctx.fillText(`${fmt.date(vC[hover.i].time)} ${fmt.time(vC[hover.i].time)}`, tipX + 10, ly);
      ly += 13;

      ctx.fillStyle = isUp ? C.bullWick : C.bearWick;
      ctx.font = 'bold 10px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.fillText(`HA  ${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`, tipX + 10, ly);
      ly += 15;

      const ohlc: [string, number, string][] = [
        ["O", hc.o, C.axisLabel],
        ["H", hc.h, C.bullWick],
        ["L", hc.l, C.bearWick],
        ["C", hc.c, isUp ? C.bullWick : C.bearWick],
      ];
      for (let i = 0; i < ohlc.length; i++) {
        const [lb, val, col] = ohlc[i];
        ctx.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
        ctx.fillStyle = C.axisLabel;
        ctx.fillText(lb, tipX + 10, ly);
        ctx.fillStyle = col;
        ctx.font = 'bold 10px "SF Mono",ui-monospace,Menlo,monospace';
        ctx.fillText(fmt.price(val), tipX + 22, ly);
        ly += 13;
      }
    }

    /* ── Mini scrollbar ──────────────────────────────────────────── */
    if (candles.length > vN) {
      const sbW = CW * 0.3;
      const sbX = CW / 2 - sbW / 2;
      const sbY = H - 3;
      const tw = (vN / candles.length) * sbW;
      const tx = sbX + (viS / candles.length) * sbW;
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(sbX, sbY, sbW, 2);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(tx, sbY, tw, 2);
    }
  }, [candles, livePrice, trades, activeTrade, hover, range]);

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
      style={{ cursor: drag.current.on ? "grabbing" : hover ? "crosshair" : "default" }}
    >
      <canvas ref={cvsRef} className="absolute inset-0" />
    </div>
  );
};

export default ChartCanvas;
