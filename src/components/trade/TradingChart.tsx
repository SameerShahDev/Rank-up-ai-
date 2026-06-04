"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Candle } from "../../utils/marketData";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface ActiveTrade {
  id: string;
  type: "UP" | "DOWN";
  entryPrice: number;
  amount: number;
  duration: number;
  timeLeft: number;
}

interface TradingChartProps {
  candles: Candle[];
  livePrice: number;
  activeTrades: ActiveTrade[];
  primaryTrade: ActiveTrade | null;
}

/* ─── Heikin Ashi Transform ──────────────────────────────────────────────── */
interface HACandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function computeHeikinAshi(candles: Candle[]): HACandle[] {
  if (candles.length === 0) return [];
  const ha: HACandle[] = [];
  // First HA candle: use original values
  const first = candles[0];
  ha.push({
    time: first.time,
    open: first.open,
    high: first.high,
    low: first.low,
    close: first.close,
  });
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = ha[i - 1];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = (prev.open + prev.close) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    ha.push({ time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose });
  }
  return ha;
}

/* ─── Color Palette ──────────────────────────────────────────────────────── */
const C = {
  bg: "#1a1a2e",
  bgGrad1: "#1e1e34",
  bgGrad2: "#14141f",
  grid: "rgba(255, 255, 255, 0.04)",
  gridStrong: "rgba(255, 255, 255, 0.07)",
  text: "rgba(148, 163, 184, 0.55)",
  textBright: "rgba(203, 213, 225, 0.85)",
  textDim: "rgba(100, 116, 139, 0.45)",
  bull: "#00ff88",
  bullBody: "#00e676",
  bullDim: "rgba(0, 255, 136, 0.06)",
  bear: "#e63946",
  bearBody: "#c62828",
  bearDim: "rgba(230, 57, 70, 0.06)",
  entryLine: "#00ff88",
  entryTag: "#ffd60a",
  timerLine: "#e63946",
  expireLine: "#ff4444",
  crosshair: "rgba(148, 163, 184, 0.2)",
  priceTag: "#00ff88",
  tooltip: "rgba(15, 23, 42, 0.95)",
};

/* ─── Formatters ─────────────────────────────────────────────────────────── */
function fmtPrice(v: number): string {
  return v.toFixed(8);
}

