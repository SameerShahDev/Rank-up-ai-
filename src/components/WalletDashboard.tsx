"use client";

import React, { useState } from 'react';
import {
  Eye, EyeOff, ArrowUpRight, ArrowDownRight, Check,
  TrendingUp, Copy, ShieldCheck, Zap, Target, BookOpen, Lock
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
  onDeposit: (amount: number, meta?: { orderId: string; utr?: string }) => void | Promise<unknown>;
  onWithdraw: (amount: number) => void | Promise<unknown>;
  withdrawalLimit: number;
  displayName?: string;
}> = ({
  accountMode,
  setAccountMode,
  demoBalance,
  realBalance,
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
    <div className="px-4 pt-4 pb-12 space-y-4 max-w-2xl mx-auto font-space sm:pt-6 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 sm:gap-3">
        <p className="text-xs font-black text-white sm:text-sm">Hi, {displayName || 'Trader'}</p>
        <AccountToggle mode={accountMode} onChange={setAccountMode} />
        <p className="text-[9px] text-gray-500 font-bold text-center sm:text-[10px]">
          Withdraw up to ₹{withdrawalLimit.toLocaleString('en-IN')} per request · Real account only
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="bg-[#161821] border border-[#ffb300]/25 rounded-xl p-3 sm:rounded-2xl sm:p-4">
          <p className="text-[9px] font-black text-[#ffb300] uppercase mb-1 sm:text-[10px]">Demo (practice)</p>
          <p className="text-lg font-black text-white font-mono sm:text-xl">
            {balanceVisible ? `₹${demoBalance.toLocaleString('en-IN')}` : '••••'}
          </p>
        </div>
        <div className="bg-[#161821] border border-[#0fb359]/25 rounded-xl p-3 sm:rounded-2xl sm:p-4">
          <p className="text-[9px] font-black text-[#0fb359] uppercase mb-1 sm:text-[10px]">Real (withdraw)</p>
          <p className="text-lg font-black text-white font-mono sm:text-xl">
            {balanceVisible ? `₹${realBalance.toLocaleString('en-IN')}` : '••••'}
          </p>
        </div>
      </div>

      {/* Portfolio Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tighter text-white sm:text-2xl">PORTFOLIO</h1>
        <div
          onClick={copy}
          className="flex items-center gap-1.5 bg-[#161821] hover:bg-white/5 border border-white/5 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all active:scale-95 shadow-lg group sm:gap-2 sm:px-4 sm:py-2 sm:rounded-2xl"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse sm:w-2 sm:h-2" />
          <span className="text-[9px] font-mono font-black text-gray-400 group-hover:text-white sm:text-[10px]">{addr}</span>
          {copied ? <Check className="w-3.5 h-3.5 text-green-400 sm:w-4 sm:h-4" /> : <Copy className="w-3.5 h-3.5 text-gray-600 sm:w-4 sm:h-4" />}
        </div>
      </div>

      {/* Main Portfolio Card */}
      <div className="relative rounded-2xl overflow-hidden p-4 shadow-[0_30px_70px_rgba(0,0,0,0.7)] border border-white/10 bg-[#0d0e14] sm:rounded-[2rem] sm:p-6">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/20 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 pointer-events-none sm:w-60 sm:h-60 sm:blur-[80px]" />
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4 sm:mb-6">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5 sm:text-[10px] sm:mb-1">
                {accountMode === 'demo' ? 'Demo balance' : 'Real balance'}
              </span>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-2xl font-black text-white font-mono tracking-tighter sm:text-4xl">
                  {balanceVisible
                    ? `₹${displayBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                    : '₹•••••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setBalanceVisible(!balanceVisible)}
                  className="p-1 bg-white/5 rounded-lg text-gray-500 hover:text-white border border-white/5 sm:p-1.5"
                >
                  {balanceVisible ? <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </button>
              </div>
              <span className="text-[9px] text-gray-500 mt-0.5 sm:text-[10px] sm:mt-1">
                Total (demo + real): ₹{totalBalance.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg flex items-center gap-1 sm:px-3 sm:py-1.5 sm:rounded-xl sm:gap-1.5">
              <TrendingUp className="w-3 h-3 text-green-400 stroke-[3] sm:w-3.5 sm:h-3.5" />
              <span className="text-[10px] font-black text-green-400 font-mono sm:text-[11px]">+12.4%</span>
            </div>
          </div>

          {/* Sparkline */}
          <div className="h-12 w-full mb-4 relative sm:h-16 sm:mb-6">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 120 50">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
                  <stop offset="50%" stopColor="#3b82f6" stopOpacity="1" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="1" />
                </linearGradient>
              </defs>
              <path d={sparklinePath} fill="none" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" />
              <circle cx="120" cy="5" r="4" fill="#8b5cf6" className="animate-pulse" />
            </svg>
          </div>

          {/* Liquid / In Trades */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5 sm:gap-6 sm:pt-4">
            <div>
              <span className="text-[9px] font-black text-gray-500 uppercase block sm:text-[10px]">Liquid</span>
              <span className="text-base font-black text-white font-mono sm:text-lg">
                {balanceVisible ? `₹${available.toLocaleString('en-IN')}` : '••••'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black text-gray-500 uppercase block sm:text-[10px]">In trades</span>
              <span className="text-base font-black text-gray-300 font-mono sm:text-lg">
                {balanceVisible ? `₹${inTrades.toLocaleString('en-IN')}` : '••••'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DEPOSIT & WITHDRAW — BIG ACTION CARDS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-2.5 sm:space-y-3">
        {/* Deposit Card — Big & Green */}
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full group relative overflow-hidden rounded-2xl border-2 border-[#0fb359]/40 bg-gradient-to-br from-[#0fb359]/20 via-[#0fb359]/10 to-[#0a1f12] p-4 text-left transition-all active:scale-[0.98] hover:border-[#0fb359]/60 hover:shadow-[0_0_40px_rgba(15,179,89,0.15)] sm:rounded-3xl sm:p-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0fb359]/15 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-[#0fb359]/25 transition-all sm:w-40 sm:h-40 sm:blur-[60px]" />
          <div className="relative z-10 flex items-center gap-3 sm:gap-5">
            <div className="w-12 h-12 rounded-xl bg-[#0fb359]/20 border-2 border-[#0fb359]/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform sm:w-16 sm:h-16 sm:rounded-2xl">
              <ArrowDownRight className="w-6 h-6 text-[#0fb359] stroke-[2.5] sm:w-8 sm:h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 sm:gap-2 sm:mb-1">
                <h3 className="text-base font-black text-[#0fb359] uppercase tracking-tight sm:text-lg">Deposit</h3>
                <Zap className="w-3 h-3 text-[#0fb359] animate-pulse sm:w-4 sm:h-4" />
              </div>
              <p className="text-[10px] text-gray-400 font-bold leading-relaxed sm:text-[11px]">
                Add real money via UPI · Instant credit
              </p>
            </div>
            <div className="shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[#0fb359]/10 flex items-center justify-center group-hover:bg-[#0fb359]/20 transition-colors sm:w-10 sm:h-10 sm:rounded-xl">
                <ArrowDownRight className="w-4 h-4 text-[#0fb359] sm:w-5 sm:h-5" />
              </div>
            </div>
          </div>
          {/* Bottom info bar */}
          <div className="relative z-10 mt-3 pt-2.5 border-t border-[#0fb359]/15 flex items-center justify-between sm:mt-4 sm:pt-3">
            <span className="text-[8px] font-black text-[#0fb359]/70 uppercase tracking-wider sm:text-[10px]">PayBolt UPI Gateway</span>
            <span className="text-[8px] font-black text-[#0fb359]/70 uppercase tracking-wider sm:text-[10px]">Min ₹1</span>
          </div>
        </button>

        {/* Withdraw Card — Big & Gold */}
        <button
          type="button"
          onClick={() => {
            if (realBalance <= 0 && demoBalance <= 0) return;
            setShowWithdraw(true);
          }}
          disabled={realBalance <= 0 && demoBalance <= 0}
          className={`w-full group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] sm:rounded-3xl sm:p-6 ${
            realBalance > 0 || demoBalance > 0
              ? 'border-[#ffb300]/40 bg-gradient-to-br from-[#ffb300]/20 via-[#ffb300]/10 to-[#1f180a] hover:border-[#ffb300]/60 hover:shadow-[0_0_40px_rgba(255,179,0,0.15)]'
              : 'border-white/5 bg-[#161821] opacity-50 cursor-not-allowed'
          }`}
        >
          {realBalance > 0 || demoBalance > 0 ? (
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffb300]/15 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-[#ffb300]/25 transition-all sm:w-40 sm:h-40 sm:blur-[60px]" />
          ) : null}
          <div className="relative z-10 flex items-center gap-3 sm:gap-5">
            <div className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center shrink-0 transition-transform sm:w-16 sm:h-16 sm:rounded-2xl ${
              realBalance > 0 || demoBalance > 0
                ? 'bg-[#ffb300]/20 border-[#ffb300]/30 group-hover:scale-110'
                : 'bg-white/5 border-white/5'
            }`}>
              <ArrowUpRight className={`w-6 h-6 stroke-[2.5] sm:w-8 sm:h-8 ${realBalance > 0 || demoBalance > 0 ? 'text-[#ffb300]' : 'text-gray-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 sm:gap-2 sm:mb-1">
                <h3 className={`text-base font-black uppercase tracking-tight sm:text-lg ${realBalance > 0 || demoBalance > 0 ? 'text-[#ffb300]' : 'text-gray-600'}`}>Withdraw</h3>
                {realBalance > 0 || demoBalance > 0 ? <Lock className="w-3 h-3 text-[#ffb300]/70 sm:w-4 sm:h-4" /> : null}
              </div>
              <p className={`text-[10px] font-bold leading-relaxed sm:text-[11px] ${realBalance > 0 || demoBalance > 0 ? 'text-gray-400' : 'text-gray-600'}`}>
                {realBalance > 0 || demoBalance > 0
                  ? `Available: ₹${(realBalance > 0 ? realBalance : demoBalance).toLocaleString('en-IN')} · Max ₹${withdrawalLimit.toLocaleString('en-IN')}/req`
                  : 'No balance available for withdrawal'}
              </p>
            </div>
            <div className="shrink-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors sm:w-10 sm:h-10 sm:rounded-xl ${
                realBalance > 0 || demoBalance > 0 ? 'bg-[#ffb300]/10 group-hover:bg-[#ffb300]/20' : 'bg-white/5'
              }`}>
                <ArrowUpRight className={`w-4 h-4 sm:w-5 sm:h-5 ${realBalance > 0 || demoBalance > 0 ? 'text-[#ffb300]' : 'text-gray-600'}`} />
              </div>
            </div>
          </div>
          {/* Bottom info bar */}
          <div className={`relative z-10 mt-3 pt-2.5 border-t flex items-center justify-between sm:mt-4 sm:pt-3 ${realBalance > 0 || demoBalance > 0 ? 'border-[#ffb300]/15' : 'border-white/5'}`}>
            <span className={`text-[8px] font-black uppercase tracking-wider sm:text-[10px] ${realBalance > 0 || demoBalance > 0 ? 'text-[#ffb300]/70' : 'text-gray-600'}`}>
              {accountMode === 'demo' ? 'Demo mode · Simulated' : 'Processing 1–3 days'}
            </span>
            <span className={`text-[8px] font-black uppercase tracking-wider sm:text-[10px] ${realBalance > 0 || demoBalance > 0 ? 'text-[#ffb300]/70' : 'text-gray-600'}`}>
              {realBalance > 0 ? `₹${realBalance.toLocaleString('en-IN')}` : demoBalance > 0 ? `₹${demoBalance.toLocaleString('en-IN')}` : 'No balance'}
            </span>
          </div>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* QUICK ACTIONS ROW */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-[#0fb359]/10 border border-[#0fb359]/20 active:scale-95 transition-all sm:gap-2 sm:py-4 sm:rounded-2xl"
        >
          <div className="w-7 h-7 rounded-lg bg-[#0fb359]/20 flex items-center justify-center sm:w-8 sm:h-8 sm:rounded-xl">
            <ArrowDownRight className="w-3.5 h-3.5 text-[#0fb359] sm:w-4 sm:h-4" />
          </div>
          <span className="text-[8px] font-black text-[#0fb359] uppercase sm:text-[9px]">Add money</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (realBalance > 0) setShowWithdraw(true);
          }}
          disabled={realBalance <= 0}
          className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-[#ffb300]/10 border border-[#ffb300]/20 active:scale-95 transition-all disabled:opacity-30 sm:gap-2 sm:py-4 sm:rounded-2xl"
        >
          <div className="w-7 h-7 rounded-lg bg-[#ffb300]/20 flex items-center justify-center sm:w-8 sm:h-8 sm:rounded-xl">
            <ArrowUpRight className="w-3.5 h-3.5 text-[#ffb300] sm:w-4 sm:h-4" />
          </div>
          <span className="text-[8px] font-black text-[#ffb300] uppercase sm:text-[9px]">Withdraw</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/10 active:scale-95 transition-all sm:gap-2 sm:py-4 sm:rounded-2xl"
        >
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center sm:w-8 sm:h-8 sm:rounded-xl">
            <Target className="w-3.5 h-3.5 text-blue-400 sm:w-4 sm:h-4" />
          </div>
          <span className="text-[8px] font-black text-gray-400 uppercase sm:text-[9px]">History</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LEARNING TIPS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#161821] border border-white/5 rounded-xl p-4 space-y-2.5 sm:rounded-2xl sm:p-5 sm:space-y-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <BookOpen className="w-3.5 h-3.5 text-blue-400 sm:w-4 sm:h-4" />
          <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider sm:text-[11px]">Quick Tips</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="w-4 h-4 rounded-full bg-[#0fb359]/20 flex items-center justify-center shrink-0 mt-0.5 sm:w-5 sm:h-5">
              <span className="text-[8px] font-black text-[#0fb359] sm:text-[9px]">1</span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold leading-relaxed sm:text-[11px]">
              <span className="text-white">Start with Demo mode</span> — practice trading with virtual ₹10,000 before using real money.
            </p>
          </div>
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="w-4 h-4 rounded-full bg-[#ffb300]/20 flex items-center justify-center shrink-0 mt-0.5 sm:w-5 sm:h-5">
              <span className="text-[8px] font-black text-[#ffb300] sm:text-[9px]">2</span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold leading-relaxed sm:text-[11px]">
              <span className="text-white">Deposit small first</span> — add ₹100-500 to test the flow before depositing more.
            </p>
          </div>
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5 sm:w-5 sm:h-5">
              <span className="text-[8px] font-black text-blue-400 sm:text-[9px]">3</span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold leading-relaxed sm:text-[11px]">
              <span className="text-white">Set limits</span> — never trade more than you can afford to lose. Use stop-losses.
            </p>
          </div>
        </div>
      </div>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-1.5 py-3 opacity-40 sm:gap-2 sm:py-4">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-500 sm:w-4 sm:h-4" />
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 sm:text-[9px]">256-bit encrypted · Secure wallet</span>
      </div>

      {/* Modals */}
      {showAdd && (
        <DepositModal
          onClose={() => setShowAdd(false)}
          onPaymentSuccess={async (amt, meta) => {
            await onDeposit(amt, meta);
            setAccountMode('real');
          }}
        />
      )}
      {showWithdraw && (
        <WithdrawModal
          balance={realBalance > 0 ? realBalance : demoBalance}
          accountMode={accountMode}
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
