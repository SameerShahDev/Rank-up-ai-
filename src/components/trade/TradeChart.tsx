"use client";

import React, { useEffect, useRef } from "react";
import { createChart, ISeriesApi, IPriceLine } from "lightweight-charts";

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

const TradeChart: React.FC<TradeChartProps> = ({ trades = [] }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const activeLinesRef = useRef<{ [key: string]: IPriceLine }>({});

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
        vertLines: { color: "rgba(42, 46, 57, 0.05)" },
        horzLines: { color: "rgba(42, 46, 57, 0.05)" },
      },
      timeScale: { timeVisible: true, secondsVisible: true },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#00b58a",
      downColor: "#f6465d",
      borderVisible: false,
      wickUpColor: "#00b58a",
      wickDownColor: "#f6465d",
    });

    candlestickSeriesRef.current = candlestickSeries;

    let count = 80;
    let endTime = Math.floor(Date.now() / 1000);
    const mockData = [];
    let basePrice = 68050;

    for (let i = count; i > 0; i--) {
      const time = endTime - i * 60;
      const open = basePrice + (Math.random() - 0.5) * 40;
      const high = open + Math.random() * 25;
      const low = open - Math.random() * 25;
      const close = (high + low) / 2;
      mockData.push({ time, open, high, low, close });
      basePrice = close;
    }
    candlestickSeries.setData(mockData);

    let lastCandle = mockData[mockData.length - 1];
    const interval = setInterval(() => {
      const currentTime = Math.floor(Date.now() / 1000);
      const roundedTime = currentTime - (currentTime % 60);

      if (roundedTime > lastCandle.time) {
        lastCandle = {
          time: roundedTime,
          open: lastCandle.close,
          high: lastCandle.close,
          low: lastCandle.close,
          close: lastCandle.close,
        };
      } else {
        const priceChange = (Math.random() - 0.5) * 10;
        lastCandle.close = Number((lastCandle.close + priceChange).toFixed(2));
        if (lastCandle.close > lastCandle.high) lastCandle.high = lastCandle.close;
        if (lastCandle.close < lastCandle.low) lastCandle.low = lastCandle.close;
      }
      candlestickSeries.update(lastCandle);
    }, 1000);

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

  useEffect(() => {
    if (!candlestickSeriesRef.current) return;

    const series = candlestickSeriesRef.current;

    Object.keys(activeLinesRef.current).forEach((id) => {
      if (!trades.find((t) => t.id === id)) {
        series.removePriceLine(activeLinesRef.current[id]);
        delete activeLinesRef.current[id];
      }
    });

    trades.forEach((trade) => {
      let line = activeLinesRef.current[trade.id];
      if (line) {
        line.applyOptions({ title: `${trade.type} ₹${trade.amount} · ${trade.timeLeft}s` });
        return;
      }
      const lineColor = trade.type === "UP" ? "#00b58a" : "#f6465d";
      line = series.createPriceLine({
        price: trade.entryPrice,
        color: lineColor,
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `${trade.type} ₹${trade.amount} · ${trade.timeLeft}s`,
      });
      activeLinesRef.current[trade.id] = line;
    });
  }, [trades]);

  return (
    <div className="w-full h-full min-h-[320px] md:min-h-[400px] relative" style={{ background: "#111119" }}>
      <div ref={chartContainerRef} className="w-full h-full absolute inset-0 block" />
    </div>
  );
};

export default TradeChart;
