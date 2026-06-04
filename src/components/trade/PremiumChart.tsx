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

interface PremiumChartProps {
  candles: Candle[];
  livePrice: number;
  activeTrades: ActiveTrade[];
  primaryTrade: ActiveTrade | null;
  symbol: string;
  assetColor?: string;
}

/* ─── Color Palette ──────────────────────────────────────────────────────── */
const COLORS = {
  bg: "#080c14",
  bgGrad1: "#0a0f1a",
  bgGrad2: "#060a12",
  bull: "#089981",
  bullGlow: "rgba(8, 153, 129, 0.25)",
  bullDim: "rgba(8, 153, 129, 0.08)",
  bullBody: "#089981",
  bear: "#f23645",
  bearGlow: "rgba(242, 54, 69, 0.25)",
  bearDim: "rgba(242, 54, 69, 0.08)",
  bearBody: "#f23645",
  grid: "rgba(255, 255, 255, 0.035)",
  gridStrong: "rgba(255, 255, 255, 0.06)",
  text: "rgba(148, 163, 184, 0.6)",
  textBright: "rgba(203, 213, 225, 0.85)",
  textDim: "rgba(100, 116, 139, 0.5)",
  accent: "#3b82f6",
  accentGlow: "rgba(59, 130, 246, 0.15)",
  ema7: "#ff9800",
  ema7Glow: "rgba(255, 152, 0, 0.12)",
  ema25: "#7c4dff",
  ema25Glow: "rgba(124, 77, 255, 0.12)",
  bollinger: "rgba(33, 150, 243, 0.18)",
  bollingerLine: "rgba(33, 150, 243, 0.35)",
  crosshair: "rgba(148, 163, 184, 0.25)",
  tooltip: "rgba(15, 23, 42, 0.95)",
  rsiUp: "#00e676",
  rsiDown: "#ff1744",
  rsiMid: "#64748b",
  rsiOverlay: "rgba(255, 255, 255, 0.04)",
};

/* ─── Number Formatters ──────────────────────────────────────────────────── */
function formatPrice(v: number): string {
  if (v >= 1000000) return "\u20b9" + (v / 100000).toFixed(1) + "L";
  if (v >= 10000) return "\u20b9" + v.toFixed(0);
  if (v >= 1000) return "\u20b9" + v.toFixed(1);
  if (v >= 100) return "\u20b9" + v.toFixed(2);
  if (v >= 1) return "\u20b9" + v.toFixed(3);
  return "\u20b9" + v.toFixed(4);
}

function formatPriceCompact(v: number): string {
  if (v >= 1000000) return (v / 100000).toFixed(1) + "L";
  if (v >= 10000) return v.toFixed(0);
  if (v >= 1000) return v.toFixed(1);
  if (v >= 100) return v.toFixed(2);
  return v.toFixed(3);
}

function formatVol(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(0);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/* ─── Math Helpers ───────────────────────────────────────────────────────── */
function calcEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
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
}

function calcRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length < period + 1) {
    return closes.map(() => null);
  }
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = 0; i < period; i++) result.push(null);
  const rs = avgGain / (avgLoss || 0.0001);
  result.push(100 - 100 / (1 + rs));
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi = 100 - 100 / (1 + avgGain / (avgLoss || 0.0001));
    result.push(rsi);
  }
  return result;
}

function calcBollinger(closes: number[], period = 20, stdDev = 2): { upper: (number|null)[], middle: (number|null)[], lower: (number|null)[] } {
  const upper: (number|null)[] = [];
  const middle: (number|null)[] = [];
  const lower: (number|null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(null); middle.push(null); lower.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    const avg = sum / period;
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) sqSum += (closes[j] - avg) ** 2;
    const std = Math.sqrt(sqSum / period);
    middle.push(avg);
    upper.push(avg + stdDev * std);
    lower.push(avg - stdDev * std);
  }
  return { upper, middle, lower };
}

