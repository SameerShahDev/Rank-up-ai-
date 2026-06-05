"use client";

import React, { useEffect, useRef } from "react";
import { createChart, ColorType, CrosshairMode, type IChartApi, type CandlestickData, type UTCTimestamp, type HistogramData } from "lightweight-charts";
import type { Candle } from "../../utils/marketData";

const CHART_BG = "#212121";
const TEXT_COLOR = "#EEEEEE";
const GRID_COLOR = "rgba(129, 139, 166, 0.2)";
const UP_COLOR = "#2D9CDB";
const DOWN_COLOR = "#EB5757";
const CROSSHAIR_COLOR = "rgba(129, 139, 166, 0.35)";
const CURRENT_LINE_COLOR = "rgba(238, 238, 238, 0.7)";

function fmtINR(p: number): string {
  return Math.round(p).toLocaleString("en-IN");
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
  const volSeriesRef = useRef<ReturnType<IChartApi["addHistogramSeries"]> | null>(null);

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
          vertLine: {
            color: CROSSHAIR_COLOR,
            width: 1,
            style: 2,
            labelBackgroundColor: "#EEEEEE",
            labelTextColor: "#212121",
          },
          horzLine: {
            color: CROSSHAIR_COLOR,
            width: 1,
            style: 2,
            labelBackgroundColor: "#EEEEEE",
            labelTextColor: "#212121",
          },
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.06, bottom: 0.28 },
          entireTextOnly: true,
        },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
          secondsVisible: true,
          barSpacing: 10,
          minBarSpacing: 6,
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
        priceFormat: { type: "custom", formatter: fmtINR },
      });

      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });

      chart.priceScale("").applyOptions({
        scaleMargins: { top: 0.83, bottom: 0 },
      });

      chartRef.current = chart;
      seriesRef.current = series;
      volSeriesRef.current = volSeries;
    } catch (e) {
      console.error("TradeChart init error:", e);
    }

    return () => {
      const c = chartRef.current;
      if (c) { c.remove(); }
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const volSeries = volSeriesRef.current;
    if (!series || !candles.length) return;

    const chartData: CandlestickData[] = candles.map((c) => ({
      time: (c.time / 1000) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volData: HistogramData[] = candles.map((c) => ({
      time: (c.time / 1000) as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? "rgba(45,156,219,0.2)" : "rgba(235,87,87,0.2)",
    }));

    try {
      series.setData(chartData);
      volSeries?.setData(volData);
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

    const volSeries = volSeriesRef.current;
    if (volSeries) {
      volSeries.update({
        time: (lastCandle.time / 1000) as UTCTimestamp,
        value: lastCandle.volume,
        color: livePrice >= lastCandle.open ? "rgba(45,156,219,0.2)" : "rgba(235,87,87,0.2)",
      });
    }

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
