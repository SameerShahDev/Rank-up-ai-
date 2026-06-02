"use client";

import React, { useState } from 'react';
import { X, Check, ArrowUpRight, AlertCircle } from 'lucide-react';
import { WITHDRAWAL_LIMIT } from '../types/account';

interface WithdrawModalProps {
  balance: number;
  onClose: () => void;
  onWithdraw: (amount: number) => void;
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({ balance, onClose, onWithdraw }) => {
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
        className="bg-[#1b1c24] rounded-t-3xl w-full max-w-lg border-t border-[#2d2e3b] p-6 space-y-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Withdraw</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {step === 'form' ? (
          <>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#ffb300]/10 border border-[#ffb300]/25">
              <AlertCircle className="w-4 h-4 text-[#ffb300] shrink-0" />
              <p className="text-[11px] text-gray-300">
                <span className="font-bold text-[#ffb300]">Real account only.</span> Max ₹{WITHDRAWAL_LIMIT.toLocaleString('en-IN')} per withdrawal.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Available (real)</p>
              <p className="text-2xl font-black text-white tabular-nums">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>

            <div className="bg-[#2d2e3b] rounded-xl p-4">
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">Amount, ₹</label>
              <input
                type="number"
                value={amount}
                onChange={e => { setAmount(e.target.value); setError(''); }}
                placeholder="0"
                max={maxAllowed}
                className="w-full bg-transparent text-3xl font-black text-white text-center focus:outline-none tabular-nums"
              />
            </div>

            <div className="flex gap-2">
              {[500, 1000].filter(v => v <= maxAllowed).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  className="flex-1 py-2 bg-[#2d2e3b] rounded-lg text-xs font-bold text-gray-400 hover:text-white"
                >
                  ₹{v.toLocaleString('en-IN')}
                </button>
              ))}
              {maxAllowed > 0 && maxAllowed < WITHDRAWAL_LIMIT && (
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.floor(maxAllowed)))}
                  className="flex-1 py-2 bg-[#2d2e3b] rounded-lg text-xs font-bold text-gray-400 hover:text-white"
                >
                  Max
                </button>
              )}
            </div>

            {error && <p className="text-[11px] font-bold text-[#eb4d5c]">{error}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={balance <= 0}
              className="w-full py-4 bg-[#0fb359] hover:bg-[#0da652] disabled:opacity-40 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-5 h-5" />
              Confirm withdrawal
            </button>
          </>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#0fb359]/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-[#0fb359]" />
            </div>
            <p className="text-2xl font-black text-white">₹{num.toLocaleString('en-IN')}</p>
            <p className="text-[11px] text-gray-400 font-bold uppercase">Withdrawal processing (1–3 days)</p>
            <button type="button" onClick={onClose} className="w-full py-3 bg-[#2d2e3b] rounded-xl font-bold text-sm">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WithdrawModal;
