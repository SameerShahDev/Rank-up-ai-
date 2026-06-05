"use client";

import React, { useState, useEffect, useRef } from "react";
import TradeChart from "./trade/TradeChart";
import { getLiveCandles, getLivePrice, tickPrices, type Candle } from "../utils/marketData";

/* ─── Trade type ─────────────────────────────────────────────────────────── */
interface Trade {
  id: string;
  type: "UP" | "DOWN";
  entryPrice: number;
  amount: number;
  duration: number;
  timeLeft: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STANDALONE CHART DEMO — No header, footer, or tabs.
   Pure chart visualization only.
   ═══════════════════════════════════════════════════════════════════════════ */
const TradingChartDemo: React.FC = () => {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [livePrice, setLivePrice] = useState(0);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SYMBOL = "BTC/INR";

  /* ── Live data feed ─────────────────────────────────────────────── */
  useEffect(() => {
    const load = () => {
      setCandles(getLiveCandles(SYMBOL, 200));
      setLivePrice(getLivePrice(SYMBOL));
    };
    load();
    tickRef.current = setInterval(() => { tickPrices(); load(); }, 600);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  /* ── Demo trade with countdown ──────────────────────────────────── */
  useEffect(() => {
    const entry = getLivePrice(SYMBOL);
    const t: Trade = { id: "d1", type: "UP", entryPrice: entry, amount: 100, duration: 60, timeLeft: 46 };
    setActiveTrade(t);
    setTrades([t]);

    countdownRef.current = setInterval(() => {
      setActiveTrade(prev => {
        if (!prev) return prev;
        const next = prev.timeLeft - 1;
        if (next <= 0) {
          const ne = getLivePrice(SYMBOL);
          const nt: Trade = { id: `d${Date.now()}`, type: Math.random() > 0.5 ? "UP" : "DOWN", entryPrice: ne, amount: 100, duration: 60, timeLeft: 60 };
          setTrades([nt]);
          return nt;
        }
        const up = { ...prev, timeLeft: next };
        setTrades([up]);
        return up;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  return (
    <div className="w-full h-full bg-[#111119]">
      <TradeChart candles={candles} livePrice={livePrice} trades={trades} activeTrade={activeTrade} />
    </div>
  );
};

export default TradingChartDemo;
