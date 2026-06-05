"use client";

import React, { useEffect, useRef } from "react";
import { createChart, ColorType, CrosshairMode, type IChartApi, type CandlestickData, type UTCTimestamp } from "lightweight-charts";
import type { Candle } from "../../utils/marketData";

const CHART_BG = "#1C1E22";
const TEXT_COLOR = "rgba(140, 156, 178, 0.7)";
const GRID_COLOR = "rgba(38, 41, 46, 0.4)";
const UP_COLOR = "#00B074";
const DOWN_COLOR = "#F3505D";

function formatPrice(price: number): string {
  if (price >= 1000000) return price.toFixed(0);
  if (price >= 1000) return price.toFixed(0);
  if (price >= 100) return price.toFixed(2);
  if (price >= 10) return price.toFixed(2);
  if (price >= 1) return price.toFixed(3);
  return price.toFixed(4);
}

const TradeChart: React.FC<{
  candles: Candle[];
  livePrice: number;
  trades?: unknown[];
  activeTrade?: unknown;
}> = ({ candles, livePrice }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi["addCandlestickSeries"]> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const chart = createChart(container, {
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: CHART_BG },
          textColor: TEXT_COLOR,
        },
        grid: {
          vertLines: { color: GRID_COLOR, visible: false },
          horzLines: { color: GRID_COLOR },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "rgba(140, 156, 178, 0.35)", width: 1, style: 2, labelBackgroundColor: CHART_BG },
          horzLine: { color: "rgba(140, 156, 178, 0.35)", width: 1, style: 2, labelBackgroundColor: CHART_BG },
        },
        rightPriceScale: {
          borderColor: GRID_COLOR,
          scaleMargins: { top: 0.1, bottom: 0.1 },
          entireTextOnly: true,
        },
        timeScale: {
          borderColor: GRID_COLOR,
          timeVisible: true,
          secondsVisible: false,
          barSpacing: 10,
          minBarSpacing: 8,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        handleScroll: false,
        handleScale: false,
      });

      const series = chart.addCandlestickSeries({
        upColor: UP_COLOR,
        downColor: DOWN_COLOR,
        borderUpColor: UP_COLOR,
        borderDownColor: DOWN_COLOR,
        wickUpColor: UP_COLOR,
        wickDownColor: DOWN_COLOR,
        priceFormat: { type: "custom", formatter: formatPrice },
      });

      chartRef.current = chart;
      seriesRef.current = series;
    } catch (e) {
      console.error("TradeChart init error:", e);
    }

    return () => {
      const c = chartRef.current;
      if (c) { c.remove(); }
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !candles.length) return;

    const chartData: CandlestickData[] = candles.map((c) => ({
      time: (c.time / 1000) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    try {
      series.setData(chartData);
      chartRef.current?.timeScale().scrollToRealTime();
    } catch (e) {
      console.error("TradeChart data error:", e);
    }
  }, [candles]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !candles.length) return;

    const lastCandle = candles[candles.length - 1];
    const updateData: Partial<CandlestickData> = {
      time: (lastCandle.time / 1000) as UTCTimestamp,
      close: livePrice,
    };

    if (livePrice > lastCandle.high) updateData.high = livePrice;
    if (livePrice < lastCandle.low) updateData.low = livePrice;

    try {
      series.update(updateData as CandlestickData);
    } catch (e) {
      console.error("TradeChart update error:", e);
    }
  }, [livePrice]);

  return (
    <div className="w-full h-full" style={{ background: CHART_BG }}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default TradeChart;
