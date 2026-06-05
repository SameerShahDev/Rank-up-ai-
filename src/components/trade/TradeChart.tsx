"use client";

import React, { useEffect, useRef } from "react";

interface TradeChartProps {
  candles: any[];
  livePrice: number;
  trades: any[];
  activeTrade: any;
}

const TradeChart: React.FC<TradeChartProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => {
      if (typeof (window as any).TradingView !== "undefined") {
        widgetRef.current = new (window as any).TradingView.widget({
          autosize: true,
          symbol: "BINANCE:BTCUSDT",
          interval: "1",
          timezone: "Asia/Kolkata",
          theme: "dark",
          style: "1",
          locale: "en",
          enable_publishing: false,
          hide_side_toolbar: true,
          allow_symbol_change: false,
          calendar: false,
          container_id: "tradingview_embedded_chart",
        });
      }
    };

    containerRef.current.appendChild(script);

    return () => {
      if (widgetRef.current && typeof widgetRef.current.remove === "function") {
        widgetRef.current.remove();
      }
      widgetRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative" style={{ background: "#111119" }}>
      <div
        id="tradingview_embedded_chart"
        className="w-full h-full absolute inset-0"
      />
    </div>
  );
};

export default TradeChart;
