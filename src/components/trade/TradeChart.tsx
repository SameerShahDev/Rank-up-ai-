"use client";

import React from "react";

interface TradeChartProps {
  candles?: any[];
  livePrice?: any;
  trades?: any[];
  activeTrade?: any;
}

const TradeChart: React.FC<TradeChartProps> = () => {
  const iframeUrl = "https://www.geckoterminal.com/binance-smart-chain/pools/0x58f876857a02d6762e0101bb5c46a8c1ed44dc16?embed=1&info=0&swaps=0&grayscale=0&light_mode=0";

  return (
    <div className="w-full h-full min-h-[320px] md:min-h-[400px] relative" style={{ background: "#111119" }}>
      <iframe
        src={iframeUrl}
        title="Live Binary Crypto Chart"
        className="w-full h-full absolute inset-0 border-0"
        style={{ width: "100%", height: "100%", minHeight: "100%" }}
        allowFullScreen
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
};

export default TradeChart;
