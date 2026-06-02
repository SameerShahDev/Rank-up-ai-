"use client";

import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Loader2, User } from 'lucide-react';
import { registerUser, loginUser, updateDisplayName } from '../../services/authService';
import type { UserProfile } from '../../types/profile';

interface AuthFlowProps {
  onComplete: (profile: UserProfile) => void;
}

const AuthFlow: React.FC<AuthFlowProps> = ({ onComplete }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const handleAuth = async () => {
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
    const fn = mode === 'signup' ? registerUser : loginUser;
    const res = await fn(email.trim(), password);
    setLoading(false);
    if (!res.success || !res.profile) {
      setError(res.error ?? 'Something went wrong');
      return;
    }
    setProfile(res.profile);
    if (res.profile.needsName) {
      setDisplayName(res.profile.displayName ?? '');
    } else {
      onComplete(res.profile);
    }
  };

  const handleNameSubmit = async () => {
    if (!profile || !displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    const res = await updateDisplayName(profile.sessionToken, displayName.trim());
    setLoading(false);
    if (!res.success) {
      setError(res.error ?? 'Could not save name');
      return;
    }
    onComplete({
      ...profile,
      displayName: displayName.trim(),
      needsName: false,
    });
  };

  if (profile && displayName !== undefined) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0b0f] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden font-space">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 w-full max-w-[400px] space-y-6">
          <div className="flex flex-col items-center text-center gap-2">
            <img src="/logo/logo.png" alt="Tryonetrade" className="w-16 h-16 rounded-2xl object-cover shadow-lg" />
            <h1 className="text-2xl font-black tracking-tight">Tryonetrade</h1>
            <p className="text-sm text-gray-400">What should we call you?</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-[#161821] border border-white/10 rounded-xl px-4 py-3 focus-within:border-[#0fb359]">
              <User className="w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Your display name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="flex-1 bg-transparent text-lg font-bold outline-none"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-[#eb4d5c] font-bold text-center">{error}</p>}
            <button
              type="button"
              disabled={!displayName.trim() || loading}
              onClick={handleNameSubmit}
              className="w-full py-4 bg-[#0fb359] rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-5 h-5" /></>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0b0f] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden font-space">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-[400px] space-y-6">
        <div className="flex flex-col items-center text-center gap-2">
          <img src="/logo/logo.png" alt="Tryonetrade" className="w-16 h-16 rounded-2xl object-cover shadow-lg" />
          <h1 className="text-2xl font-black tracking-tight">Tryonetrade</h1>
          <p className="text-sm text-gray-400">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </p>
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
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="flex-1 bg-transparent text-lg font-bold outline-none"
            />
          </div>

          {error && <p className="text-sm text-[#eb4d5c] font-bold text-center">{error}</p>}

          <button
            type="button"
            disabled={!email.trim() || password.length < 6 || loading}
            onClick={handleAuth}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>{mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight className="w-5 h-5" /></>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setError(''); setMode(mode === 'signup' ? 'login' : 'signup'); }}
            className="w-full text-sm text-gray-500 py-2"
          >
            {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthFlow;
