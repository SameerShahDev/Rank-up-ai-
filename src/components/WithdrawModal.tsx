"use client";

import React, { useState } from 'react';
import { X, Check, ArrowUpRight, AlertCircle, Clock, Shield, Info } from 'lucide-react';
import { WITHDRAWAL_LIMIT } from '../types/account';

interface WithdrawModalProps {
  balance: number;
  accountMode?: 'demo' | 'real';
  onClose: () => void;
  onWithdraw: (amount: number) => void;
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({ balance, accountMode = 'real', onClose, onWithdraw }) => {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [error, setError] = useState('');

  const num = Number(amount);
  const maxAllowed = Math.min(balance, WITHDRAWAL_LIMIT);

  const validate = (): boolean => {
    if (!num || num <= 0) {
      setError('Enter a valid amount');
      return false;
    }
    if (num > balance) {
      setError(`Insufficient balance (₹${balance.toLocaleString('en-IN')})`);
      return false;
    }
    if (num > WITHDRAWAL_LIMIT) {
      setError(`Max withdrawal per request is ₹${WITHDRAWAL_LIMIT.toLocaleString('en-IN')}`);
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onWithdraw(num);
    setStep('success');
  };

  return (
    <div
      className="fixed inset-0 bg-[#08090d]/95 backdrop-blur-xl z-[110] flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[#1b1c24] rounded-t-3xl w-full max-w-lg border-t border-[#2d2e3b] p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Withdraw Funds</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {step === 'form' ? (
          <>
            {/* Warning Banner */}
            <div className={`flex items-start gap-3 p-4 rounded-2xl border ${accountMode === 'demo' ? 'bg-blue-500/10 border-blue-500/25' : 'bg-[#ffb300]/10 border-[#ffb300]/25'}`}>
              <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${accountMode === 'demo' ? 'text-blue-400' : 'text-[#ffb300]'}`} />
              <div>
                <p className={`text-[12px] font-black mb-1 ${accountMode === 'demo' ? 'text-blue-400' : 'text-[#ffb300]'}`}>
                  {accountMode === 'demo' ? 'Demo Mode · Simulated' : 'Real Account Only'}
                </p>
                <p className="text-[11px] text-gray-300 font-bold leading-relaxed">
                  {accountMode === 'demo'
                    ? 'This is a simulated withdrawal. No real money is transferred. Max ₹1,000 per request.'
                    : `Withdrawals are processed within 1–3 business days. Max ₹${WITHDRAWAL_LIMIT.toLocaleString('en-IN')} per request.`
                  }
                </p>
              </div>
            </div>

            {/* Available Balance */}
            <div className="bg-[#161821] border border-white/5 rounded-2xl p-5">
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Available Balance</p>
              <p className="text-3xl font-black text-white tabular-nums font-mono">
                ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">Real account balance available for withdrawal</p>
            </div>

            {/* Amount Input */}
            <div className="bg-[#2d2e3b] rounded-2xl p-5">
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">Withdrawal Amount, ₹</label>
              <input
                type="number"
                value={amount}
                onChange={e => { setAmount(e.target.value); setError(''); }}
                placeholder="0"
                max={maxAllowed}
                className="w-full bg-transparent text-4xl font-black text-white text-center focus:outline-none tabular-nums"
              />
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[200, 500, 1000, 2000].filter(v => v <= maxAllowed).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  className="py-3 bg-[#2d2e3b] rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  ₹{v.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
            {maxAllowed > 0 && (
              <button
                type="button"
                onClick={() => setAmount(String(Math.floor(maxAllowed)))}
                className="w-full py-2.5 bg-[#2d2e3b] rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                Withdraw max: ₹{maxAllowed.toLocaleString('en-IN')}
              </button>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-[11px] font-bold text-red-400">{error}</p>
              </div>
            )}

            {/* Withdraw Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!num || num <= 0 || num > maxAllowed}
              className="w-full py-4 bg-[#ffb300] hover:bg-[#e6a200] disabled:opacity-40 disabled:bg-gray-600 rounded-2xl font-black text-sm uppercase flex items-center justify-center gap-2 text-black transition-colors"
            >
              <ArrowUpRight className="w-5 h-5" />
              Confirm Withdrawal
            </button>

            {/* Info Section */}
            <div className="bg-[#161821] border border-white/5 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" />
                <span className="text-[11px] font-black text-blue-400 uppercase">How it works</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-black text-gray-400">1</span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-bold">Enter the amount you want to withdraw</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-black text-gray-400">2</span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-bold">We process your request within 1–3 days</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-black text-gray-400">3</span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-bold">Funds sent to your linked bank account via UPI</p>
                </div>
              </div>
            </div>

            {/* Security Note */}
            <div className="flex items-center justify-center gap-2 py-2 opacity-50">
              <Shield className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-500">Secure withdrawal · Encrypted</span>
            </div>
          </>
        ) : (
          <div className="text-center py-8 space-y-5">
            <div className="w-20 h-20 mx-auto rounded-full bg-[#0fb359]/20 border-2 border-[#0fb359]/30 flex items-center justify-center">
              <Check className="w-10 h-10 text-[#0fb359]" />
            </div>
            <div>
              <p className="text-3xl font-black text-white font-mono mb-1">₹{num.toLocaleString('en-IN')}</p>
              <p className="text-[12px] text-gray-400 font-bold uppercase">Withdrawal Submitted</p>
            </div>
            <div className="bg-[#161821] border border-white/5 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Clock className={`w-4 h-4 ${accountMode === 'demo' ? 'text-blue-400' : 'text-[#ffb300]'}`} />
                <span className={`text-[11px] font-black ${accountMode === 'demo' ? 'text-blue-400' : 'text-[#ffb300]'}`}>
                  {accountMode === 'demo' ? 'Simulated · No real transfer' : 'Processing: 1–3 business days'}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 text-center">
                {accountMode === 'demo'
                  ? 'Demo withdrawal recorded in your activity'
                  : "You'll receive funds in your linked bank account via UPI"
                }
              </p>
            </div>
            <button type="button" onClick={onClose} className="w-full py-4 bg-[#2d2e3b] rounded-2xl font-black text-sm">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WithdrawModal;
