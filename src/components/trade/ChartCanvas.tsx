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
   HEIKIN ASHI
   ═══════════════════════════════════════════════════════════════════════════ */
interface HA { t: number; o: number; h: number; l: number; c: number }

function heikinAshi(src: Candle[]): HA[] {
  if (!src.length) return [];
  const out: HA[] = [{ t: src[0].time, o: src[0].open, h: src[0].high, l: src[0].low, c: src[0].close }];
  for (let i = 1; i < src.length; i++) {
    const s = src[i], p = out[i - 1];
    const c = (s.open + s.high + s.low + s.close) / 4;
    const o = (p.o + p.c) / 2;
    out.push({ t: s.time, o, h: Math.max(s.high, o, c), l: Math.min(s.low, o, c), c });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — TradingView-inspired dark theme
   ═══════════════════════════════════════════════════════════════════════════ */
const C = {
  bg:          "#131722",
  bgTop:       "#1a1e2e",
  bgBot:       "#0e121e",

  gridMajor:   "rgba(255,255,255,0.035)",
  gridMinor:   "rgba(255,255,255,0.018)",
  axisLine:    "rgba(255,255,255,0.06)",
  axisLabel:   "rgba(130,144,170,0.5)",

  // Bullish — vibrant neon green
  bullWick:    "#00ff88",
  bullBody:    "#00ff88",
  bullGlow:    "rgba(0,255,136,0.05)",

  // Bearish — muted red
  bearWick:    "#ef5350",
  bearBody:    "#ef5350",
  bearGlow:    "rgba(239,83,80,0.05)",

  entryLine:   "#00ff88",
  entryTag:    "#ffd60a",

  timerLine:   "#e53935",
  expireLine:  "#ff6b6b",

  crosshair:   "rgba(150,165,190,0.15)",
  crossLabel:  "rgba(18,22,34,0.95)",

  tipBg:       "rgba(18,22,34,0.97)",
  tipBorder:   "rgba(255,255,255,0.06)",

  liveGreen:   "#00ff88",
  liveRed:     "#ef5350",
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

const fmt = {
  price(v: number) { return v.toFixed(8); },
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
    return `${d.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]}`;
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
          const PW = 60;
          const cR = rect.width - PW;
          const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / cR));
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
      const PW = 60;
      const cR = rect.width - PW;
      const n = range.e - range.s + 1;
      const slotW = cR / n;
      const dx = e.clientX - drag.current.x0;
      const no = drag.current.o0 + dx / slotW;
      const now = performance.now();
      const dt = now - drag.current.lt;
      if (dt > 0) drag.current.vx = (e.clientX - drag.current.lx) / dt;
      drag.current.lx = e.clientX;
      drag.current.lt = now;
      const shift = Math.floor(no);
      offset.current = no - shift;
      const ns = Math.max(0, Math.min(candles.length - n, range.s - shift));
      setRange({ s: ns, e: ns + n - 1 });
      setHover(null);
      return;
    }
    const PW = 60;
    const cR = rect.width - PW;
    const n = range.e - range.s + 1;
    const idx = Math.floor(mx / (cR / n));
    if (idx >= 0 && idx < n && mx <= cR) {
      setHover({ x: mx, y: my, i: idx });
    } else {
      setHover(null);
    }
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
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
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
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = pinch.current.d0 / d;
      const nn = Math.max(12, Math.min(candles.length, Math.round(pinch.current.n0 * scale)));
      const mid = (range.s + range.e) / 2;
      const half = nn / 2;
      setRange({ s: Math.max(0, Math.min(candles.length - nn, Math.round(mid - half))), e: Math.max(0, Math.min(candles.length - 1, Math.round(mid + half))) });
      return;
    }
    if (drag.current.on && e.touches.length === 1) {
      const rect = wrap.getBoundingClientRect();
      const PW = 60;
      const cR = rect.width - PW;
      const n = range.e - range.s + 1;
      const slotW = cR / n;
      const dx = e.touches[0].clientX - drag.current.x0;
      const no = drag.current.o0 + dx / slotW;
      const now = performance.now();
      const dt = now - drag.current.lt;
      if (dt > 0) drag.current.vx = (e.touches[0].clientX - drag.current.lx) / dt;
      drag.current.lx = e.touches[0].clientX;
      drag.current.lt = now;
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
     DRAW
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
    const XL = 0;
    const XR = W - AXIS_W;
    const CW = XR - XL;
    const YT = 0;
    const YB = H - TIME_H;
    const CH = YB - YT;

    /* ── Background ─────────────────────────────────────────────── */
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, C.bgTop);
    grad.addColorStop(0.5, C.bg);
    grad.addColorStop(1, C.bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (candles.length < 2) return;

    /* ── Heikin Ashi ────────────────────────────────────────────── */
    const ha = heikinAshi(candles);
    const viS = Math.max(0, range.s);
    const viE = Math.min(candles.length - 1, range.e);
    const vHA = ha.slice(viS, viE + 1);
    const vC = candles.slice(viS, viE + 1);
    if (!vHA.length) return;
    const vN = vHA.length;

    /* ── Price range ────────────────────────────────────────────── */
    let hi = -Infinity, lo = Infinity;
    for (const c of vHA) { if (c.h > hi) hi = c.h; if (c.l < lo) lo = c.l; }
    if (livePrice > hi) hi = livePrice;
    if (livePrice < lo) lo = livePrice;
    for (const t of trades) {
      if (t.entryPrice > hi) hi = t.entryPrice;
      if (t.entryPrice < lo) lo = t.entryPrice;
    }
    const pad = (hi - lo || 1) * 0.12;
    hi += pad; lo -= pad;
    const PR = hi - lo;

    /* ── Scales ─────────────────────────────────────────────────── */
    const slot = CW / vN;
    const bw = Math.max(3, Math.min(14, Math.floor(slot * 0.55)));
    const xAt = (i: number) => XL + (i + 0.5) * slot;
    const yAt = (p: number) => YT + ((hi - p) / PR) * CH;

    /* ═══════════════════════════════════════════════════════════════
       GRID
       ═══════════════════════════════════════════════════════════════ */
    ctx.font = '9px "SF Mono",ui-monospace,Menlo,Consolas,monospace';
    ctx.textBaseline = "middle";

    const step = gridStep(PR, 6);
    const gS = Math.ceil(lo / step) * step;

    // Major horizontal
    for (let v = gS; v <= hi; v += step) {
      const y = snap(yAt(v));
      if (y < YT || y > YB) continue;
      ctx.strokeStyle = C.gridMajor;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(XL, y); ctx.lineTo(XR, y); ctx.stroke();
      ctx.fillStyle = C.axisLabel;
      ctx.textAlign = "left";
      ctx.fillText(fmt.axis(v), XR + 6, y);
    }

    // Minor horizontal (half-step)
    const halfStep = step / 2;
    for (let v = gS + halfStep; v <= hi; v += halfStep) {
      const y = snap(yAt(v));
      if (y < YT || y > YB) continue;
      ctx.strokeStyle = C.gridMinor;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(XL, y); ctx.lineTo(XR, y); ctx.stroke();
    }

    // Vertical
    const tStep = Math.max(1, Math.floor(vN / 6));
    for (let i = 0; i < vN; i += tStep) {
      const x = snap(xAt(i));
      if (x < XL || x > XR) continue;
      ctx.strokeStyle = C.gridMajor;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, YT); ctx.lineTo(x, YB); ctx.stroke();
      ctx.fillStyle = C.axisLabel;
      ctx.textAlign = "center";
      ctx.fillText(fmt.time(vC[i].time), xAt(i), H - TIME_H + 14);
    }

    // Axis lines
    ctx.strokeStyle = C.axisLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(XL, snap(YB)); ctx.lineTo(XR, snap(YB)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(snap(XR), YT + 1); ctx.lineTo(snap(XR), YB); ctx.stroke();

    /* ═══════════════════════════════════════════════════════════════
       CANDLES
       ═══════════════════════════════════════════════════════════════ */
    for (let i = 0; i < vN; i++) {
      const c = vHA[i];
      const x = xAt(i);
      const up = c.c >= c.o;
      const yO = yAt(c.o), yC = yAt(c.c);
      const yH = yAt(c.h), yL = yAt(c.l);
      const bTop = Math.min(yO, yC);
      const bBot = Math.max(yO, yC);
      const bH = Math.max(1, bBot - bTop);
      const l = Math.floor(x - bw / 2);

      // Glow aura
      if (bw > 5) {
        const gs = bw + 10;
        const gg = ctx.createRadialGradient(x, (bTop + bBot) / 2, 0, x, (bTop + bBot) / 2, gs);
        gg.addColorStop(0, up ? C.bullGlow : C.bearGlow);
        gg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gg;
        ctx.fillRect(x - gs, bTop - gs / 2, gs * 2, bH + gs);
      }

      // Wick
      ctx.strokeStyle = up ? C.bullWick : C.bearWick;
      ctx.lineWidth = Math.max(1.2, bw * 0.14);
      ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.moveTo(snap(x), Math.round(yH)); ctx.lineTo(snap(x), Math.round(yL)); ctx.stroke();
      ctx.globalAlpha = 1;

      // Body
      const bodyGrad = ctx.createLinearGradient(0, bTop, 0, bBot);
      if (up) {
        bodyGrad.addColorStop(0, "#00ff88");
        bodyGrad.addColorStop(1, "#00c853");
      } else {
        bodyGrad.addColorStop(0, "#d32f2f");
        bodyGrad.addColorStop(1, "#ef5350");
      }
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(l, Math.floor(bTop), bw, Math.max(1, Math.floor(bH)));

      // Border
      if (bw > 4) {
        ctx.strokeStyle = up ? "rgba(0,255,136,0.2)" : "rgba(239,83,80,0.2)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(l, Math.floor(bTop), bw, Math.max(1, Math.floor(bH)));
      }
    }

    /* ═══════════════════════════════════════════════════════════════
       LIVE PRICE LINE
       ═══════════════════════════════════════════════════════════════ */
    const lpY = yAt(livePrice);
    const lpUp = livePrice >= (vHA[vHA.length - 1]?.o ?? livePrice);
    const lpCol = lpUp ? C.liveGreen : C.liveRed;
    const pulseA = 0.08 + Math.sin(pulse.current) * 0.05;

    // Pulsing glow band
    const bandGrad = ctx.createLinearGradient(0, lpY - 28, 0, lpY + 28);
    const gb = lpUp ? "0,255,136" : "239,83,80";
    bandGrad.addColorStop(0, `rgba(${gb},0)`);
    bandGrad.addColorStop(0.5, `rgba(${gb},${pulseA})`);
    bandGrad.addColorStop(1, `rgba(${gb},0)`);
    ctx.fillStyle = bandGrad;
    ctx.fillRect(XL, lpY - 28, CW, 56);

    // Dotted line
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = lpCol;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(XL, snap(lpY)); ctx.lineTo(XR, snap(lpY)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Price tag — right axis
    const tag = fmt.price(livePrice);
    ctx.font = 'bold 9px "SF Mono",ui-monospace,Menlo,monospace';
    const tW = Math.round(ctx.measureText(tag).width) + 12;
    const tH = 18;
    const tX = XR + 1;
    const tY = Math.round(lpY - tH / 2);

    ctx.fillStyle = lpCol;
    roundRect(ctx, tX, tY, tW, tH, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tX, lpY);
    ctx.lineTo(tX - 4, lpY - 3.5);
    ctx.lineTo(tX - 4, lpY + 3.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(tag, tX + 6, lpY);

    /* ═══════════════════════════════════════════════════════════════
       ENTRY LINES — dotted green + yellow ₹ tag
       ═══════════════════════════════════════════════════════════════ */
    for (const tr of trades) {
      const ey = yAt(tr.entryPrice);
      if (ey < YT || ey > YB) continue;

      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = C.entryLine;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(XL, snap(ey)); ctx.lineTo(XR, snap(ey)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Yellow tag with amount
      const txt = `${tr.amount} \u20b9`;
      ctx.font = 'bold 9px "SF Mono",ui-monospace,Menlo,monospace';
      const txtW = Math.round(ctx.measureText(txt).width);
      const pad = 6;
      const tagH = 16;
      const full = txtW + pad * 2 + 10;
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

      ctx.fillStyle = "#111119";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, tagX + pad + 4, ey);
    }

    /* ═══════════════════════════════════════════════════════════════
       TIMER — dotted red vertical + countdown circle
       ═══════════════════════════════════════════════════════════════ */
    if (activeTrade && activeTrade.timeLeft > 0) {
      const prog = 1 - activeTrade.timeLeft / activeTrade.duration;
      const tx = XR * 0.6;

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = C.timerLine;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(snap(tx), YT); ctx.lineTo(snap(tx), YB); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Circle
      const cr = 16;
      const cy = YT + 30;

      const cg = ctx.createRadialGradient(tx, cy, cr - 2, tx, cy, cr + 10);
      cg.addColorStop(0, "rgba(229,57,53,0.2)");
      cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cg;
      ctx.fillRect(tx - cr - 10, cy - cr - 10, (cr + 10) * 2, (cr + 10) * 2);

      ctx.beginPath(); ctx.arc(tx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(14,16,24,0.95)";
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

    /* ═══════════════════════════════════════════════════════════════
       EXPIRY — solid red vertical line
       ═══════════════════════════════════════════════════════════════ */
    if (activeTrade && activeTrade.timeLeft > 0) {
      const ex = XR * 0.82;
      ctx.strokeStyle = C.expireLine;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.65;
      ctx.beginPath(); ctx.moveTo(snap(ex), YT); ctx.lineTo(snap(ex), YB); ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = C.expireLine;
      ctx.font = '7px "SF Mono",ui-monospace,Menlo,monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.globalAlpha = 0.7;
      ctx.fillText("EXPIRY", ex, YT + 12);
      ctx.globalAlpha = 1;
    }

    /* ═══════════════════════════════════════════════════════════════
       CROSSHAIR
       ═══════════════════════════════════════════════════════════════ */
    if (hover && hover.i >= 0 && hover.i < vN) {
      const cx = xAt(hover.i);
      const cy = hover.y;

      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = C.crosshair;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(snap(cx), YT); ctx.lineTo(snap(cx), YB); ctx.stroke();
      if (cy >= YT && cy <= YB) {
        ctx.beginPath(); ctx.moveTo(XL, snap(cy)); ctx.lineTo(XR, snap(cy)); ctx.stroke();

        const cp = hi - ((cy - YT) / CH) * PR;
        const cpl = fmt.price(cp);
        ctx.setLineDash([]);
        ctx.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
        const cw = Math.round(ctx.measureText(cpl).width) + 10;
        roundRect(ctx, XR + 1, Math.round(cy) - 8, cw, 16, 2);
        ctx.fillStyle = C.crossLabel;
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(cpl, XR + 6, cy);
      }
      ctx.setLineDash([]);

      // Time label
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
      const hc = vHA[hover.i];
      const hcUp = hc.c >= hc.o;
      ctx.strokeStyle = hcUp ? C.bullWick : C.bearWick;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.35;
      const bhT = Math.min(yAt(hc.o), yAt(hc.c));
      const bhB = Math.max(yAt(hc.o), yAt(hc.c));
      ctx.strokeRect(Math.floor(cx - bw / 2) - 1, Math.floor(bhT) - 1, bw + 2, Math.max(1, Math.floor(bhB - bhT)) + 2);
      ctx.globalAlpha = 1;

      /* ── OHLC Tooltip ────────────────────────────────────────── */
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
      for (const [lb, val, col] of ohlc) {
        ctx.font = '9px "SF Mono",ui-monospace,Menlo,monospace';
        ctx.fillStyle = C.axisLabel;
        ctx.fillText(lb, tipX + 10, ly);
        ctx.fillStyle = col;
        ctx.font = 'bold 10px "SF Mono",ui-monospace,Menlo,monospace';
        ctx.fillText(fmt.price(val), tipX + 22, ly);
        ly += 13;
      }
    }

    /* ── Scrollbar ─────────────────────────────────────────────── */
    if (candles.length > vN) {
      const sbW = CW * 0.3;
      const sbH = 2;
      const sbX = CW / 2 - sbW / 2;
      const sbY = H - 3;
      const tw = (vN / candles.length) * sbW;
      const tx = sbX + (viS / candles.length) * sbW;
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(sbX, sbY, sbW, sbH);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(tx, sbY, tw, sbH);
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
