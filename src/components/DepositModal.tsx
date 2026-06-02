"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, Smartphone, Loader2, ExternalLink, AlertCircle, RefreshCw, Phone } from 'lucide-react';
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
  customerMobile: string;
  sessionToken?: string;
  onPaymentSuccess: (amount: number, meta: { orderId: string; utr?: string }) => void | Promise<void>;
}

const PRESETS = ['500', '1000', '5000', '10000'];
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

const DepositModal: React.FC<DepositModalProps> = ({ onClose, customerMobile, sessionToken, onPaymentSuccess }) => {
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

  const mobile = customerMobile
    ? normalizePayboltMobile(customerMobile)
    : normalizePayboltMobile(phoneInput);

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
        sessionToken,
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
          <h2 className="text-lg font-black text-white uppercase">
            {step === 'amount' && 'Deposit (Real)'}
            {step === 'payment' && 'Pay via UPI'}
            {step === 'verifying' && 'Confirming…'}
            {step === 'success' && 'Deposit success'}
            {step === 'error' && 'Payment failed'}
          </h2>
          <button type="button" onClick={handleClose} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {!isPayboltConfigured && step === 'amount' && (
          <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            PayBolt keys missing. Add VITE_PAYBOLT_USER_TOKEN in .env and restart the app.
          </p>
        )}

        {error && step !== 'success' && (
          <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </p>
        )}

        {step === 'amount' && (
          <>
            <p className="text-[11px] text-gray-400">
              Pay with <span className="text-[#0fb359] font-bold">PayBolt UPI</span> — credited to Real balance after confirmation.
            </p>
            {customerMobile ? (
              <p className="text-[10px] text-gray-500">Mobile: +91 {mobile}</p>
            ) : (
              <div className="flex items-center gap-2 bg-[#161821] border border-white/10 rounded-xl px-4 py-3 focus-within:border-blue-500">
                <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-gray-400 font-bold text-sm">+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Phone for UPI"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="flex-1 bg-transparent text-sm font-bold outline-none tabular-nums"
                />
              </div>
            )}
            <div className="bg-[#2d2e3b] rounded-xl p-4 text-center">
              <span className="text-2xl font-black text-[#ffb300]">₹</span>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-4xl font-black text-white text-center focus:outline-none mt-1"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map(p => (
                <button key={p} type="button" onClick={() => setAmount(p)} className="py-2 bg-[#2d2e3b] rounded-lg text-[10px] font-bold text-gray-400 hover:text-white">
                  ₹{Number(p).toLocaleString('en-IN')}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!amount || Number(amount) < 1 || loading}
              onClick={() => void handleCreateOrder()}
              className="w-full py-4 bg-[#0fb359] rounded-xl font-black text-sm disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <Smartphone className="w-5 h-5" />
                  Pay with UPI
                </>
              )}
            </button>
          </>
        )}

        {step === 'payment' && (
          <>
            <p className="text-center text-xl font-black">₹{Number(amount).toLocaleString('en-IN')}</p>
            <p className="text-[11px] text-gray-400 text-center">Order: {orderId}</p>
            <button
              type="button"
              onClick={openPayment}
              className="w-full py-4 bg-[#0fb359] rounded-xl font-black text-sm flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-5 h-5" />
              Open payment page
            </button>
            {paymentUrl && (
              <iframe
                title="PayBolt payment"
                src={paymentUrl}
                className="w-full h-64 rounded-xl border border-white/10 bg-white"
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation"
              />
            )}
            <p className="text-[10px] text-gray-500 text-center">
              Complete UPI payment in the page above or new tab. Balance updates automatically when paid.
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleVerifyNow()}
              className="w-full py-3 bg-[#2d2e3b] rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              I have paid — check status
            </button>
            <button type="button" onClick={() => setStep('amount')} className="w-full py-2 text-gray-500 text-xs font-bold">
              Change amount
            </button>
          </>
        )}

        {step === 'verifying' && (
          <div className="text-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 text-[#0fb359] mx-auto animate-spin" />
            <p className="text-sm text-gray-300">Waiting for payment confirmation…</p>
            <p className="text-[10px] text-gray-500">Order {orderId}</p>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleVerifyNow()}
              className="w-full py-3 bg-[#2d2e3b] rounded-xl font-bold text-sm"
            >
              Check again
            </button>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-6 space-y-4">
            <Check className="w-12 h-12 text-[#0fb359] mx-auto" />
            <p className="text-2xl font-black">₹{Number(amount).toLocaleString('en-IN')}</p>
            <p className="text-[11px] text-gray-400 uppercase font-bold">Added to real balance</p>
            {utr && <p className="text-[10px] text-gray-500">UTR: {utr}</p>}
            <button type="button" onClick={handleClose} className="w-full py-3 bg-[#2d2e3b] rounded-xl font-bold">Done</button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-6 space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <p className="text-sm text-red-400 font-bold">{error || 'Payment failed'}</p>
            <button type="button" onClick={() => { setStep('amount'); setError(''); }} className="w-full py-3 bg-[#2d2e3b] rounded-xl font-bold">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepositModal;

