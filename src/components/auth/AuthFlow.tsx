"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Mail, Lock, ArrowRight, Loader2, User, Shield, ChevronLeft } from 'lucide-react';
import { signUpWithEmail, verifyEmailOtp, signInWithEmail, signInWithGoogle } from '../../services/authService';
import type { UserProfile } from '../../types/profile';

interface AuthFlowProps {
  onComplete: (profile: UserProfile) => void;
}

type AuthStep = 'signup' | 'login' | 'otp' | 'name';

const AuthFlow: React.FC<AuthFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState<AuthStep>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first OTP input
  useEffect(() => {
    if (step === 'otp') {
      otpRefs.current[0]?.focus();
    }
  }, [step]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    setError('');

    // Auto-advance to next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newDigits.every(d => d !== '') && index === 5) {
      void handleVerifyOtp(newDigits.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newDigits = pasted.split('');
      setOtpDigits(newDigits);
      otpRefs.current[5]?.focus();
      void handleVerifyOtp(pasted);
    }
  };

  // ─── Sign Up ─────────────────────────────────────────────────────────
  const handleSignUp = async () => {
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!displayName.trim()) {
      setError('Enter your name');
      return;
    }

    setLoading(true);
    console.log('[Auth] Signing up:', email);
    const res = await signUpWithEmail(email.trim(), password, displayName.trim());
    setLoading(false);

    if (!res.success) {
      setError(res.error ?? 'Signup failed');
      return;
    }

    if (res.needsOtp) {
      // OTP sent to email — show OTP screen
      setStep('otp');
      return;
    }

    // Auto-confirmed (no OTP needed) — go straight to app
    if (res.profile) {
      onComplete(res.profile);
    }
  };

  // ─── Login ───────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    console.log('[Auth] Logging in:', email);
    const res = await signInWithEmail(email.trim(), password);
    setLoading(false);

    if (!res.success) {
      setError(res.error ?? 'Login failed');
      return;
    }

    if (res.profile) {
      onComplete(res.profile);
    }
  };

  // ─── Verify OTP ──────────────────────────────────────────────────────
  const handleVerifyOtp = async (otp?: string) => {
    const code = otp ?? otpDigits.join('');
    if (code.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    console.log('[Auth] Verifying OTP');
    const res = await verifyEmailOtp(email.trim(), code);
    setLoading(false);

    if (!res.success) {
      setError(res.error ?? 'Invalid code');
      return;
    }

    if (res.profile) {
      onComplete(res.profile);
    }
  };

  // ─── Google Login ────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    const res = await signInWithGoogle();
    setLoading(false);

    if (!res.success) {
      setError(res.error ?? 'Google login failed');
    }
    // If successful, page will redirect to Google and come back
  };

  // ═════════════════════════════════════════════════════════════════════
  // OTP VERIFICATION SCREEN
  // ═════════════════════════════════════════════════════════════════════
  if (step === 'otp') {
    return (
      <div className="min-h-[100dvh] bg-[#0a0b0f] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden font-space">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-[400px] space-y-6">
          <button
            type="button"
            onClick={() => { setStep('signup'); setOtpDigits(['', '', '', '', '', '']); setError(''); }}
            className="flex items-center gap-1 text-gray-500 text-sm font-bold mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border-2 border-blue-500/30 flex items-center justify-center mb-2">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Verify your email</h1>
            <p className="text-sm text-gray-400">
              We sent a 6-digit code to<br />
              <span className="text-white font-bold">{email}</span>
            </p>
          </div>

          {/* OTP Input */}
          <div className="flex justify-center gap-3">
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={el => { otpRefs.current[i] = el; }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                onPaste={handleOtpPaste}
                className="w-12 h-14 bg-[#161821] border-2 border-white/10 rounded-xl text-center text-2xl font-black text-white focus:border-blue-500 focus:outline-none transition-colors"
              />
            ))}
          </div>

          {error && <p className="text-sm text-[#eb4d5c] font-bold text-center">{error}</p>}

          <button
            type="button"
            disabled={loading || otpDigits.some(d => !d)}
            onClick={() => void handleVerifyOtp()}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify <ArrowRight className="w-5 h-5" /></>}
          </button>

          <button
            type="button"
            onClick={() => { setOtpDigits(['', '', '', '', '', '']); setError(''); void handleSignUp(); }}
            className="w-full text-sm text-gray-500 py-2"
          >
            Resend code
          </button>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ═════════════════════════════════════════════════════════════════════
  if (step === 'login') {
    return (
      <div className="min-h-[100dvh] bg-[#0a0b0f] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden font-space">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-[400px] space-y-6">
          <div className="flex flex-col items-center text-center gap-2">
            <img src="/logo/logo.png" alt="Tryonetrade" className="w-20 h-20 rounded-2xl object-cover shadow-lg" />
            <h1 className="text-2xl font-black tracking-tight">Tryonetrade</h1>
            <p className="text-sm text-gray-400">Welcome back</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-[#161821] border border-white/10 rounded-xl px-4 py-3 focus-within:border-blue-500">
              <Mail className="w-5 h-5 text-gray-500 shrink-0" />
              <input
                type="email"
                inputMode="email"
                placeholder="email@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="flex-1 bg-transparent text-lg font-bold outline-none"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 bg-[#161821] border border-white/10 rounded-xl px-4 py-3 focus-within:border-blue-500">
              <Lock className="w-5 h-5 text-gray-500 shrink-0" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="flex-1 bg-transparent text-lg font-bold outline-none"
              />
            </div>

            {error && <p className="text-sm text-[#eb4d5c] font-bold text-center">{error}</p>}

            <button
              type="button"
              disabled={!email.trim() || password.length < 6 || loading}
              onClick={() => void handleLogin()}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sign in <ArrowRight className="w-5 h-5" /></>}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] font-bold text-gray-500 uppercase">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Google Login */}
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleGoogle()}
              className="w-full py-4 bg-white rounded-xl font-black text-sm text-gray-800 flex items-center justify-center gap-3 disabled:opacity-40 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => { setError(''); setStep('signup'); }}
              className="w-full text-sm text-gray-500 py-2"
            >
              Don't have an account? <span className="text-blue-400 font-bold">Sign up</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // SIGN UP SCREEN
  // ═════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-[100dvh] bg-[#0a0b0f] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden font-space">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-[400px] space-y-6">
        <div className="flex flex-col items-center text-center gap-2">
          <img src="/logo/logo.png" alt="Tryonetrade" className="w-20 h-20 rounded-2xl object-cover shadow-lg" />
          <h1 className="text-2xl font-black tracking-tight">Tryonetrade</h1>
          <p className="text-sm text-gray-400">Create your account</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-[#161821] border border-white/10 rounded-xl px-4 py-3 focus-within:border-[#0fb359]">
            <User className="w-5 h-5 text-gray-500 shrink-0" />
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="flex-1 bg-transparent text-lg font-bold outline-none"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2 bg-[#161821] border border-white/10 rounded-xl px-4 py-3 focus-within:border-blue-500">
            <Mail className="w-5 h-5 text-gray-500 shrink-0" />
            <input
              type="email"
              inputMode="email"
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 bg-transparent text-lg font-bold outline-none"
            />
          </div>

          <div className="flex items-center gap-2 bg-[#161821] border border-white/10 rounded-xl px-4 py-3 focus-within:border-blue-500">
            <Lock className="w-5 h-5 text-gray-500 shrink-0" />
            <input
              type="password"
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="flex-1 bg-transparent text-lg font-bold outline-none"
            />
          </div>

          {error && <p className="text-sm text-[#eb4d5c] font-bold text-center">{error}</p>}

          <button
            type="button"
            disabled={!email.trim() || password.length < 6 || !displayName.trim() || loading}
            onClick={() => void handleSignUp()}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Create account <ArrowRight className="w-5 h-5" /></>}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] font-bold text-gray-500 uppercase">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Google Sign Up */}
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleGoogle()}
            className="w-full py-4 bg-white rounded-xl font-black text-sm text-gray-800 flex items-center justify-center gap-3 disabled:opacity-40 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => { setError(''); setStep('login'); }}
            className="w-full text-sm text-gray-500 py-2"
          >
            Already have an account? <span className="text-blue-400 font-bold">Sign in</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthFlow;
