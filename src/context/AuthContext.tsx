"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { AccountMode } from '../types/account';
import { INITIAL_DEMO_BALANCE } from '../types/account';
import type { UserProfile } from '../types/profile';
import {
  getCurrentSession,
  syncBalances,
  saveTransaction,
  fetchTransactionsFromDb,
  depositToDb,
  withdrawFromDb,
  signOut,
  updateDisplayName,
} from '../services/authService';
import { fetchAccountDashboard, saveUserSettings } from '../services/settingsService';
import type { AccountStats, UserSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface AuthContextValue {
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  accountMode: AccountMode;
  setAccountMode: (m: AccountMode) => void;
  demoBalance: number;
  realBalance: number;
  activeBalance: number;
  setActiveBalance: Dispatch<SetStateAction<number>>;
  setDemoBalance: Dispatch<SetStateAction<number>>;
  setRealBalance: Dispatch<SetStateAction<number>>;
  completeLogin: (p: UserProfile) => void;
  logout: () => void;
  persistBalances: () => Promise<void>;
  addTransactionDb: (tx: Record<string, string>) => Promise<void>;
  depositReal: (amount: number, method?: string) => Promise<{ success: boolean; error?: string }>;
  withdrawReal: (amount: number) => Promise<{ success: boolean; error?: string }>;
  loadTransactions: () => Promise<Record<string, string>[] | null>;
  userSettings: UserSettings;
  accountStats: AccountStats | null;
  settingsLoading: boolean;
  refreshDashboard: () => Promise<void>;
  updateUserSettings: (patch: Partial<UserSettings>) => Promise<void>;
  renameProfile: (name: string) => Promise<{ success: boolean; error?: string }>;
  isSupabaseLive: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MODE_KEY = 'tryonetrade_account_mode';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accountMode, setAccountMode] = useState<AccountMode>(() => {
    const m = localStorage.getItem(MODE_KEY);
    return m === 'real' ? 'real' : 'demo';
  });
  const [demoBalance, setDemoBalance] = useState(INITIAL_DEMO_BALANCE);
  const [realBalance, setRealBalance] = useState(0);
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [accountStats, setAccountStats] = useState<AccountStats | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    localStorage.setItem(MODE_KEY, accountMode);
  }, [accountMode]);

  const refreshDashboard = useCallback(async () => {
    if (!profile) return;
    setSettingsLoading(true);
    try {
      const dash = await fetchAccountDashboard();
      if (dash) {
        setUserSettings(dash.settings);
        setAccountStats(dash.stats);
        setDemoBalance(dash.profile.demoBalance);
        setRealBalance(dash.profile.realBalance);
        setProfile(prev => prev ? {
          ...prev,
          displayName: dash.profile.displayName,
          demoBalance: dash.profile.demoBalance,
          realBalance: dash.profile.realBalance,
        } : prev);
        if (dash.settings.defaultAccountMode) {
          setAccountMode(dash.settings.defaultAccountMode);
        }
      }
    } finally {
      setSettingsLoading(false);
    }
  }, [profile]);

  // ─── Load session on mount ───────────────────────────────────────────
  useEffect(() => {
    console.log('[AuthContext] Loading session...');
    getCurrentSession().then(p => {
      if (p) {
        console.log('[AuthContext] Session loaded:', p.email);
        setProfile(p);
        setDemoBalance(p.demoBalance);
        setRealBalance(p.realBalance);
      } else {
        console.log('[AuthContext] No session found');
      }
      setIsLoading(false);
    });
  }, []);

  // ─── Listen for auth state changes (Google OAuth redirect, etc.) ─────
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth state change:', event);
        if (event === 'SIGNED_IN' && session?.user) {
          const { loadUserProfile } = await import('../services/authService');
          const prof = await loadUserProfile();
          if (prof) {
            setProfile(prof);
            setDemoBalance(prof.demoBalance);
            setRealBalance(prof.realBalance);
          }
          setIsLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setDemoBalance(INITIAL_DEMO_BALANCE);
          setRealBalance(0);
          setUserSettings(DEFAULT_SETTINGS);
          setAccountStats(null);
        }
      },
    );
    return () => subscription.unsubscribe();
  }, []);

  // ─── Load dashboard when profile is ready ────────────────────────────
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      setSettingsLoading(true);
      try {
        const dash = await fetchAccountDashboard();
        if (cancelled || !dash) return;
        setUserSettings(dash.settings);
        setAccountStats(dash.stats);
        setDemoBalance(dash.profile.demoBalance);
        setRealBalance(dash.profile.realBalance);
        setProfile(prev => prev ? {
          ...prev,
          displayName: dash.profile.displayName,
          demoBalance: dash.profile.demoBalance,
          realBalance: dash.profile.realBalance,
        } : prev);
        if (dash.settings.defaultAccountMode) {
          setAccountMode(dash.settings.defaultAccountMode);
        }
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.profileId]);

  // ─── Auto-sync balances ──────────────────────────────────────────────
  const persistBalances = useCallback(async () => {
    if (!profile) return;
    await syncBalances(demoBalance, realBalance);
    setProfile(prev => prev ? { ...prev, demoBalance, realBalance } : prev);
  }, [profile, demoBalance, realBalance]);

  useEffect(() => {
    if (!profile) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      persistBalances();
    }, 800);
    return () => clearTimeout(syncTimer.current);
  }, [demoBalance, realBalance, profile, persistBalances]);

  const completeLogin = useCallback((p: UserProfile) => {
    setProfile(p);
    setDemoBalance(p.demoBalance);
    setRealBalance(p.realBalance);
  }, []);

  const logout = useCallback(() => {
    signOut();
    setProfile(null);
    setDemoBalance(INITIAL_DEMO_BALANCE);
    setRealBalance(0);
    setUserSettings(DEFAULT_SETTINGS);
    setAccountStats(null);
  }, []);

  const activeBalance = accountMode === 'demo' ? demoBalance : realBalance;
  const setActiveBalance: Dispatch<SetStateAction<number>> = useCallback((value) => {
    const setter = accountMode === 'demo' ? setDemoBalance : setRealBalance;
    setter(value);
  }, [accountMode]);

  const addTransactionDb = useCallback(async (tx: Record<string, string>) => {
    if (!profile) return;
    await saveTransaction({
      type: tx.type,
      coin: tx.coin,
      amount: tx.amount,
      usd: tx.usd,
      account: tx.account,
    });
  }, [profile]);

  const depositReal = useCallback(async (amount: number, method = 'upi') => {
    if (!profile) return { success: false };
    const res = await depositToDb(amount, method);
    if (res.success) {
      setRealBalance(prev => prev + amount);
      await refreshDashboard();
    }
    return res;
  }, [profile, refreshDashboard]);

  const withdrawReal = useCallback(async (amount: number) => {
    if (!profile) return { success: false };
    const res = await withdrawFromDb(amount);
    if (res.success) {
      setRealBalance(prev => Math.max(0, prev - amount));
      await refreshDashboard();
    }
    return res;
  }, [profile, refreshDashboard]);

  const loadTransactions = useCallback(async () => {
    if (!profile) return null;
    return fetchTransactionsFromDb();
  }, [profile]);

  const updateUserSettings = useCallback(async (patch: Partial<UserSettings>) => {
    if (!profile) return;
    const next = { ...userSettings, ...patch };
    setUserSettings(next);
    if (patch.defaultAccountMode) setAccountMode(patch.defaultAccountMode);
    await saveUserSettings(next);
  }, [profile, userSettings]);

  const renameProfile = useCallback(async (name: string) => {
    if (!profile) return { success: false, error: 'Not signed in' };
    const res = await updateDisplayName(name);
    if (res.success) {
      setProfile(prev => prev ? { ...prev, displayName: name.trim() } : prev);
    }
    return res;
  }, [profile]);

  const value = useMemo<AuthContextValue>(() => ({
    profile,
    isLoading,
    isAuthenticated: Boolean(profile),
    accountMode,
    setAccountMode,
    demoBalance,
    realBalance,
    activeBalance,
    setActiveBalance,
    setDemoBalance,
    setRealBalance,
    completeLogin,
    logout,
    persistBalances,
    addTransactionDb,
    depositReal,
    withdrawReal,
    loadTransactions,
    userSettings,
    accountStats,
    settingsLoading,
    refreshDashboard,
    updateUserSettings,
    renameProfile,
    isSupabaseLive: isSupabaseConfigured,
  }), [
    profile, isLoading, accountMode, demoBalance, realBalance, activeBalance,
    setActiveBalance, completeLogin, logout, persistBalances, addTransactionDb,
    depositReal, withdrawReal, loadTransactions, userSettings, accountStats,
    settingsLoading, refreshDashboard, updateUserSettings, renameProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
