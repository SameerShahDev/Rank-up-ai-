import React from 'react';
import { TrendingUp, Shield } from 'lucide-react';

interface CreateWalletProps {
  onWalletCreated: () => void;
}

const CreateWallet: React.FC<CreateWalletProps> = ({ onWalletCreated }) => {
  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Glow bg */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm px-6 flex flex-col items-center text-center space-y-8">
        {/* Logo */}
        <img src="/logo/logo.png" alt="Tryonetrade" className="w-20 h-20 rounded-3xl object-cover shadow-2xl shadow-blue-500/30" />

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Tryonetrade
          </h1>
          <p className="text-gray-400 text-base leading-relaxed">
            Your professional crypto trading platform
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-col w-full space-y-3">
          {[
            { icon: TrendingUp, label: 'Live candlestick charts', color: 'text-green-400' },
            { icon: Zap,        label: 'Real-time market data',  color: 'text-blue-400'  },
            { icon: Shield,     label: 'Secure & encrypted',     color: 'text-purple-400'},
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex items-center space-x-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
              <Icon className={`w-5 h-5 ${color}`} />
              <span className="text-sm text-gray-300">{label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onWalletCreated}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/25 transition-all active:scale-95"
        >
          Launch App →
        </button>

        <p className="text-xs text-gray-600">Demo mode · No real funds</p>
      </div>
    </div>
  );
};

export default CreateWallet;