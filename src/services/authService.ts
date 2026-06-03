import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UserProfile } from '../types/profile';

function mapProfile(row: Record<string, unknown>): UserProfile {
  return {
    profileId: String(row.profile_id),
    email: String(row.email),
    displayName: row.display_name ? String(row.display_name) : null,
    demoBalance: Number(row.demo_balance ?? 10000),
    realBalance: Number(row.real_balance ?? 0),
  };
}

// ─── Mock fallback when Supabase not configured ─────────────────────────

function mockSignUp(email: string, password: string, name: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return { success: false, error: 'Enter a valid email' };
  if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters' };
  const profile: UserProfile = {
    profileId: crypto.randomUUID(),
    email: normalized,
    displayName: name.trim() || null,
    demoBalance: 10000,
    realBalance: 0,
  };
  localStorage.setItem('tryonetrade_profile', JSON.stringify(profile));
  return { success: true, profile, needsOtp: false };
}

function mockSignIn(email: string) {
  const normalized = email.trim().toLowerCase();
  const raw = localStorage.getItem('tryonetrade_profile');
  if (!raw) return { success: false, error: 'No account found. Please sign up first.' };
  const p = JSON.parse(raw);
  if (p.email !== normalized) return { success: false, error: 'Invalid email or password' };
  return { success: true, profile: p as UserProfile };
}

function mockLoadProfile(): UserProfile | null {
  const raw = localStorage.getItem('tryonetrade_profile');
  return raw ? JSON.parse(raw) : null;
}

// ─── Supabase Auth functions ────────────────────────────────────────────

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<{ success: boolean; profile?: UserProfile; error?: string; needsOtp?: boolean }> {
  if (!isSupabaseConfigured || !supabase) {
    return mockSignUp(email, password, displayName);
  }

  console.log('[Auth] Signing up:', email);
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: displayName.trim() },
    },
  });

  if (error) {
    console.error('[Auth] SignUp error:', error.message);
    return { success: false, error: error.message };
  }

  // If email confirmation is required, user needs to verify OTP
  if (data.user && !data.session) {
    console.log('[Auth] OTP sent to email');
    return { success: true, needsOtp: true };
  }

  // If auto-confirm is enabled (no email verification needed)
  if (data.user) {
    console.log('[Auth] SignUp OK (auto-confirmed):', data.user.email);
    const profile = await loadUserProfile();
    if (profile) return { success: true, profile };
    // Profile not created yet (trigger might be async), wait a bit
    await new Promise(r => setTimeout(r, 1000));
    const retry = await loadUserProfile();
    if (retry) return { success: true, profile: retry };
    // Create profile manually as fallback
    const fallbackProfile: UserProfile = {
      profileId: data.user.id,
      email: data.user.email ?? '',
      displayName: displayName.trim() || null,
      demoBalance: 10000,
      realBalance: 0,
    };
    return { success: true, profile: fallbackProfile };
  }

  return { success: false, error: 'Signup failed' };
}

export async function verifyEmailOtp(
  email: string,
  token: string,
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'OTP not available in demo mode' };
  }

  console.log('[Auth] Verifying OTP for:', email);
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token,
    type: 'signup',
  });

  if (error) {
    console.error('[Auth] OTP error:', error.message);
    return { success: false, error: error.message };
  }

  console.log('[Auth] OTP verified');
  if (data.user) {
    await new Promise(r => setTimeout(r, 500));
    const profile = await loadUserProfile();
    if (profile) return { success: true, profile };
    const fallbackProfile: UserProfile = {
      profileId: data.user.id,
      email: data.user.email ?? '',
      displayName: (data.user.user_metadata?.display_name as string) ?? null,
      demoBalance: 10000,
      realBalance: 0,
    };
    return { success: true, profile: fallbackProfile };
  }

  return { success: false, error: 'Verification failed' };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return mockSignIn(email);
  }

  console.log('[Auth] Signing in:', email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    console.error('[Auth] SignIn error:', error.message);
    return { success: false, error: error.message };
  }

  if (data.user) {
    console.log('[Auth] SignIn OK:', data.user.email);
    const profile = await loadUserProfile();
    if (profile) return { success: true, profile };
    // Fallback if profile not yet created
    const fallbackProfile: UserProfile = {
      profileId: data.user.id,
      email: data.user.email ?? '',
      displayName: (data.user.user_metadata?.display_name as string) ?? null,
      demoBalance: 10000,
      realBalance: 0,
    };
    return { success: true, profile: fallbackProfile };
  }

  return { success: false, error: 'Login failed' };
}

