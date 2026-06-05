"use client";

import React, { useEffect, useState, useMemo } from "react";

interface Trade {
  id: string;
  type: "UP" | "DOWN";
  amount: number;
  entryPrice: number;
  timeLeft: number;
}

interface TradeChartProps {
  candles?: any[];
  livePrice?: number;
  trades?: Trade[];
  activeTrade?: any;
}

export default function TradeChart({ trades = [] }: TradeChartProps) {
  const [mockCandles, setMockCandles] = useState<any[]>([]);

  useEffect(() => {
    let base = 68050;
    const initialCandles = Array.from({ length: 40 }).map((_, i) => {
      const open = base + (Math.random() - 0.5) * 30;
      const high = open + Math.random() * 20;
      const low = open - Math.random() * 20;
      const close = (high + low) / 2;
      base = close;
      return { open, high, low, close, id: i };
    });
    setMockCandles(initialCandles);

    const timer = setInterval(() => {
      setMockCandles((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const lastIdx = next.length - 1;
        const current = { ...next[lastIdx] };

        const change = (Math.random() - 0.5) * 8;
        current.close = Number((current.close + change).toFixed(2));
        if (current.close > current.high) current.high = current.close;
        if (current.close < current.low) current.low = current.close;

        next[lastIdx] = current;

        if (Math.random() > 0.85) {
          next.shift();
          next.push({
            open: current.close,
            high: current.close,
            low: current.close,
            close: current.close,
            id: Date.now(),
          });
        }
        return next;
      });
    }, 800);

    return () => clearInterval(timer);
  }, []);

  const bounds = useMemo(() => {
    if (mockCandles.length === 0) return { min: 68000, max: 68100 };
    const highs = mockCandles.map((c) => c.high);
    const lows = mockCandles.map((c) => c.low);
    trades.forEach(t => {
      highs.push(t.entryPrice);
      lows.push(t.entryPrice);
    });
    return {
      max: Math.max(...highs) + 5,
      min: Math.min(...lows) - 5,
    };
  }, [mockCandles, trades]);

  if (mockCandles.length === 0) {
    return <div className="w-full h-full bg-[#111119] flex items-center justify-center text-gray-500">Loading Chart Engine...</div>;
  }

  const lastPrice = mockCandles[mockCandles.length - 1].close;

  return (
    <div className="w-full h-full min-h-[320px] md:min-h-[400px] relative bg-[#111119] select-none font-mono text-[10px] text-gray-400 overflow-hidden">
      <div className="absolute right-0 top-0 bottom-0 w-14 border-l border-gray-800/40 bg-[#111119]/80 flex flex-col justify-between py-4 z-10">
        <span>{bounds.max.toFixed(0)}</span>
        <span className="text-[#00b58a] bg-[#00b58a]/10 px-1 border border-[#00b58a]/20 font-bold">{lastPrice.toFixed(2)}</span>
        <span>{bounds.min.toFixed(0)}</span>
      </div>

      <div className="w-full h-full absolute inset-0 pr-14 py-2">
        <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
          <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          <line x1="0" y1="100" x2="400" y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          <line x1="0" y1="150" x2="400" y2="150" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

          {mockCandles.map((candle, idx) => {
            const x = (idx / mockCandles.length) * 400 + 4;
            const width = 6;

            const yOpen = 200 - ((candle.open - bounds.min) / (bounds.max - bounds.min)) * 200;
            const yClose = 200 - ((candle.close - bounds.min) / (bounds.max - bounds.min)) * 200;
            const yHigh = 200 - ((candle.high - bounds.min) / (bounds.max - bounds.min)) * 200;
            const yLow = 200 - ((candle.low - bounds.min) / (bounds.max - bounds.min)) * 200;

            const isUp = candle.close >= candle.open;
            const candleColor = isUp ? "#00b58a" : "#f6465d";

            return (
              <g key={candle.id}>
                <line x1={x + width / 2} y1={yHigh} x2={x + width / 2} y2={yLow} stroke={candleColor} strokeWidth="1" />
                <rect
                  x={x}
                  y={Math.min(yOpen, yClose)}
                  width={width}
                  height={Math.max(Math.abs(yOpen - yClose), 1.5)}
                  fill={candleColor}
                />
              </g>
            );
          })}

          {trades.map((trade) => {
            const yPos = 200 - ((trade.entryPrice - bounds.min) / (bounds.max - bounds.min)) * 200;
            if (yPos < 0 || yPos > 200) return null;

            const markerColor = trade.type === "UP" ? "#00b58a" : "#f6465d";
            const glowColor = trade.type === "UP" ? "rgba(0,181,138,0.2)" : "rgba(246,70,93,0.2)";

            return (
              <g key={trade.id}>
                <line
                  x1="0" y1={yPos} x2="400" y2={yPos}
                  stroke={glowColor} strokeWidth="6"
                />
                <line
                  x1="0" y1={yPos} x2="400" y2={yPos}
                  stroke={markerColor} strokeWidth="2" strokeDasharray="5,4"
                />
                <circle cx="8" cy={yPos} r="3" fill={markerColor} />
                <rect x="16" y={yPos - 9} width="76" height="16" rx="3" fill={markerColor} />
                <text x="20" y={yPos} dy="1" fill="#0b0c10" fontSize="7" fontWeight="800">
                  {trade.type} ₹{trade.amount}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
