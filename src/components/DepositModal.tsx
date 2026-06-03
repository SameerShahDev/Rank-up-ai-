"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, Smartphone, Loader2, ExternalLink, AlertCircle, RefreshCw, Phone, Shield, Zap, Clock } from 'lucide-react';
import {
  generatePayboltOrderId,
  isPayboltConfigured,
  normalizePayboltMobile,
  PENDING_DEPOSIT_KEY,
} from '../lib/paybolt';
import { checkPayboltOrderStatus, createPayboltOrder } from '../services/payboltService';
import type { PendingDeposit } from '../types/paybolt';

type Step = 'amount' | 'payment' | 'verifying' | 'success' | 'error';

interface DepositModalProps {
  onClose: () => void;
  onPaymentSuccess: (amount: number, meta: { orderId: string; utr?: string }) => void | Promise<void>;
}

const PRESETS = ['100', '500', '1000', '2000', '5000', '10000'];
const POLL_MS = 4000;

function loadPending(): PendingDeposit | null {
  try {
    const raw = sessionStorage.getItem(PENDING_DEPOSIT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingDeposit;
    if (Date.now() - p.createdAt > 30 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_DEPOSIT_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

const DepositModal: React.FC<DepositModalProps> = ({ onClose, onPaymentSuccess }) => {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [orderId, setOrderId] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [utr, setUtr] = useState<string>();
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const creditedRef = useRef(false);

  const mobile = normalizePayboltMobile(phoneInput);

  const clearPending = () => sessionStorage.removeItem(PENDING_DEPOSIT_KEY);

  const savePending = (p: PendingDeposit) => {
    sessionStorage.setItem(PENDING_DEPOSIT_KEY, JSON.stringify(p));
  };

  const creditIfPaid = useCallback(async (oid: string, amt: number) => {
    if (creditedRef.current) return true;
    const status = await checkPayboltOrderStatus(oid);
    if (!status.success) {
      setError(status.error);
      return false;
    }
    if (!status.completed) return false;

    creditedRef.current = true;
    clearPending();
    setUtr(status.utr);
    await onPaymentSuccess(amt, { orderId: oid, utr: status.utr });
    setStep('success');
    return true;
  }, [onPaymentSuccess]);

  const startPolling = useCallback((oid: string, amt: number) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      void creditIfPaid(oid, amt);
    }, POLL_MS);
  }, [creditIfPaid]);

  useEffect(() => {
    const pending = loadPending();
    if (pending && isPayboltConfigured) {
      setAmount(String(pending.amount));
      setOrderId(pending.orderId);
      setStep('verifying');
      startPolling(pending.orderId, pending.amount);
      void creditIfPaid(pending.orderId, pending.amount);
    }
    return () => clearInterval(pollRef.current);
  }, [creditIfPaid, startPolling]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paybolt_return') !== '1') return;
    const pending = loadPending();
    if (pending) {
      setAmount(String(pending.amount));
      setOrderId(pending.orderId);
      setStep('verifying');
      void creditIfPaid(pending.orderId, pending.amount);
    }
    params.delete('paybolt_return');
    const q = params.toString();
    const next = `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
  }, [creditIfPaid]);

  const handleCreateOrder = async () => {
    const amt = Number(amount);
    if (!amt || amt < 1) {
      setError('Enter a valid amount (min ₹1)');
      return;
    }
    if (!mobile || mobile.length !== 10) {
      setError('Enter your 10-digit mobile number for UPI payment');
      return;
    }
    if (!isPayboltConfigured) {
      setError('PayBolt gateway not configured. Add keys in .env file.');
      return;
    }

    setLoading(true);
    setError('');
    const oid = generatePayboltOrderId();
    setOrderId(oid);

    try {
      const res = await createPayboltOrder({
        customerMobile: mobile,
        amount: amt,
        orderId: oid,
        remark1: 'Tryonetrade',
        remark2: `user-${mobile}`,
      });

      if (!res.success) {
        setError(res.error);
        setStep('error');
        setLoading(false);
        return;
      }

      savePending({ orderId: res.orderId, amount: amt, createdAt: Date.now() });
      setPaymentUrl(res.paymentUrl);
      setOrderId(res.orderId);
      setStep('payment');
      startPolling(res.orderId, amt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const openPayment = () => {
    if (!paymentUrl) return;
    window.open(paymentUrl, '_blank', 'noopener,noreferrer');
  };

  const handleVerifyNow = async () => {
    if (!orderId || !amount) return;
    setStep('verifying');
    setLoading(true);
    setError('');
    const ok = await creditIfPaid(orderId, Number(amount));
    if (!ok && !creditedRef.current) {
      setError('Payment not received yet. Complete UPI payment and try again.');
      setStep('payment');
    }
    setLoading(false);
  };

  const handleClose = () => {
    clearInterval(pollRef.current);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur z-[110] flex items-end justify-center" onClick={handleClose}>
      <div
        className="bg-[#1b1c24] rounded-t-3xl w-full max-w-lg border-t border-[#2d2e3b] p-6 space-y-5 max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            {step === 'amount' && 'Deposit Funds'}
            {step === 'payment' && 'Pay via UPI'}
            {step === 'verifying' && 'Confirming Payment…'}
            {step === 'success' && 'Deposit Successful'}
            {step === 'error' && 'Payment Failed'}
          </h2>
          <button type="button" onClick={handleClose} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {!isPayboltConfigured && step === 'amount' && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-black text-amber-400 mb-1">Gateway Not Configured</p>
              <p className="text-[11px] text-gray-300 font-bold">Add VITE_PAYBOLT_USER_TOKEN in .env and restart the app.</p>
            </div>
          </div>
        )}

        {error && step !== 'success' && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-400 font-bold">{error}</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP: AMOUNT */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 'amount' && (
          <>
            {/* Gateway Info */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#0fb359]/10 border border-[#0fb359]/20">
              <Zap className="w-5 h-5 text-[#0fb359] shrink-0" />
              <div>
                <p className="text-[12px] font-black text-[#0fb359]">PayBolt UPI Gateway</p>
                <p className="text-[10px] text-gray-400 font-bold">Instant credit after payment confirmation</p>
              </div>
            </div>

            {/* Phone Input */}
            <div className="flex items-center gap-2 bg-[#161821] border border-white/10 rounded-2xl px-4 py-3 focus-within:border-blue-500">
              <Phone className="w-5 h-5 text-gray-500 shrink-0" />
              <span className="text-gray-400 font-bold text-sm">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="flex-1 bg-transparent text-sm font-bold outline-none tabular-nums"
              />
            </div>

            {/* Amount Input */}
            <div className="bg-[#2d2e3b] rounded-2xl p-5 text-center">
              <span className="text-3xl font-black text-[#ffb300]">₹</span>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-5xl font-black text-white text-center focus:outline-none mt-1"
              />
              <p className="text-[10px] text-gray-500 mt-2">Minimum deposit: ₹1</p>
            </div>

            {/* Preset Amounts */}
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(p)}
                  className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                    amount === p
                      ? 'bg-[#0fb359] text-black'
                      : 'bg-[#2d2e3b] text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  ₹{Number(p).toLocaleString('en-IN')}
                </button>
              ))}
            </div>

            {/* Deposit Button */}
            <button
              type="button"
              disabled={!amount || Number(amount) < 1 || loading}
              onClick={() => void handleCreateOrder()}
              className="w-full py-4 bg-[#0fb359] hover:bg-[#0da652] rounded-2xl font-black text-sm disabled:opacity-40 flex items-center justify-center gap-2 text-black transition-colors"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <Smartphone className="w-5 h-5" />
                  Pay with UPI
                </>
              )}
            </button>

            {/* How it works */}
            <div className="bg-[#161821] border border-white/5 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-[11px] font-black text-blue-400 uppercase">How Deposit Works</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#0fb359]/20 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-black text-[#0fb359]">1</span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-bold">Enter amount and your UPI-linked mobile number</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#0fb359]/20 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-black text-[#0fb359]">2</span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-bold">Complete payment on the UPI page</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#0fb359]/20 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-black text-[#0fb359]">3</span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-bold">Balance credits automatically within seconds</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP: PAYMENT */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 'payment' && (
          <>
            <div className="text-center bg-[#2d2e3b] rounded-2xl p-5">
              <p className="text-3xl font-black text-white font-mono">₹{Number(amount).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-gray-500 mt-1">Order: {orderId}</p>
            </div>

            <button
              type="button"
              onClick={openPayment}
              className="w-full py-4 bg-[#0fb359] hover:bg-[#0da652] rounded-2xl font-black text-sm flex items-center justify-center gap-2 text-black transition-colors"
            >
              <ExternalLink className="w-5 h-5" />
              Open UPI Payment Page
            </button>

            {paymentUrl && (
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <iframe
                  title="PayBolt payment"
                  src={paymentUrl}
                  className="w-full h-64 bg-white"
                  sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation"
                />
              </div>
            )}

            <p className="text-[10px] text-gray-500 text-center">
              Complete UPI payment in the page above or new tab. Balance updates automatically.
            </p>

            <button
              type="button"
              disabled={loading}
              onClick={() => void handleVerifyNow()}
              className="w-full py-4 bg-[#2d2e3b] hover:bg-white/10 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              I have paid — Check status
            </button>

            <button type="button" onClick={() => setStep('amount')} className="w-full py-2 text-gray-500 text-xs font-bold">
              Change amount
            </button>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP: VERIFYING */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 'verifying' && (
          <div className="text-center py-10 space-y-5">
            <Loader2 className="w-16 h-16 text-[#0fb359] mx-auto animate-spin" />
            <div>
              <p className="text-lg font-black text-white mb-1">Waiting for payment…</p>
              <p className="text-[11px] text-gray-400 font-bold">Order: {orderId}</p>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleVerifyNow()}
              className="w-full py-4 bg-[#2d2e3b] hover:bg-white/10 rounded-2xl font-black text-sm transition-colors"
            >
              Check again
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP: SUCCESS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 'success' && (
          <div className="text-center py-8 space-y-5">
            <div className="w-20 h-20 mx-auto rounded-full bg-[#0fb359]/20 border-2 border-[#0fb359]/30 flex items-center justify-center">
              <Check className="w-10 h-10 text-[#0fb359]" />
            </div>
            <div>
              <p className="text-3xl font-black text-white font-mono mb-1">₹{Number(amount).toLocaleString('en-IN')}</p>
              <p className="text-[12px] text-[#0fb359] font-black uppercase">Added to Real Balance</p>
            </div>
            {utr && (
              <div className="bg-[#161821] border border-white/5 rounded-2xl p-3">
                <p className="text-[10px] text-gray-500">UTR: {utr}</p>
              </div>
            )}
            <button type="button" onClick={handleClose} className="w-full py-4 bg-[#2d2e3b] rounded-2xl font-black text-sm">
              Done
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* STEP: ERROR */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 'error' && (
          <div className="text-center py-8 space-y-5">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 border-2 border-red-500/30 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <p className="text-lg font-black text-white mb-1">Payment Failed</p>
              <p className="text-[11px] text-red-400 font-bold">{error || 'Something went wrong'}</p>
            </div>
            <button
              type="button"
              onClick={() => { setStep('amount'); setError(''); }}
              className="w-full py-4 bg-[#2d2e3b] hover:bg-white/10 rounded-2xl font-black text-sm transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Security Footer */}
        <div className="flex items-center justify-center gap-2 py-2 opacity-40">
          <Shield className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[9px] font-black uppercase tracking-wider text-gray-500">Encrypted · Secure gateway</span>
        </div>
      </div>
    </div>
  );
};

export default DepositModal;