export async function signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Google login not available in demo mode' };
  }

  console.log('[Auth] Starting Google OAuth');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });

  if (error) {
    console.error('[Auth] Google OAuth error:', error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function loadUserProfile(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured || !supabase) {
    return mockLoadProfile();
  }

  const { data, error } = await supabase.rpc('get_my_profile');
  if (error || !data) {
    console.warn('[Auth] Profile load failed:', error?.message ?? 'no data');
    return null;
  }
  const r = data as Record<string, unknown>;
  if (!r.success) return null;
  return mapProfile(r);
}

export async function getCurrentSession(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured || !supabase) {
    return mockLoadProfile();
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('[Auth] No active session');
    return null;
  }

  console.log('[Auth] Active session for:', user.email);
  const profile = await loadUserProfile();
  if (profile) return profile;

  // Fallback
  return {
    profileId: user.id,
    email: user.email ?? '',
    displayName: (user.user_metadata?.display_name as string) ?? null,
    demoBalance: 10000,
    realBalance: 0,
  };
}

export async function updateDisplayName(name: string) {
  if (!isSupabaseConfigured || !supabase) {
    const raw = localStorage.getItem('tryonetrade_profile');
    if (!raw) return { success: false, error: 'No session' };
    const p = { ...JSON.parse(raw), displayName: name.trim() };
    localStorage.setItem('tryonetrade_profile', JSON.stringify(p));
    return { success: true, displayName: name.trim() };
  }

  const { data, error } = await supabase.rpc('update_display_name', {
    p_name: name,
  });
  if (error) return { success: false, error: error.message };
  const r = data as Record<string, unknown>;
  if (!r.success) return { success: false, error: String(r.error) };
  return { success: true, displayName: name.trim() };
}

export async function syncBalances(demo: number, real: number) {
  if (!isSupabaseConfigured || !supabase) {
    const raw = localStorage.getItem('tryonetrade_profile');
    if (raw) {
      const p = { ...JSON.parse(raw), demoBalance: demo, realBalance: real };
      localStorage.setItem('tryonetrade_profile', JSON.stringify(p));
    }
    return;
  }
  await supabase.rpc('update_my_balances', {
    p_demo_balance: demo,
    p_real_balance: real,
  });
}

export async function saveTransaction(
  tx: { type: string; coin: string; amount: string; usd: string; account?: string },
) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.rpc('insert_my_transaction', {
    p_tx_type: tx.type,
    p_coin: tx.coin,
    p_amount_text: tx.amount,
    p_usd_text: tx.usd,
    p_account_mode: tx.account ?? 'real',
  });
}

export async function fetchTransactionsFromDb() {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data } = await supabase.rpc('get_my_transactions', {
    p_limit: 50,
  });
  if (!data || !Array.isArray(data)) return [];
  return data as Record<string, string>[];
}

export async function depositToDb(amount: number, method = 'upi') {
  if (!isSupabaseConfigured || !supabase) return { success: true };
  const { data, error } = await supabase.rpc('record_my_deposit', {
    p_amount: amount,
    p_method: method,
  });
  if (error) return { success: false, error: error.message };
  return data as { success: boolean };
}

export async function registerPaymentOrder(orderId: string, amount: number) {
  if (!isSupabaseConfigured || !supabase) return { success: true };
  const { data, error } = await supabase.rpc('register_my_payment_order', {
    p_order_id: orderId,
    p_amount: amount,
  });
  if (error) return { success: false, error: error.message };
  const r = data as Record<string, unknown>;
  return { success: Boolean(r.success), error: r.error ? String(r.error) : undefined };
}

export async function finalizePayboltDeposit(
  orderId: string,
  amount: number,
  utr?: string,
) {
  if (!isSupabaseConfigured || !supabase) {
    return depositToDb(amount, 'paybolt');
  }
  const { data, error } = await supabase.rpc('finalize_my_paybolt_deposit', {
    p_order_id: orderId,
    p_amount: amount,
    p_utr: utr ?? null,
    p_method: 'paybolt',
  });
  if (error) return { success: false, error: error.message };
  return data as { success: boolean; already_completed?: boolean };
}

export async function withdrawFromDb(amount: number) {
  if (!isSupabaseConfigured || !supabase) return { success: true };
  const { data, error } = await supabase.rpc('record_my_withdrawal', {
    p_amount: amount,
  });
  if (error) return { success: false, error: error.message };
  const r = data as Record<string, unknown>;
  return { success: Boolean(r.success), error: r.error ? String(r.error) : undefined };
}

export async function signOut() {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem('tryonetrade_profile');
}
