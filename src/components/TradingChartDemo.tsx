"use client";

import React, { useState, useEffect, useRef } from "react";
import TradingChart from "./trade/TradingChart";
import { getLiveCandles, getLivePrice, tickPrices, type Candle } from "../utils/marketData";

/* ─── Active trade type ──────────────────────────────────────────────────── */
interface ActiveTrade {
  id: string;
  type: "UP" | "DOWN";
  entryPrice: number;
  amount: number;
  duration: number;
  timeLeft: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRADING CHART DEMO — Isolated chart visualization only
   ═══════════════════════════════════════════════════════════════════════════ */
const TradingChartDemo: React.FC = () => {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [livePrice, setLivePrice] = useState(0);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [primaryTrade, setPrimaryTrade] = useState<ActiveTrade | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SYMBOL = "BTC/INR";

  /* ── Initialize candle data + live price ──────────────────────────── */
  useEffect(() => {
    const load = () => {
      const c = getLiveCandles(SYMBOL, 200);
      setCandles(c);
      setLivePrice(getLivePrice(SYMBOL));
    };
    load();
    // Tick market data every 600ms
    tickRef.current = setInterval(() => {
      tickPrices();
      load();
    }, 600);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  /* ── Create a demo trade on mount ────────────────────────────────── */
  useEffect(() => {
    const entry = getLivePrice(SYMBOL);
    const trade: ActiveTrade = {
      id: "demo-1",
      type: "UP",
      entryPrice: entry,
      amount: 100,
      duration: 60,
      timeLeft: 46,
    };
    setPrimaryTrade(trade);
    setActiveTrades([trade]);

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setPrimaryTrade((prev) => {
        if (!prev) return prev;
        const newTime = prev.timeLeft - 1;
        if (newTime <= 0) {
          // Reset with new trade
          const newEntry = getLivePrice(SYMBOL);
          const newTrade: ActiveTrade = {
            id: `demo-${Date.now()}`,
            type: Math.random() > 0.5 ? "UP" : "DOWN",
            entryPrice: newEntry,
            amount: 100,
            duration: 60,
            timeLeft: 60,
          };
          setActiveTrades([newTrade]);
          return newTrade;
        }
        const updated = { ...prev, timeLeft: newTime };
        setActiveTrades([updated]);
        return updated;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  return (
    <div className="w-full h-full bg-[#1a1a2e]">
      <TradingChart
        candles={candles}
        livePrice={livePrice}
        activeTrades={activeTrades}
        primaryTrade={primaryTrade}
      />
    </div>
  );
};

export default TradingChartDemo;