function fmtPriceAxis(v: number): string {
  if (v >= 100000) return (v / 1000).toFixed(1) + "K";
  if (v >= 1000) return v.toFixed(1);
  if (v >= 100) return v.toFixed(2);
  if (v >= 1) return v.toFixed(3);
  return v.toFixed(4);
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${m[d.getMonth()]}`;
}

function fmtCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `:${String(s).padStart(2, "0")}`;
}

/* ─── Nice grid step ─────────────────────────────────────────────────────── */
function niceStep(range: number, maxLines: number): number {
  const rough = range / maxLines;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step: number;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * mag;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRADING CHART COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const TradingChart: React.FC<TradingChartProps> = ({
  candles,
  livePrice,
  activeTrades,
  primaryTrade,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hover, setHover] = useState<{ x: number; y: number; idx: number } | null>(null);
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const animFrameRef = useRef<number>(0);
  const pulseRef = useRef<number>(0);
  const countdownRef = useRef<number>(0);

  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartRangeRef = useRef({ start: 0, end: 0 });

  /* ── Pulse + countdown animation ─────────────────────────────────── */
  useEffect(() => {
    let running = true;
    const animate = () => {
      if (!running) return;
      pulseRef.current = (pulseRef.current + 0.04) % (Math.PI * 2);
      countdownRef.current += 1 / 60;
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, []);

  /* ── Set visible range on candle data change ──────────────────────── */
  useEffect(() => {
    if (candles.length > 0) {
      setVisibleRange((prev) => {
        if (prev.start === 0 && prev.end === 0) {
          const maxVisible = 80;
          const end = candles.length - 1;
          const start = Math.max(0, end - maxVisible + 1);
          return { start, end };
        }
        const wasAtLatest = prev.end >= candles.length - 2;
        if (wasAtLatest) {
          const count = prev.end - prev.start + 1;
          const end = candles.length - 1;
          return { start: Math.max(0, end - count + 1), end };
        }
        return prev;
      });
    }
  }, [candles.length]);

  /* ── Scroll/Zoom handler ──────────────────────────────────────────── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setVisibleRange((prev) => {
        const count = prev.end - prev.start + 1;
        if (e.ctrlKey || e.metaKey) {
          const zoomDelta = e.deltaY > 0 ? 4 : -4;
          const newCount = Math.max(15, Math.min(candles.length, count + zoomDelta));
          return { start: Math.max(0, prev.end - newCount + 1), end: prev.end };
        } else {
          const scrollDelta = e.deltaY > 0 ? 3 : -3;
          const newStart = Math.max(0, Math.min(candles.length - count, prev.start + scrollDelta));
          return { start: newStart, end: Math.min(candles.length - 1, newStart + count - 1) };
        }
      });
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [candles.length]);

  /* ── Drag-to-pan ──────────────────────────────────────────────────── */
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartRangeRef.current = { ...visibleRange };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartXRef.current;
      const slotW = rect.width / (visibleRange.end - visibleRange.start + 1);
      const candleShift = Math.round(dx / slotW);
      const prev = dragStartRangeRef.current;
      const count = prev.end - prev.start + 1;
      let newStart = prev.start - candleShift;
      newStart = Math.max(0, Math.min(candles.length - count, newStart));
      setVisibleRange({ start: newStart, end: newStart + count - 1 });
      setHover(null);
      return;
    }

    const PRICE_AXIS_W = 64;
    const chartRight = rect.width - PRICE_AXIS_W;
    const chartW = chartRight;
    const vStart = Math.max(0, visibleRange.start);
    const vEnd = Math.min(candles.length - 1, visibleRange.end);
    const visible = candles.slice(vStart, vEnd + 1);
    const slot = chartW / visible.length;
    const idx = Math.floor(x / slot);
    if (idx >= 0 && idx < visible.length && x <= chartRight) {
      setHover({ x, y, idx });
    } else {
      setHover(null);
    }
  };
  const handleMouseUp = () => { isDraggingRef.current = false; };
  const handleMouseLeave = () => { isDraggingRef.current = false; setHover(null); };

  /* ── Touch handlers ────────────────────────────────────────────────── */
  const handleTouchStart = (e: React.TouchEvent) => {
    isDraggingRef.current = true;
    dragStartXRef.current = e.touches[0].clientX;
    dragStartRangeRef.current = { ...visibleRange };
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = touch.clientX - dragStartXRef.current;
      const slotW = rect.width / (visibleRange.end - visibleRange.start + 1);
      const candleShift = Math.round(dx / slotW);
      const prev = dragStartRangeRef.current;
      const count = prev.end - prev.start + 1;
      let newStart = prev.start - candleShift;
      newStart = Math.max(0, Math.min(candles.length - count, newStart));
      setVisibleRange({ start: newStart, end: newStart + count - 1 });
      return;
    }
    const PRICE_AXIS_W = 64;
    const chartRight = rect.width - PRICE_AXIS_W;
    const slot = chartRight / (visibleRange.end - visibleRange.start + 1);
    const idx = Math.floor(x / slot);
    if (idx >= 0 && idx < (visibleRange.end - visibleRange.start + 1) && x <= chartRight) {
      setHover({ x, y, idx });
    }
  };
  const handleTouchEnd = () => { isDraggingRef.current = false; setHover(null); };

  /* ═══════════════════════════════════════════════════════════════════════
     MAIN DRAW
     ═══════════════════════════════════════════════════════════════════════ */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = container.clientWidth || 800;
    const H = container.clientHeight || 500;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const PRICE_AXIS_W = 64;
    const TIME_AXIS_H = 24;
    const chartLeft = 0;
    const chartRight = W - PRICE_AXIS_W;
    const chartW = chartRight - chartLeft;
    const chartTop = 0;
    const chartBottom = H - TIME_AXIS_H;
    const chartH = chartBottom - chartTop;

    /* ── Background ──────────────────────────────────────────────── */
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, C.bgGrad1);
    bgGrad.addColorStop(0.5, C.bg);
    bgGrad.addColorStop(1, C.bgGrad2);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    if (candles.length < 2) return;

    /* ── Heikin Ashi candles ────────────────────────────────────── */
    const haCandles = computeHeikinAshi(candles);

    const vStart = Math.max(0, visibleRange.start);
    const vEnd = Math.min(candles.length - 1, visibleRange.end);
    const visibleHA = haCandles.slice(vStart, vEnd + 1);
    const visibleOrig = candles.slice(vStart, vEnd + 1);
    if (visibleHA.length < 1) return;
    const visibleCount = visibleHA.length;

    /* ── Price range ─────────────────────────────────────────────── */
    let maxP = -Infinity;
    let minP = Infinity;
    for (const c of visibleHA) {
      if (c.high > maxP) maxP = c.high;
      if (c.low < minP) minP = c.low;
    }
    if (livePrice > maxP) maxP = livePrice;
    if (livePrice < minP) minP = livePrice;
    // Include entry prices in range
    for (const t of activeTrades) {
      if (t.entryPrice > maxP) maxP = t.entryPrice;
      if (t.entryPrice < minP) minP = t.entryPrice;
    }
    const rawRange = maxP - minP || 1;
    const padR = rawRange * 0.1;
    maxP += padR;
    minP -= padR;
    const priceRange = maxP - minP;

    /* ── Scaling ─────────────────────────────────────────────────── */
    const slot = chartW / visibleCount;
    const barW = Math.max(3, Math.min(16, Math.floor(slot * 0.6)));
    const xFor = (i: number) => chartLeft + (i + 0.5) * slot;
    const toY = (p: number) => chartTop + ((maxP - p) / priceRange) * chartH;
    const px = (v: number) => Math.round(v) + 0.5;

    /* ════════════════════════════════════════════════════════════════
       GRID
       ════════════════════════════════════════════════════════════════ */
    const step = niceStep(priceRange, 6);
    const gridStart = Math.ceil(minP / step) * step;

    ctx.font = '10px "SF Mono", ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = "middle";

    // Horizontal grid lines (price)
    for (let v = gridStart; v <= maxP; v += step) {
      const y = px(toY(v));
      if (y < chartTop || y > chartBottom) continue;
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
      ctx.fillStyle = C.text;
      ctx.textAlign = "left";
      ctx.fillText(fmtPriceAxis(v), chartRight + 8, y);
    }

    // Vertical grid lines (time)
    const timeStep = Math.max(1, Math.floor(visibleCount / 6));
    for (let i = 0; i < visibleCount; i += timeStep) {
      const x = px(xFor(i));
      if (x < chartLeft || x > chartRight) continue;
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, chartTop);
      ctx.lineTo(x, chartBottom);
      ctx.stroke();
      ctx.fillStyle = C.textDim;
      ctx.textAlign = "center";
      ctx.fillText(fmtTime(visibleOrig[i].time), xFor(i), H - TIME_AXIS_H + 14);
    }

    // Separator line for time axis
    ctx.strokeStyle = C.gridStrong;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(chartLeft, px(chartBottom));
    ctx.lineTo(chartRight, px(chartBottom));
    ctx.stroke();
    // Price axis vertical line
    ctx.beginPath();
    ctx.moveTo(px(chartRight), chartTop);
    ctx.lineTo(px(chartRight), chartBottom);
    ctx.stroke();

    /* ════════════════════════════════════════════════════════════════
       HEIKIN ASHI CANDLESTICKS
       ════════════════════════════════════════════════════════════════ */
    for (let i = 0; i < visibleHA.length; i++) {
      const c = visibleHA[i];
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

      // Subtle glow behind candles
      if (barW > 5) {
        const glowSize = barW + 8;
        const glowGrad = ctx.createRadialGradient(x, (bodyTop + bodyBot) / 2, 0, x, (bodyTop + bodyBot) / 2, glowSize);
        glowGrad.addColorStop(0, isUp ? "rgba(0, 255, 136, 0.05)" : "rgba(230, 57, 70, 0.05)");
        glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = glowGrad;
        ctx.fillRect(x - glowSize, bodyTop - glowSize / 2, glowSize * 2, bodyH + glowSize);
      }

      // Wick (thin vertical line)
      ctx.strokeStyle = isUp ? C.bull : C.bear;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(px(x), Math.round(yHigh));
      ctx.lineTo(px(x), Math.round(yLow));
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Body
      const bodyGrad = ctx.createLinearGradient(0, bodyTop, 0, bodyTop + bodyH);
      if (isUp) {
        bodyGrad.addColorStop(0, C.bull);
        bodyGrad.addColorStop(1, C.bullBody);
      } else {
        bodyGrad.addColorStop(0, C.bearBody);
        bodyGrad.addColorStop(1, C.bear);
      }
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(left, Math.floor(bodyTop), barW, Math.max(1, Math.floor(bodyH)));

      // Thin border on body
      if (barW > 4) {
        ctx.strokeStyle = isUp ? "rgba(0,255,136,0.25)" : "rgba(230,57,70,0.25)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(left, Math.floor(bodyTop), barW, Math.max(1, Math.floor(bodyH)));
      }
    }

    /* ════════════════════════════════════════════════════════════════
       LIVE PRICE LINE + TAG
       ════════════════════════════════════════════════════════════════ */
    const lastY = toY(livePrice);
    const isLiveUp = livePrice >= (visibleHA[visibleHA.length - 1]?.open ?? livePrice);
    const liveColor = isLiveUp ? C.bull : C.bear;
    const pulseAlpha = 0.12 + Math.sin(pulseRef.current) * 0.06;

    // Glow band around live price
    const bandH = 35;
    const bandGrad = ctx.createLinearGradient(0, lastY - bandH, 0, lastY + bandH);
    const glowBase = isLiveUp ? "0, 255, 136" : "230, 57, 70";
    bandGrad.addColorStop(0, `rgba(${glowBase}, 0)`);
    bandGrad.addColorStop(0.5, `rgba(${glowBase}, ${pulseAlpha})`);
    bandGrad.addColorStop(1, `rgba(${glowBase}, 0)`);
    ctx.fillStyle = bandGrad;
    ctx.fillRect(chartLeft, lastY - bandH, chartW, bandH * 2);

    // Dotted live price line
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = liveColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(chartLeft, px(lastY));
    ctx.lineTo(chartRight, px(lastY));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // High-precision price tag on right axis
    const priceLabel = fmtPrice(livePrice);
    ctx.font = 'bold 10px "SF Mono", ui-monospace, Menlo, Consolas, monospace';
    const plMetrics = ctx.measureText(priceLabel);
    const plW = Math.round(plMetrics.width) + 14;
    const plH = 20;
    const plX = chartRight + 1;
    const plY = Math.round(lastY - plH / 2);

    ctx.fillStyle = liveColor;
    ctx.beginPath();
    const r = 3;
    ctx.moveTo(plX, plY + r);
    ctx.arcTo(plX, plY + plH, plX + r, plY + plH, r);
    ctx.lineTo(plX + plW - r, plY + plH);
    ctx.arcTo(plX + plW, plY + plH, plX + plW, plY + plH - r, r);
    ctx.lineTo(plX + plW, plY + r);
    ctx.arcTo(plX + plW, plY, plX + plW - r, plY, r);
    ctx.lineTo(plX + r, plY);
    ctx.arcTo(plX, plY, plX, plY + r, r);
    ctx.fill();

    // Arrow pointer
    ctx.beginPath();
    ctx.moveTo(plX, lastY);
    ctx.lineTo(plX - 5, lastY - 4);
    ctx.lineTo(plX - 5, lastY + 4);
    ctx.closePath();
    ctx.fillStyle = liveColor;
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(priceLabel, plX + 7, lastY);

    /* ════════════════════════════════════════════════════════════════
       ACTIVE TRADE ENTRY LINES (dotted green horizontal + yellow tag)
       ════════════════════════════════════════════════════════════════ */
    activeTrades.forEach((trade) => {
      const y = toY(trade.entryPrice);
      if (y < chartTop || y > chartBottom) return;

      // Dotted green horizontal line
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = C.entryLine;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(chartLeft, px(y));
      ctx.lineTo(chartRight, px(y));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Yellow arrow tag with amount (100 ₹)
      const tagText = `${trade.amount} \u20b9`;
      ctx.font = 'bold 10px "SF Mono", ui-monospace, monospace';
      const tagMetrics = ctx.measureText(tagText);
      const tagTextW = Math.round(tagMetrics.width);
      const tagPadX = 8;
      const tagH = 18;
      const tagW = tagTextW + tagPadX * 2 + 14; // extra for arrow
      const tagX = chartLeft + 6;
      const tagY = Math.round(y) - tagH / 2;

      // Tag background
      ctx.fillStyle = C.entryTag;
      ctx.beginPath();
      const tr = 4;
      ctx.moveTo(tagX + tr, tagY);
      ctx.lineTo(tagX + tagW - tr, tagY);
      ctx.arcTo(tagX + tagW, tagY, tagX + tagW, tagY + tr, tr);
      ctx.lineTo(tagX + tagW, tagY + tagH - tr);
      ctx.arcTo(tagX + tagW, tagY + tagH, tagX + tagW - tr, tagY + tagH, tr);
      ctx.lineTo(tagX + tagW - 8, tagY + tagH);
      // Arrow notch
      ctx.lineTo(tagX + tagW, tagY + tagH / 2);
      ctx.lineTo(tagX + tagW - 8, tagY);
      ctx.lineTo(tagX + tr, tagY);
      ctx.arcTo(tagX, tagY, tagX, tagY + tr, tr);
      ctx.closePath();
      ctx.fill();

      // Arrow triangle at end
      ctx.fillStyle = C.entryTag;
      ctx.beginPath();
      ctx.moveTo(tagX + tagW, tagY + tagH / 2);
      ctx.lineTo(tagX + tagW + 6, tagY + tagH / 2 - 5);
      ctx.lineTo(tagX + tagW + 6, tagY + tagH / 2 + 5);
      ctx.closePath();
      ctx.fill();

      // Text in tag
      ctx.fillStyle = "#1a1a2e";
      ctx.font = 'bold 10px "SF Mono", ui-monospace, monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(tagText, tagX + tagPadX + 6, y);
    });

    /* ════════════════════════════════════════════════════════════════
       TIMER VERTICAL LINE + COUNTDOWN CIRCLE
       ════════════════════════════════════════════════════════════════ */
    if (primaryTrade && primaryTrade.timeLeft > 0) {
      const progress = 1 - primaryTrade.timeLeft / primaryTrade.duration;
      const timerX = chartRight * 0.62; // Position in the chart

      // Dotted vertical red line
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = C.timerLine;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(px(timerX), chartTop);
      ctx.lineTo(px(timerX), chartBottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Countdown circle overlay on the line
      const circleR = 16;
      const circleY = chartTop + 30;

      // Glow behind circle
      const glowGrad = ctx.createRadialGradient(timerX, circleY, circleR - 2, timerX, circleY, circleR + 10);
      glowGrad.addColorStop(0, "rgba(230, 57, 70, 0.2)");
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(timerX - circleR - 10, circleY - circleR - 10, (circleR + 10) * 2, (circleR + 10) * 2);

      // Dark circle background
      ctx.beginPath();
      ctx.arc(timerX, circleY, circleR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(20, 20, 35, 0.95)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Outer ring track
      ctx.beginPath();
      ctx.arc(timerX, circleY, circleR - 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Progress arc
      ctx.beginPath();
      ctx.arc(timerX, circleY, circleR - 2, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = C.timerLine;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.lineCap = "butt";

      // Countdown text
      const countdownText = fmtCountdown(primaryTrade.timeLeft);
      ctx.fillStyle = "#fff";
      ctx.font = 'bold 11px "SF Mono", ui-monospace, monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(countdownText, timerX, circleY);
    }

    /* ════════════════════════════════════════════════════════════════
       EXPIRATION VERTICAL LINE (solid, further right)
       ════════════════════════════════════════════════════════════════ */
    if (primaryTrade && primaryTrade.timeLeft > 0) {
      const expireX = chartRight * 0.82; // Further right in the timeline

      // Solid vertical red line
      ctx.strokeStyle = C.expireLine;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(px(expireX), chartTop);
      ctx.lineTo(px(expireX), chartBottom);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Small label at top
      ctx.fillStyle = C.expireLine;
      ctx.font = '9px "SF Mono", ui-monospace, monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.globalAlpha = 0.8;
      ctx.fillText("EXPIRY", expireX, chartTop + 10);
      ctx.globalAlpha = 1;
    }

    /* ════════════════════════════════════════════════════════════════
       CROSSHAIR + TOOLTIP
       ════════════════════════════════════════════════════════════════ */
    if (hover && hover.idx >= 0 && hover.idx < visibleHA.length) {
      const cx = hover.x;
      const cy = hover.y;
      const ci = hover.idx;
      const hoverCandle = visibleHA[ci];
      const candleX = xFor(ci);

      // Vertical crosshair
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = C.crosshair;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px(candleX), chartTop);
      ctx.lineTo(px(candleX), chartBottom);
      ctx.stroke();

      // Horizontal crosshair
      if (cy >= chartTop && cy <= chartBottom) {
        ctx.beginPath();
        ctx.moveTo(chartLeft, px(cy));
        ctx.lineTo(chartRight, px(cy));
        ctx.stroke();

        // Price label on axis
        const crossPrice = maxP - ((cy - chartTop) / chartH) * priceRange;
        const crossLabel = fmtPrice(crossPrice);
        ctx.setLineDash([]);
        ctx.font = '10px "SF Mono", ui-monospace, monospace';
        const clW = Math.round(ctx.measureText(crossLabel).width) + 12;
        ctx.fillStyle = "rgba(30, 41, 59, 0.95)";
        ctx.fillRect(chartRight + 1, Math.round(cy) - 10, clW, 20);
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.strokeRect(chartRight + 1, Math.round(cy) - 10, clW, 20);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(crossLabel, chartRight + 7, cy);
      }
      ctx.setLineDash([]);

      // Time label at bottom
      const timeLabel = fmtTime(visibleOrig[ci].time);
      const dateLabel = fmtDate(visibleOrig[ci].time);
      const timeLblW = 76;
      ctx.fillStyle = "rgba(30, 41, 59, 0.95)";
      ctx.fillRect(candleX - timeLblW / 2, H - TIME_AXIS_H, timeLblW, TIME_AXIS_H);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.strokeRect(candleX - timeLblW / 2, H - TIME_AXIS_H, timeLblW, TIME_AXIS_H);
      ctx.fillStyle = "#fff";
      ctx.font = '9px "SF Mono", ui-monospace, monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${dateLabel} ${timeLabel}`, candleX, H - TIME_AXIS_H + 12);

      // Highlight hovered candle outline
      const hcIsUp = hoverCandle.close >= hoverCandle.open;
      ctx.strokeStyle = hcIsUp ? C.bull : C.bear;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      const hcBodyTop = Math.min(toY(hoverCandle.open), toY(hoverCandle.close));
      const hcBodyBot = Math.max(toY(hoverCandle.open), toY(hoverCandle.close));
      ctx.strokeRect(
        Math.floor(candleX - barW / 2) - 1,
        Math.floor(hcBodyTop) - 1,
        barW + 2,
        Math.max(1, Math.floor(hcBodyBot - hcBodyTop)) + 2
      );
      ctx.globalAlpha = 1;

      /* ── OHLC Tooltip ─────────────────────────────────────────── */
      const isUp = hoverCandle.close >= hoverCandle.open;
      const changePct = ((hoverCandle.close - hoverCandle.open) / hoverCandle.open * 100);
      const tooltipW = 155;
      const tooltipH = 108;
      let tx = cx + 16;
      let ty = chartTop + 12;
      if (tx + tooltipW > chartRight - 10) tx = cx - tooltipW - 16;
      if (ty + tooltipH > chartBottom - 10) ty = chartBottom - tooltipH - 10;

      ctx.fillStyle = C.tooltip;
      ctx.strokeStyle = isUp ? "rgba(0,255,136,0.2)" : "rgba(230,57,70,0.2)";
      ctx.lineWidth = 1;
      const tr2 = 6;
      ctx.beginPath();
      ctx.moveTo(tx + tr2, ty);
      ctx.lineTo(tx + tooltipW - tr2, ty);
      ctx.arcTo(tx + tooltipW, ty, tx + tooltipW, ty + tr2, tr2);
      ctx.lineTo(tx + tooltipW, ty + tooltipH - tr2);
      ctx.arcTo(tx + tooltipW, ty + tooltipH, tx + tooltipW - tr2, ty + tooltipH, tr2);
      ctx.lineTo(tx + tr2, ty + tooltipH);
      ctx.arcTo(tx, ty + tooltipH, tx, ty + tooltipH - tr2, tr2);
      ctx.lineTo(tx, ty + tr2);
      ctx.arcTo(tx, ty, tx + tr2, ty, tr2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Top accent line
      ctx.fillStyle = isUp ? C.bull : C.bear;
      ctx.fillRect(tx + 1, ty + 1, tooltipW - 2, 2);

      let curY = ty + 10;
      ctx.font = '9px "SF Mono", ui-monospace, monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = C.textDim;
      ctx.fillText(`${fmtDate(visibleOrig[ci].time)} ${fmtTime(visibleOrig[ci].time)}`, tx + 10, curY);
      curY += 14;

      ctx.fillStyle = isUp ? C.bull : C.bear;
      ctx.font = 'bold 10px "SF Mono", ui-monospace, monospace';
      ctx.fillText(`Heikin Ashi  ${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`, tx + 10, curY);
      curY += 16;

      const ohlcItems: [string, number, string][] = [
        ["O", hoverCandle.open, C.textBright],
        ["H", hoverCandle.high, C.bull],
        ["L", hoverCandle.low, C.bear],
        ["C", hoverCandle.close, isUp ? C.bull : C.bear],
      ];
      ohlcItems.forEach(([label, value, color]) => {
        ctx.font = '9px "SF Mono", ui-monospace, monospace';
        ctx.fillStyle = C.textDim;
        ctx.fillText(label, tx + 10, curY);
        ctx.fillStyle = color;
        ctx.font = 'bold 10px "SF Mono", ui-monospace, monospace';
        ctx.fillText(fmtPrice(value), tx + 24, curY);
        curY += 14;
      });
    }

    /* ── Scroll indicator ──────────────────────────────────────────── */
    if (candles.length > visibleCount) {
      const scrollBarW = chartW * 0.35;
      const scrollBarH = 3;
      const scrollBarX = chartRight / 2 - scrollBarW / 2;
      const scrollBarY = H - 4;
      const thumbW = (visibleCount / candles.length) * scrollBarW;
      const thumbX = scrollBarX + (vStart / candles.length) * scrollBarW;
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(scrollBarX, scrollBarY, scrollBarW, scrollBarH);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(thumbX, scrollBarY, thumbW, scrollBarH);
    }
  }, [candles, livePrice, activeTrades, primaryTrade, hover, visibleRange]);

  /* ── Effects ──────────────────────────────────────────────────────── */
  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);
  useEffect(() => {
    const iv = setInterval(() => draw(), 100);
    return () => clearInterval(iv);
  }, [draw]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: isDraggingRef.current ? "grabbing" : hover ? "crosshair" : "default" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
};

export default TradingChart;
