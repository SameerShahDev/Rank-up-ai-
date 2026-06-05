"use client";

import React, { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, type ISeriesApi, type IPriceLine } from "lightweight-charts";

interface ActiveTrade {
  id: string;
  type: "UP" | "DOWN";
  entryPrice: number;
  amount: number;
  duration: number;
  timeLeft: number;
}

interface TradeChartProps {
  candles?: any[];
  livePrice?: number;
  trades?: ActiveTrade[];
  activeTrade?: ActiveTrade | null;
}

const TradeChart: React.FC<TradeChartProps> = ({ trades = [], activeTrade = null, livePrice = 0 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastCandleRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 350,
      layout: {
        background: { color: "#111119" },
        textColor: "#aaa",
      },
      grid: {
        vertLines: { color: "rgba(42, 46, 57, 0.1)" },
        horzLines: { color: "rgba(42, 46, 57, 0.1)" },
      },
      crosshair: { mode: 1 },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const cs = chart.addSeries(CandlestickSeries, {
      upColor: "#00b58a",
      downColor: "#f6465d",
      borderVisible: false,
      wickUpColor: "#00b58a",
      wickDownColor: "#f6465d",
    });

    candlestickSeriesRef.current = cs;

    let count = 60;
    let endTime = Math.floor(Date.now() / 1000);
    const mockData = [];
    let basePrice = 68000;

    for (let i = count; i > 0; i--) {
      const time = endTime - i * 60;
      const open = basePrice + (Math.random() - 0.5) * 50;
      const high = open + Math.random() * 40;
      const low = open - Math.random() * 40;
      const close = (high + low) / 2;
      mockData.push({ time, open, high, low, close });
      basePrice = close;
    }
    cs.setData(mockData);

    lastCandleRef.current = mockData[mockData.length - 1];

    const interval = setInterval(() => {
      const currentTime = Math.floor(Date.now() / 1000);
      const roundedTime = currentTime - (currentTime % 60);
      const lc = lastCandleRef.current;

      if (roundedTime > lc.time) {
        lastCandleRef.current = {
          time: roundedTime,
          open: lc.close,
          high: lc.close,
          low: lc.close,
          close: lc.close,
        };
      } else {
        const priceChange = (Math.random() - 0.5) * 15;
        lc.close = Number((lc.close + priceChange).toFixed(2));
        if (lc.close > lc.high) lc.high = lc.close;
        if (lc.close < lc.low) lc.low = lc.close;
      }

      cs.update(lastCandleRef.current);
    }, 300);

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  const tradeLinesRef = useRef<Map<string, IPriceLine>>(new Map());

  useEffect(() => {
    const cs = candlestickSeriesRef.current;
    if (!cs) return;
    const lines = tradeLinesRef.current;
    const activeIds = new Set(trades.map(t => t.id));

    for (const [id, line] of lines) {
      if (!activeIds.has(id)) {
        cs.removePriceLine(line);
        lines.delete(id);
      }
    }

    for (const t of trades) {
      const existing = lines.get(t.id);
      if (existing) {
        existing.applyOptions({ title: `${t.type === "UP" ? "↑" : "↓"} ${t.type} ₹${t.amount} - ${t.timeLeft}s` });
        continue;
      }
      const line = cs.createPriceLine({
        price: t.entryPrice,
        color: t.type === "UP" ? "#10B981" : "#F43F5E",
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${t.type === "UP" ? "↑" : "↓"} ${t.type} ₹${t.amount} - ${t.timeLeft}s`,
      });
      lines.set(t.id, line);
    }
  }, [trades]);

  const isWinning = activeTrade
    ? activeTrade.type === "UP"
      ? livePrice > activeTrade.entryPrice
      : livePrice < activeTrade.entryPrice
    : false;

  return (
    <div className="w-full h-full min-h-[320px] md:min-h-[400px] relative" style={{ background: "#111119" }}>
      <div
        ref={chartContainerRef}
        className="w-full h-full absolute inset-0 block"
        style={{ minHeight: "100%" }}
      />

      {activeTrade && (
        <div className="absolute top-3 right-3 z-50 flex flex-col gap-1.5 min-w-[160px] rounded-lg px-3 py-2" style={{
          background: "rgba(17,17,25,0.92)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(8px)",
        }}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Direction</span>
            <span className={`text-[10px] font-black ${activeTrade.type === "UP" ? "text-emerald-400" : "text-rose-400"}`}>
              {activeTrade.type === "UP" ? "↑ UP" : "↓ DOWN"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Status</span>
            <span className={`text-[10px] font-black ${isWinning ? "text-emerald-400" : "text-rose-400"}`}>
              {isWinning ? "🟢 WINNING" : "🔴 LOSING"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Payout</span>
            <span className={`text-[10px] font-black tabular-nums ${isWinning ? "text-emerald-400" : "text-slate-500"}`}>
              {isWinning
                ? `+₹${(activeTrade.amount * 2).toLocaleString("en-IN")}`
                : "₹0"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Time</span>
            <span className="text-[10px] font-black tabular-nums text-slate-300">
              {activeTrade.timeLeft}s
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeChart;
