"use client";

import React, { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, type ISeriesApi } from "lightweight-charts";

interface TradeChartProps {
  candles?: any[];
  livePrice?: number;
  trades?: any[];
  activeTrade?: any;
}

const TradeChart: React.FC<TradeChartProps> = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

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
      crosshair: {
        mode: 1,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00b58a",
      downColor: "#f6465d",
      borderVisible: false,
      wickUpColor: "#00b58a",
      wickDownColor: "#f6465d",
    });

    candlestickSeriesRef.current = candlestickSeries;

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
        const priceChange = (Math.random() - 0.5) * 15;
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

  return (
    <div className="w-full h-full min-h-[320px] md:min-h-[400px] relative" style={{ background: "#111119" }}>
      <div 
        ref={chartContainerRef} 
        className="w-full h-full absolute inset-0 block" 
        style={{ minHeight: "100%" }}
      />
    </div>
  );
};

export default TradeChart;