/* ─── Nice step for grid lines ───────────────────────────────────────────── */
function niceStep(range: number, maxLines: number): number {
  const rough = range / maxLines;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * mag;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ─── PREMIUM CHART COMPONENT ──────────────────────────────────────────────
   ═══════════════════════════════════════════════════════════════════════════ */
const PremiumChart: React.FC<PremiumChartProps> = ({
  candles,
  livePrice,
  activeTrades,
  primaryTrade,
  assetColor = "#3b82f6",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Indicator visibility states
  const [showEMA7, setShowEMA7] = useState(true);
  const [showEMA25, setShowEMA25] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  // Drag-to-scroll (panning) state refs
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartRangeRef = useRef({ start: 0, end: 0 });

  const [hover, setHover] = useState<{
    x: number;
    y: number;
    idx: number;
  } | null>(null);
  const [visibleRange, setVisibleRange] = useState<{
    start: number;
    end: number;
  }>({ start: 0, end: 0 });
  const animFrameRef = useRef<number>(0);
  const pulseRef = useRef<number>(0);

  /* ── Pulse animation for live price ─────────────────────────────────── */
  useEffect(() => {
    let running = true;
    const animate = () => {
      if (!running) return;
      pulseRef.current = (pulseRef.current + 0.03) % (Math.PI * 2);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  /* ── Set visible range on candle data change ────────────────────────── */
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
          const start = Math.max(0, end - count + 1);
          return { start, end };
        }
        return prev;
      });
    }
  }, [candles.length]);

  /* ── Scroll/Zoom handler ────────────────────────────────────────────── */
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
          const newStart = Math.max(0, prev.end - newCount + 1);
          return { start: newStart, end: prev.end };
        } else {
          const scrollDelta = e.deltaY > 0 ? 3 : -3;
          const newStart = Math.max(0, Math.min(candles.length - count, prev.start + scrollDelta));
          const newEnd = Math.min(candles.length - 1, prev.start + count - 1);
          return { start: newStart, end: newEnd };
        }
      });
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [candles.length]);
  
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = container.clientWidth || 800;
    const H = container.clientHeight || 500;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    const PRICE_AXIS_W = 68;
    const TIME_AXIS_H = 22;
    const RSI_H = showRSI ? Math.floor(H * 0.15) : 0;
    const VOL_H = showVolume ? Math.floor(H * 0.12) : 0;
    const HEADER_H = 0;
    const SEPARATOR_H = 1;

    const chartLeft = 0;
    const chartRight = W - PRICE_AXIS_W;
    const chartW = chartRight - chartLeft;
    const chartTop = HEADER_H + 6;

    let sepCount = 0;
    if (showVolume) sepCount++;
    if (showRSI) sepCount++;

    const chartBottom = H - TIME_AXIS_H - RSI_H - VOL_H - SEPARATOR_H * sepCount;
    const chartH = chartBottom - chartTop;

    const volTop = chartBottom + (showVolume ? SEPARATOR_H : 0);
    const volBottom = volTop + VOL_H;

    const rsiTop = volBottom + (showRSI ? SEPARATOR_H : 0);
    const rsiBottom = rsiTop + RSI_H;

    /* ── Background ──────────────────────────────────────────────────── */
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, COLORS.bgGrad1);
    bgGrad.addColorStop(0.5, COLORS.bg);
    bgGrad.addColorStop(1, COLORS.bgGrad2);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle radial glow near center
    const centerGlow = ctx.createRadialGradient(
      chartW * 0.5, chartH * 0.4, 0,
      chartW * 0.5, chartH * 0.4, chartW * 0.6
    );
    centerGlow.addColorStop(0, "rgba(59, 130, 246, 0.015)");
    centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, W, H);

    if (candles.length < 2) return;

    /* ── Visible candles ─────────────────────────────────────────────── */
    const vStart = Math.max(0, visibleRange.start);
    const vEnd = Math.min(candles.length - 1, visibleRange.end);
    const visible = candles.slice(vStart, vEnd + 1);
    if (visible.length < 1) return;
    const visibleCount = visible.length;

    /* ── Price range ─────────────────────────────────────────────────── */
    let maxP = -Infinity;
    let minP = Infinity;
    for (const c of visible) {
      if (c.high > maxP) maxP = c.high;
      if (c.low < minP) minP = c.low;
    }
    if (livePrice > maxP) maxP = livePrice;
    if (livePrice < minP) minP = livePrice;
    const rawRange = maxP - minP || 1;
    const padR = rawRange * 0.08;
    maxP += padR;
    minP -= padR;
    const priceRange = maxP - minP;

    /* ── Scaling functions ───────────────────────────────────────────── */
    const slot = chartW / visibleCount;
    const barW = Math.max(2, Math.min(18, Math.floor(slot * 0.65)));
    const gapW = Math.max(1, Math.floor(slot * 0.15));

    const xFor = (i: number) => chartLeft + (i + 0.5) * slot;
    const toY = (p: number) => chartTop + ((maxP - p) / priceRange) * chartH;
    const px = (v: number) => Math.round(v) + 0.5;

    /* ══════════════════════════════════════════════════════════════════
       ─── GRID ────────────────────────────────────────────────────────
       ══════════════════════════════════════════════════════════════════ */
    const step = niceStep(priceRange, 6);
    const gridStart = Math.ceil(minP / step) * step;

    ctx.font = '10px "SF Mono", ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = "middle";

    // Horizontal grid lines (price)
    for (let v = gridStart; v <= maxP; v += step) {
      const y = px(toY(v));
      if (y < chartTop || y > chartBottom) continue;

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();

      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "left";
      ctx.fillText(formatPriceCompact(v), chartRight + 8, y);
    }

    // Vertical grid lines (time) — sparse
    const timeStep = Math.max(1, Math.floor(visibleCount / 7));
    for (let i = 0; i < visibleCount; i += timeStep) {
      const x = px(xFor(i));
      if (x < chartLeft || x > chartRight) continue;

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, chartTop);
      ctx.lineTo(x, chartBottom);
      ctx.stroke();

      ctx.fillStyle = COLORS.textDim;
      ctx.textAlign = "center";
      const timeStr = formatTime(visible[i].time);
      ctx.fillText(timeStr, xFor(i), H - TIME_AXIS_H + 12);
    }

    /* ── Separator lines ─────────────────────────────────────────────── */
    ctx.strokeStyle = COLORS.gridStrong;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    if (showVolume) {
      ctx.beginPath();
      ctx.moveTo(chartLeft, px(chartBottom));
      ctx.lineTo(chartRight, px(chartBottom));
      ctx.stroke();
    }
    if (showRSI) {
      ctx.beginPath();
      ctx.moveTo(chartLeft, px(volBottom));
      ctx.lineTo(chartRight, px(volBottom));
      ctx.stroke();
    }
    // Price axis vertical line
    ctx.beginPath();
    ctx.moveTo(px(chartRight), chartTop);
    ctx.lineTo(px(chartRight), showRSI ? rsiBottom : (showVolume ? volBottom : chartBottom));
    ctx.stroke();

    /* ══════════════════════════════════════════════════════════════════
       ─── BOLLINGER BANDS ─────────────────────────────────────────────
       ══════════════════════════════════════════════════════════════════ */
    const closes = visible.map((c) => c.close);
    const boll = calcBollinger(closes, 20, 2);

    // Fill between bands
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < visible.length; i++) {
      if (boll.upper[i] === null) continue;
      const x = xFor(i);
      const y = toY(boll.upper[i] as number);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    for (let i = visible.length - 1; i >= 0; i--) {
      if (boll.lower[i] === null) continue;
      const x = xFor(i);
      const y = toY(boll.lower[i] as number);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = COLORS.bollinger;
    ctx.fill();

    // Upper band line
    ctx.strokeStyle = COLORS.bollingerLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    started = false;
    for (let i = 0; i < visible.length; i++) {
      if (boll.upper[i] === null) continue;
      const x = xFor(i);
      const y = toY(boll.upper[i] as number);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Lower band line
    ctx.beginPath();
    started = false;
    for (let i = 0; i < visible.length; i++) {
      if (boll.lower[i] === null) continue;
      const x = xFor(i);
      const y = toY(boll.lower[i] as number);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    /* ══════════════════════════════════════════════════════════════════
       ─── EMA LINES ───────────────────────────────────────────────────
       ══════════════════════════════════════════════════════════════════ */
    const ema7 = calcEMA(closes, 7);
    const ema25 = calcEMA(closes, 25);

    const drawEMA = (emaData: (number | null)[], color: string, glowColor: string) => {
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < emaData.length; i++) {
        if (emaData[i] === null) continue;
        const x = xFor(i);
        const y = toY(emaData[i] as number);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      started = false;
      for (let i = 0; i < emaData.length; i++) {
        if (emaData[i] === null) continue;
        const x = xFor(i);
        const y = toY(emaData[i] as number);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.lineCap = "butt";
      ctx.lineJoin = "miter";
    };

    if (showEMA7) drawEMA(ema7, COLORS.ema7, COLORS.ema7Glow);
    if (showEMA25) drawEMA(ema25, COLORS.ema25, COLORS.ema25Glow);

    /* ══════════════════════════════════════════════════════════════════
       ─── VOLUME BARS ─────────────────────────────────────────────────
       ══════════════════════════════════════════════════════════════════ */
    const maxVol = Math.max(...visible.map((c) => c.volume || 0), 1);
    const volH_actual = volBottom - volTop - 4;

    for (let i = 0; i < visible.length; i++) {
      const c = visible[i];
      const x = xFor(i);
      const isUp = c.close >= c.open;
      const vH = Math.max(1, ((c.volume || 0) / maxVol) * volH_actual * 0.85);
      const left = Math.floor(x - barW / 2);
      const top = volBottom - 2 - vH;

      const volGrad = ctx.createLinearGradient(0, top, 0, volBottom - 2);
      if (isUp) {
        volGrad.addColorStop(0, "rgba(0, 230, 118, 0.4)");
        volGrad.addColorStop(1, "rgba(0, 230, 118, 0.06)");
      } else {
        volGrad.addColorStop(0, "rgba(255, 23, 68, 0.4)");
        volGrad.addColorStop(1, "rgba(255, 23, 68, 0.06)");
      }
      ctx.fillStyle = volGrad;
      ctx.fillRect(left, top, barW, vH);
    }

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '9px "SF Mono", ui-monospace, monospace';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("VOL", chartLeft + 6, volTop + 3);

    /* ══════════════════════════════════════════════════════════════════
       ─── RSI PANEL ───────────────────────────────────────────────────
       ══════════════════════════════════════════════════════════════════ */
    const rsiData = calcRSI(closes, 14);
    const rsiPadding = 4;
    const rsiChartH = RSI_H - rsiPadding * 2;
    const rsiToY = (v: number) => rsiTop + rsiPadding + ((100 - v) / 100) * rsiChartH;

    ctx.fillStyle = COLORS.rsiOverlay;
    ctx.fillRect(chartLeft, rsiTop, chartW, RSI_H);

    const ob70Y = rsiToY(70);
    const os30Y = rsiToY(30);

    ctx.fillStyle = "rgba(255, 23, 68, 0.04)";
    ctx.fillRect(chartLeft, rsiTop + rsiPadding, chartW, ob70Y - (rsiTop + rsiPadding));
    ctx.fillStyle = "rgba(0, 230, 118, 0.04)";
    ctx.fillRect(chartLeft, os30Y, chartW, rsiTop + rsiPadding + rsiChartH - os30Y);

    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    [70, 50, 30].forEach((level) => {
      const y = px(rsiToY(level));
      ctx.strokeStyle = level === 50 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)";
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();

      ctx.fillStyle = COLORS.textDim;
      ctx.font = '8px "SF Mono", ui-monospace, monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String(level), chartRight + 8, y);
    });
    ctx.setLineDash([]);

    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    started = false;
    for (let i = 0; i < rsiData.length; i++) {
      if (rsiData[i] === null) continue;
      const x = xFor(i);
      const y = rsiToY(rsiData[i] as number);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    const rsiGrad = ctx.createLinearGradient(0, rsiToY(70), 0, rsiToY(30));
    rsiGrad.addColorStop(0, COLORS.rsiDown);
    rsiGrad.addColorStop(0.4, COLORS.rsiMid);
    rsiGrad.addColorStop(0.6, COLORS.rsiMid);
    rsiGrad.addColorStop(1, COLORS.rsiUp);
    ctx.strokeStyle = rsiGrad;
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    if (rsiData.some(v => v !== null)) {
      ctx.beginPath();
      started = false;
      let lastX = 0;
      for (let i = 0; i < rsiData.length; i++) {
        if (rsiData[i] === null) continue;
        const x = xFor(i);
        const y = rsiToY(rsiData[i] as number);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
        lastX = x;
      }
      ctx.lineTo(lastX, rsiToY(50));
      let firstX = 0;
      for (let i = 0; i < rsiData.length; i++) {
        if (rsiData[i] !== null) { firstX = xFor(i); break; }
      }
      ctx.lineTo(firstX, rsiToY(50));
      ctx.closePath();
      const rsiFillGrad = ctx.createLinearGradient(0, rsiToY(80), 0, rsiToY(20));
      rsiFillGrad.addColorStop(0, "rgba(255, 23, 68, 0.08)");
      rsiFillGrad.addColorStop(0.5, "rgba(100, 116, 139, 0.03)");
      rsiFillGrad.addColorStop(1, "rgba(0, 230, 118, 0.08)");
      ctx.fillStyle = rsiFillGrad;
      ctx.fill();
    }

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '9px "SF Mono", ui-monospace, monospace';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("RSI(14)", chartLeft + 6, rsiTop + 3);

    const lastRsi = rsiData[rsiData.length - 1];
    if (lastRsi !== null) {
      const rsiColor = (lastRsi as number) > 70 ? COLORS.rsiDown : (lastRsi as number) < 30 ? COLORS.rsiUp : COLORS.textBright;
      ctx.fillStyle = rsiColor;
      ctx.font = 'bold 9px "SF Mono", ui-monospace, monospace';
      ctx.fillText((lastRsi as number).toFixed(1), chartLeft + 58, rsiTop + 3);
    }

    /* ══════════════════════════════════════════════════════════════════
       ─── CANDLESTICKS ────────────────────────────────────────────────
       ══════════════════════════════════════════════════════════════════ */
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

      const wickX = px(x);
      ctx.strokeStyle = isUp ? COLORS.bull : COLORS.bear;
      ctx.lineWidth = Math.max(1, Math.floor(barW / 6));
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(wickX, Math.round(yHigh));
      ctx.lineTo(wickX, Math.round(yLow));
      ctx.stroke();

      ctx.fillStyle = isUp ? COLORS.bullBody : COLORS.bearBody;
      ctx.fillRect(left, Math.floor(bodyTop), barW, Math.max(1, Math.floor(bodyH)));
    }

    /* ══════════════════════════════════════════════════════════════════
       ─── LIVE PRICE LINE ─────────────────────────────────────────────
       ══════════════════════════════════════════════════════════════════ */
    const lastCandle = visible[visible.length - 1];
    const lastY = toY(livePrice);
    const isLiveUp = livePrice >= lastCandle.open;
    const liveColor = isLiveUp ? COLORS.bull : COLORS.bear;
    const pulseAlpha = 0.15 + Math.sin(pulseRef.current) * 0.08;

    const bandH = 40;
    const bandGrad = ctx.createLinearGradient(0, lastY - bandH, 0, lastY + bandH);
    const glowBase = isLiveUp ? "0, 230, 118" : "255, 23, 68";
    bandGrad.addColorStop(0, `rgba(${glowBase}, 0)`);
    bandGrad.addColorStop(0.5, `rgba(${glowBase}, ${pulseAlpha})`);
    bandGrad.addColorStop(1, `rgba(${glowBase}, 0)`);
    ctx.fillStyle = bandGrad;
    ctx.fillRect(chartLeft, lastY - bandH, chartW, bandH * 2);

    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = liveColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(chartLeft, px(lastY));
    ctx.lineTo(chartRight, px(lastY));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    const priceLabel = formatPriceCompact(livePrice);
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
    ctx.lineTo(plX, plY + plH - r);
    ctx.arcTo(plX, plY + plH, plX + r, plY + plH, r);
    ctx.lineTo(plX + plW - r, plY + plH);
    ctx.arcTo(plX + plW, plY + plH, plX + plW, plY + plH - r, r);
    ctx.lineTo(plX + plW, plY + r);
    ctx.arcTo(plX + plW, plY, plX + plW - r, plY, r);
    ctx.lineTo(plX + r, plY);
    ctx.arcTo(plX, plY, plX, plY + r, r);
    ctx.fill();

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

    /* ══════════════════════════════════════════════════════════════════
       ─── ACTIVE TRADE ENTRY LINES ────────────────────────────────────
       ══════════════════════════════════════════════════════════════════ */
    activeTrades.forEach((trade) => {
      const y = toY(trade.entryPrice);
      if (y < chartTop || y > chartBottom) return;
      const tradeColor = trade.type === "UP" ? COLORS.bull : COLORS.bear;

      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = tradeColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(chartLeft, px(y));
      ctx.lineTo(chartRight, px(y));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      const entryLabel = formatPriceCompact(trade.entryPrice);
      ctx.font = 'bold 9px "SF Mono", ui-monospace, monospace';
      const tagW = Math.round(ctx.measureText(entryLabel).width) + 22;
      const tagH = 16;
      const tagX = chartLeft + 4;
      const tagY = Math.round(y) - tagH / 2;

      ctx.fillStyle = trade.type === "UP" ? COLORS.bullDim : COLORS.bearDim;
      ctx.strokeStyle = tradeColor;
      ctx.lineWidth = 1;
      ctx.fillRect(tagX, tagY, tagW, tagH);
      ctx.strokeRect(tagX, tagY, tagW, tagH);

      ctx.fillStyle = tradeColor;
      ctx.font = "8px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(trade.type === "UP" ? "\u25b2" : "\u25bc", tagX + 4, y);

      ctx.fillStyle = "#fff";
      ctx.font = 'bold 9px "SF Mono", ui-monospace, monospace';
      ctx.fillText(entryLabel, tagX + 14, y);
    });

    /* ══════════════════════════════════════════════════════════════════
       ─── TIMER ARC ───────────────────────────────────────────────────
       ══════════════════════════════════════════════════════════════════ */
    if (primaryTrade && primaryTrade.timeLeft > 0) {
      const progress = 1 - primaryTrade.timeLeft / primaryTrade.duration;
      const arcX = chartLeft + 28;
      const arcY = chartTop + 28;
      const arcR = 18;
      const isUp = primaryTrade.type === "UP";
      const arcColor = isUp ? COLORS.bull : COLORS.bear;

      const glowGrad = ctx.createRadialGradient(arcX, arcY, arcR - 2, arcX, arcY, arcR + 12);
      glowGrad.addColorStop(0, isUp ? "rgba(0,230,118,0.15)" : "rgba(255,23,68,0.15)");
      glowGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(arcX - arcR - 12, arcY - arcR - 12, (arcR + 12) * 2, (arcR + 12) * 2);

      ctx.beginPath();
      ctx.arc(arcX, arcY, arcR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(8, 12, 20, 0.92)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(arcX, arcY, arcR - 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(arcX, arcY, arcR - 2, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = arcColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.lineCap = "butt";

      ctx.fillStyle = "#fff";
      ctx.font = 'bold 11px "SF Mono", ui-monospace, monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${primaryTrade.timeLeft}s`, arcX, arcY);
    }

    /* ══════════════════════════════════════════════════════════════════
       ─── CROSSHAIR + TOOLTIP ─────────────────────────────────────────
       ══════════════════════════════════════════════════════════════════ */
    if (hover && hover.idx >= 0 && hover.idx < visible.length) {
      const cx = hover.x;
      const cy = hover.y;
      const ci = hover.idx;
      const hoverCandle = visible[ci];
      const candleX = xFor(ci);

      // Vertical crosshair
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = COLORS.crosshair;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px(candleX), chartTop);
      ctx.lineTo(px(candleX), rsiBottom);
      ctx.stroke();

      // Horizontal crosshair (only in chart area)
      if (cy >= chartTop && cy <= chartBottom) {
        ctx.beginPath();
        ctx.moveTo(chartLeft, px(cy));
        ctx.lineTo(chartRight, px(cy));
        ctx.stroke();

        const crossPrice = maxP - ((cy - chartTop) / chartH) * priceRange;
        const crossLabel = formatPriceCompact(crossPrice);
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

      // Time label at bottom for crosshair
      const timeLabel = formatTime(hoverCandle.time);
      const dateLabel = formatDate(hoverCandle.time);
      const timeLblW = 72;
      ctx.fillStyle = "rgba(30, 41, 59, 0.95)";
      ctx.fillRect(candleX - timeLblW / 2, H - TIME_AXIS_H, timeLblW, TIME_AXIS_H);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.strokeRect(candleX - timeLblW / 2, H - TIME_AXIS_H, timeLblW, TIME_AXIS_H);
      ctx.fillStyle = "#fff";
      ctx.font = '9px "SF Mono", ui-monospace, monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${dateLabel} ${timeLabel}`, candleX, H - TIME_AXIS_H + 11);

      // Highlight candle outline
      const hcIsUp = hoverCandle.close >= hoverCandle.open;
      ctx.strokeStyle = hcIsUp ? COLORS.bull : COLORS.bear;
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

      /* ── Premium OHLC Tooltip ───────────────────────────────────── */
      const isUp = hoverCandle.close >= hoverCandle.open;
      const changePct = ((hoverCandle.close - hoverCandle.open) / hoverCandle.open * 100);
      const tooltipW = 150;
      const tooltipH = 120;
      let tx = cx + 16;
      let ty = chartTop + 12;
      if (tx + tooltipW > chartRight - 10) tx = cx - tooltipW - 16;
      if (ty + tooltipH > chartBottom - 10) ty = chartBottom - tooltipH - 10;

      ctx.fillStyle = COLORS.tooltip;
      ctx.strokeStyle = isUp ? "rgba(0,230,118,0.2)" : "rgba(255,23,68,0.2)";
      ctx.lineWidth = 1;

      const tr = 6;
      ctx.beginPath();
      ctx.moveTo(tx + tr, ty);
      ctx.lineTo(tx + tooltipW - tr, ty);
      ctx.arcTo(tx + tooltipW, ty, tx + tooltipW, ty + tr, tr);
      ctx.lineTo(tx + tooltipW, ty + tooltipH - tr);
      ctx.arcTo(tx + tooltipW, ty + tooltipH, tx + tooltipW - tr, ty + tooltipH, tr);
      ctx.lineTo(tx + tr, ty + tooltipH);
      ctx.arcTo(tx, ty + tooltipH, tx, ty + tooltipH - tr, tr);
      ctx.lineTo(tx, ty + tr);
      ctx.arcTo(tx, ty, tx + tr, ty, tr);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isUp ? COLORS.bull : COLORS.bear;
      ctx.fillRect(tx + 1, ty + 1, tooltipW - 2, 2);

      let curY = ty + 10;
      ctx.font = '9px "SF Mono", ui-monospace, monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(`${formatDate(hoverCandle.time)} ${formatTime(hoverCandle.time)}`, tx + 10, curY);
      curY += 15;

      ctx.fillStyle = isUp ? COLORS.bull : COLORS.bear;
      ctx.font = 'bold 10px "SF Mono", ui-monospace, monospace';
      ctx.fillText(`${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`, tx + 10, curY);
      curY += 17;

      const ohlcItems: [string, number, string][] = [
        ["O", hoverCandle.open, COLORS.textBright],
        ["H", hoverCandle.high, COLORS.bull],
        ["L", hoverCandle.low, COLORS.bear],
        ["C", hoverCandle.close, isUp ? COLORS.bull : COLORS.bear],
      ];

      ohlcItems.forEach(([label, value, color]) => {
        ctx.font = '9px "SF Mono", ui-monospace, monospace';
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText(label, tx + 10, curY);
        ctx.fillStyle = color;
        ctx.font = 'bold 10px "SF Mono", ui-monospace, monospace';
        ctx.fillText(formatPriceCompact(value), tx + 24, curY);
        curY += 15;
      });

      ctx.fillStyle = COLORS.textDim;
      ctx.font = '9px "SF Mono", ui-monospace, monospace';
      ctx.fillText("V", tx + 10, curY);
      ctx.fillStyle = COLORS.textBright;
      ctx.font = 'bold 10px "SF Mono", ui-monospace, monospace';
      ctx.fillText(formatVol(hoverCandle.volume || 0), tx + 24, curY);
    }

    /* ══════════════════════════════════════════════════════════════════
       ─── OHLC DATA BAR (Top of chart — TradingView style) ───────────
       ══════════════════════════════════════════════════════════════════ */
    if (!hover && visible.length > 0) {
      const lc = visible[visible.length - 1];
      const lcIsUp = lc.close >= lc.open;

      ctx.font = '10px "SF Mono", ui-monospace, monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      let ox = chartLeft + 8;
      const oy = chartTop + 4;

      if (showEMA7) {
        ctx.fillStyle = COLORS.ema7;
        ctx.fillText("EMA7", ox, oy);
        ox += 38;
        const lastEma7 = ema7[ema7.length - 1];
        if (lastEma7 !== null) {
          ctx.fillText(formatPriceCompact(lastEma7 as number), ox, oy);
          ox += ctx.measureText(formatPriceCompact(lastEma7 as number)).width + 12;
        }
      }
      if (showEMA25) {
        ctx.fillStyle = COLORS.ema25;
        ctx.fillText("EMA25", ox, oy);
        ox += 44;
        const lastEma25 = ema25[ema25.length - 1];
        if (lastEma25 !== null) {
          ctx.fillText(formatPriceCompact(lastEma25 as number), ox, oy);
          ox += ctx.measureText(formatPriceCompact(lastEma25 as number)).width + 12;
        }
      }

      ctx.fillStyle = COLORS.textDim;
      ctx.fillText("O", ox, oy);
      ox += 10;
      ctx.fillStyle = COLORS.textBright;
      ctx.fillText(formatPriceCompact(lc.open), ox, oy);
      ox += ctx.measureText(formatPriceCompact(lc.open)).width + 8;

      ctx.fillStyle = COLORS.textDim;
      ctx.fillText("H", ox, oy);
      ox += 10;
      ctx.fillStyle = COLORS.bull;
      ctx.fillText(formatPriceCompact(lc.high), ox, oy);
      ox += ctx.measureText(formatPriceCompact(lc.high)).width + 8;

      ctx.fillStyle = COLORS.textDim;
      ctx.fillText("L", ox, oy);
      ox += 10;
      ctx.fillStyle = COLORS.bear;
      ctx.fillText(formatPriceCompact(lc.low), ox, oy);
      ox += ctx.measureText(formatPriceCompact(lc.low)).width + 8;

      ctx.fillStyle = COLORS.textDim;
      ctx.fillText("C", ox, oy);
      ox += 10;
      ctx.fillStyle = lcIsUp ? COLORS.bull : COLORS.bear;
      ctx.fillText(formatPriceCompact(lc.close), ox, oy);
    }

    /* ── Scroll indicator mini-bar ───────────────────────────────────── */
    if (candles.length > visibleCount) {
      const scrollBarW = chartW * 0.4;
      const scrollBarH = 3;
      const scrollBarX = chartRight / 2 - scrollBarW / 2;
      const scrollBarY = H - 3;
      const thumbW = (visibleCount / candles.length) * scrollBarW;
      const thumbX = scrollBarX + (vStart / candles.length) * scrollBarW;

      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(scrollBarX, scrollBarY, scrollBarW, scrollBarH);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(thumbX, scrollBarY, thumbW, scrollBarH);
    }
  }, [candles, livePrice, activeTrades, primaryTrade, hover, visibleRange, assetColor]);

  /* ── Effect: redraw on state change ────────────────────────────────── */
  useEffect(() => {
    draw();
  }, [draw]);

  /* ── ResizeObserver ────────────────────────────────────────────────── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  /* ── Pulse redraw timer ────────────────────────────────────────────── */
  useEffect(() => {
    const iv = setInterval(() => draw(), 100);
    return () => clearInterval(iv);
  }, [draw]);

  /* ── Mouse handlers ────────────────────────────────────────────────── */
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartRangeRef.current = { ...visibleRange };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const PRICE_AXIS_W = 68;
    const chartRight = rect.width - PRICE_AXIS_W;
    const chartW = chartRight;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartXRef.current;
      const slotW = chartW / (visibleRange.end - visibleRange.start + 1);
      const candleShift = Math.round(dx / slotW);
      const prev = dragStartRangeRef.current;
      const count = prev.end - prev.start + 1;
      let newStart = prev.start - candleShift;
      newStart = Math.max(0, Math.min(candles.length - count, newStart));
      setVisibleRange({ start: newStart, end: newStart + count - 1 });
      setHover(null);
      return;
    }

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

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    setHover(null);
  };

  /* ── Touch handlers for mobile ─────────────────────────────────────── */
  const pinchRef = useRef({ on: false, d0: 0, n0: 0 });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchRef.current = { on: true, d0: d, n0: visibleRange.end - visibleRange.start + 1 };
      isDraggingRef.current = false;
      return;
    }
    isDraggingRef.current = true;
    dragStartXRef.current = e.touches[0].clientX;
    dragStartRangeRef.current = { ...visibleRange };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;
    
    if (pinchRef.current.on && e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const scale = pinchRef.current.d0 / d;
      const nn = Math.max(15, Math.min(candles.length, Math.round(pinchRef.current.n0 * scale)));
      const mid = (visibleRange.start + visibleRange.end) / 2;
      const half = nn / 2;
      setVisibleRange({
        start: Math.max(0, Math.min(candles.length - nn, Math.round(mid - half))),
        end: Math.max(0, Math.min(candles.length - 1, Math.round(mid + half)))
      });
      return;
    }

    const rect = container.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const W = container.clientWidth || 800;
    const PRICE_AXIS_W = 68;
    const chartRight = W - PRICE_AXIS_W;
    const chartW = chartRight;

    if (isDraggingRef.current && e.touches.length === 1) {
      const dx = touch.clientX - dragStartXRef.current;
      const slotW = chartW / (visibleRange.end - visibleRange.start + 1);
      const candleShift = Math.round(dx / slotW);
      const prev = dragStartRangeRef.current;
      const count = prev.end - prev.start + 1;
      let newStart = prev.start - candleShift;
      newStart = Math.max(0, Math.min(candles.length - count, newStart));
      setVisibleRange({ start: newStart, end: newStart + count - 1 });
      return;
    }

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

  const handleTouchEnd = () => {
    if (pinchRef.current.on) {
      pinchRef.current.on = false;
      return;
    }
    isDraggingRef.current = false;
    setHover(null);
  };

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
      {/* Indicator toggle buttons */}
      <div className="absolute top-1 right-2 z-10 flex items-center gap-1">
        {[
          { key: 'EMA7', label: 'EMA7', state: showEMA7, setter: setShowEMA7, color: '#ff9800' },
          { key: 'EMA25', label: 'EMA25', state: showEMA25, setter: setShowEMA25, color: '#7c4dff' },
          { key: 'BB', label: 'BB', state: showBB, setter: setShowBB, color: '#2196f3' },
          { key: 'RSI', label: 'RSI', state: showRSI, setter: setShowRSI, color: '#64748b' },
          { key: 'VOL', label: 'VOL', state: showVolume, setter: setShowVolume, color: '#64748b' },
        ].map(({ key, label, state, setter, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => setter(!state)}
            className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all"
            style={{
              background: state ? `${color}20` : 'rgba(255,255,255,0.03)',
              color: state ? color : 'rgba(148,163,184,0.4)',
              border: `1px solid ${state ? `${color}40` : 'rgba(255,255,255,0.05)'}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
};

export default PremiumChart;
