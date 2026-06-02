"use client";

import React, { useState } from 'react';
import {
  Eye, EyeOff, ArrowUpRight, ArrowDownRight, Check,
  TrendingUp, Copy, ShieldCheck
} from 'lucide-react';
import type { AccountMode } from '../types/account';
import AccountToggle from './AccountToggle';
import DepositModal from './DepositModal';
import WithdrawModal from './WithdrawModal';

const WalletDashboard: React.FC<{
  accountMode: AccountMode;
  setAccountMode: (mode: AccountMode) => void;
  demoBalance: number;
  realBalance: number;
  customerPhone: string;
  sessionToken?: string;
  onDeposit: (amount: number, meta?: { orderId: string; utr?: string }) => void | Promise<unknown>;
  onWithdraw: (amount: number) => void | Promise<unknown>;
  withdrawalLimit: number;
  displayName?: string;
}> = ({
  accountMode,
  setAccountMode,
  demoBalance,
  realBalance,
  customerPhone,
  sessionToken,
  onDeposit,
  onWithdraw,
  withdrawalLimit,
  displayName,
}) => {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [copied, setCopied] = useState(false);

  const totalBalance = demoBalance + realBalance;
  const displayBalance = accountMode === 'demo' ? demoBalance : realBalance;
  const available = displayBalance * 0.7;
  const inTrades = displayBalance * 0.3;

  const addr = '0x71C...3A9F';
  const copy = () => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    window.navigator.vibrate?.(20);
    setTimeout(() => setCopied(false), 2000);
  };

  const sparklinePath = "M 0 50 Q 10 40, 20 45 T 40 30 T 60 35 T 80 15 T 100 20 T 120 5";

  return (
    <div className="px-6 pt-8 pb-12 space-y-8 max-w-2xl mx-auto font-space">
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-black text-white">Hi, {displayName || 'Trader'}</p>
        <AccountToggle mode={accountMode} onChange={setAccountMode} />
        <p className="text-[10px] text-gray-500 font-bold text-center">
          Withdraw up to ₹{withdrawalLimit.toLocaleString('en-IN')} per request · Real account only
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#161821] border border-[#ffb300]/25 rounded-2xl p-4">
          <p className="text-[10px] font-black text-[#ffb300] uppercase mb-1">Demo (practice)</p>
          <p className="text-xl font-black text-white font-mono">
            {balanceVisible ? `₹${demoBalance.toLocaleString('en-IN')}` : '••••'}
          </p>
        </div>
        <div className="bg-[#161821] border border-[#0fb359]/25 rounded-2xl p-4">
          <p className="text-[10px] font-black text-[#0fb359] uppercase mb-1">Real (withdraw)</p>
          <p className="text-xl font-black text-white font-mono">
            {balanceVisible ? `₹${realBalance.toLocaleString('en-IN')}` : '••••'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tighter text-white italic">PORTFOLIO</h1>
        <div
          onClick={copy}
          className="flex items-center gap-3 bg-[#161821] hover:bg-white/5 border-2 border-white/5 px-5 py-2 rounded-2xl cursor-pointer transition-all active:scale-95 shadow-lg group"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[11px] font-mono font-black text-gray-400 group-hover:text-white">{addr}</span>
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-600" />}
        </div>
      </div>

      <div className="relative rounded-[3rem] overflow-hidden p-8 shadow-[0_30px_70px_rgba(0,0,0,0.7)] border-2 border-white/10 bg-[#0d0e14]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2">
                {accountMode === 'demo' ? 'Demo balance' : 'Real balance'}
              </span>
              <div className="flex items-center gap-4">
                <span className="text-5xl font-black text-white font-mono italic tracking-tighter">
                  {balanceVisible
                    ? `₹${displayBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : '₹•••••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setBalanceVisible(!balanceVisible)}
                  className="p-2 bg-white/5 rounded-xl text-gray-500 hover:text-white border border-white/5"
                >
                  {balanceVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <span className="text-[10px] text-gray-500 mt-2">
                Total (demo + real): ₹{totalBalance.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-green-500/10 border-2 border-green-500/20 px-4 py-2 rounded-2xl flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400 stroke-[3]" />
              <span className="text-[12px] font-black text-green-400 font-mono">+12.4%</span>
            </div>
          </div>

          <div className="h-20 w-full mb-8 relative">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 120 50">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
                  <stop offset="50%" stopColor="#3b82f6" stopOpacity="1" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="1" />
                </linearGradient>
              </defs>
              <path d={sparklinePath} fill="none" stroke="url(#lineGradient)" strokeWidth="4" strokeLinecap="round" />
              <circle cx="120" cy="5" r="5" fill="#8b5cf6" className="animate-pulse" />
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-white/5">
            <div>
              <span className="text-[10px] font-black text-gray-500 uppercase block">Liquid</span>
              <span className="text-xl font-black text-white font-mono">
                {balanceVisible ? `₹${available.toLocaleString('en-IN')}` : '••••'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-gray-500 uppercase block">In trades</span>
              <span className="text-xl font-black text-gray-300 font-mono">
                {balanceVisible ? `₹${inTrades.toLocaleString('en-IN')}` : '••••'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-1">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#0fb359]/15 border border-[#0fb359]/30 text-[#0fb359] text-[10px] font-black uppercase tracking-wide active:opacity-80 transition-opacity"
        >
          <ArrowDownRight className="w-4 h-4 shrink-0" />
          Deposit
        </button>
        <button
          type="button"
          onClick={() => {
            if (realBalance <= 0) return;
            setShowWithdraw(true);
          }}
          disabled={realBalance <= 0}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wide border active:opacity-80 transition-opacity ${
            realBalance > 0
              ? 'bg-[#ffb300]/10 border-[#ffb300]/30 text-[#ffb300]'
              : 'bg-[#161821] border-white/5 text-gray-600 cursor-not-allowed'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 shrink-0" />
          Withdraw
        </button>
      </div>

      <div className="flex items-center justify-center gap-3 py-6 opacity-40">
        <ShieldCheck className="w-5 h-5 text-blue-500" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Encrypted wallet</span>
      </div>

      {showAdd && (
        <DepositModal
          customerMobile={customerPhone}
          sessionToken={sessionToken}
          onClose={() => setShowAdd(false)}
          onPaymentSuccess={async (amt, meta) => {
            await onDeposit(amt, meta);
            setAccountMode('real');
          }}
        />
      )}
      {showWithdraw && (
        <WithdrawModal
          balance={realBalance}
          onClose={() => setShowWithdraw(false)}
          onWithdraw={(amt) => {
            onWithdraw(amt);
            setShowWithdraw(false);
          }}
        />
      )}
    </div>
  );
};

export default WalletDashboard;

