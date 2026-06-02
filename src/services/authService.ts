import { supabase, isSupabaseConfigured, SESSION_KEY, PROFILE_KEY } from '../lib/supabase';
import type { UserProfile } from '../types/profile';

function mapProfile(row: Record<string, unknown>): UserProfile {
  return {
    profileId: String(row.profile_id),
    sessionToken: String(row.session_token),
    email: String(row.email),
    displayName: row.display_name ? String(row.display_name) : null,
    demoBalance: Number(row.demo_balance ?? 10000),
    realBalance: Number(row.real_balance ?? 0),
    needsName: Boolean(row.needs_name),
  };
}

/** Local demo when Supabase env is not set */
function mockRegister(email: string, password: string): { success: boolean; profile?: UserProfile; error?: string } {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return { success: false, error: 'Enter a valid email' };
  if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters' };
  const existing = localStorage.getItem(PROFILE_KEY);
  if (existing) {
    const p = JSON.parse(existing);
    if (p.email === normalized) return { success: false, error: 'An account with this email already exists' };
  }
  const profile: UserProfile = {
    profileId: crypto.randomUUID(),
    sessionToken: crypto.randomUUID(),
    email: normalized,
    displayName: null,
    demoBalance: 10000,
    realBalance: 0,
    needsName: true,
  };
  localStorage.setItem(SESSION_KEY, profile.sessionToken);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(`tryonetrade_pass_${normalized}`, password);
  return { success: true, profile };
}

function mockLogin(email: string, password: string): { success: boolean; profile?: UserProfile; error?: string } {
  const normalized = email.trim().toLowerCase();
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return { success: false, error: 'No account found. Please sign up first.' };
  const p = JSON.parse(raw);
  if (p.email !== normalized) return { success: false, error: 'Invalid email or password' };
  const stored = localStorage.getItem(`tryonetrade_pass_${normalized}`);
  if (stored !== password) return { success: false, error: 'Invalid email or password' };
  p.sessionToken = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, p.sessionToken);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  return { success: true, profile: p as UserProfile };
}

export async function registerUser(email: string, password: string) {
  if (!isSupabaseConfigured || !supabase) return mockRegister(email, password);

  const { data, error } = await supabase.rpc('register_user', {
    p_email: email,
    p_password: password,
  });
  if (error) return { success: false, error: error.message };
  const r = data as Record<string, unknown>;
  if (!r.success) return { success: false, error: String(r.error ?? 'Registration failed') };
  const profile = mapProfile(r);
  localStorage.setItem(SESSION_KEY, profile.sessionToken);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return { success: true, profile };
}

export async function loginUser(email: string, password: string) {
  if (!isSupabaseConfigured || !supabase) return mockLogin(email, password);

  const { data, error } = await supabase.rpc('login_user', {
    p_email: email,
    p_password: password,
  });
  if (error) return { success: false, error: error.message };
  const r = data as Record<string, unknown>;
  if (!r.success) return { success: false, error: String(r.error ?? 'Login failed') };
  const profile = mapProfile(r);
  localStorage.setItem(SESSION_KEY, profile.sessionToken);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return { success: true, profile };
}

export async function updateDisplayName(sessionToken: string, name: string) {
  if (!isSupabaseConfigured || !supabase) {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { success: false, error: 'No session' };
    const p = { ...JSON.parse(raw), displayName: name.trim(), needsName: false };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    return { success: true, displayName: name.trim() };
  }

  const { data, error } = await supabase.rpc('update_profile_name', {
    p_session_token: sessionToken,
    p_name: name,
  });
  if (error) return { success: false, error: error.message };
  const r = data as Record<string, unknown>;
  if (!r.success) return { success: false, error: String(r.error) };
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw) {
    const p = JSON.parse(raw);
    p.displayName = name.trim();
    p.needsName = false;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  }
  return { success: true, displayName: name.trim() };
}

export async function loadSessionProfile(): Promise<UserProfile | null> {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return null;

  const cached = localStorage.getItem(PROFILE_KEY);
  if (!isSupabaseConfigured || !supabase) {
    return cached ? JSON.parse(cached) : null;
  }

  const { data, error } = await supabase.rpc('get_profile_by_session', {
    p_session_token: token,
  });
  if (error || !data) return cached ? JSON.parse(cached) : null;
  const r = data as Record<string, unknown>;
  if (!r.success) {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(PROFILE_KEY);
    return null;
  }
  const profile: UserProfile = {
    profileId: String(r.profile_id),
    sessionToken: token,
    email: String(r.email),
    displayName: r.display_name ? String(r.display_name) : null,
    demoBalance: Number(r.demo_balance),
    realBalance: Number(r.real_balance),
    needsName: Boolean(r.needs_name),
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export async function syncBalances(sessionToken: string, demo: number, real: number) {
  if (!isSupabaseConfigured || !supabase) {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = { ...JSON.parse(raw), demoBalance: demo, realBalance: real };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    }
    return;
  }
  await supabase.rpc('update_profile_balances', {
    p_session_token: sessionToken,
    p_demo_balance: demo,
    p_real_balance: real,
  });
}

export async function saveTransaction(
  sessionToken: string,
  tx: { type: string; coin: string; amount: string; usd: string; account?: string },
) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.rpc('insert_transaction', {
    p_session_token: sessionToken,
    p_tx_type: tx.type,
    p_coin: tx.coin,
    p_amount_text: tx.amount,
    p_usd_text: tx.usd,
    p_account_mode: tx.account ?? 'real',
  });
}

export async function fetchTransactionsFromDb(sessionToken: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data } = await supabase.rpc('get_transactions', {
    p_session_token: sessionToken,
    p_limit: 50,
  });
  if (!data || !Array.isArray(data)) return [];
  return data as Record<string, string>[];
}

export async function depositToDb(sessionToken: string, amount: number, method = 'upi') {
  if (!isSupabaseConfigured || !supabase) return { success: true };
  const { data, error } = await supabase.rpc('record_deposit', {
    p_session_token: sessionToken,
    p_amount: amount,
    p_method: method,
  });
  if (error) return { success: false, error: error.message };
  return data as { success: boolean };
}

export async function registerPaymentOrder(
  sessionToken: string,
  orderId: string,
  amount: number,
) {
  if (!isSupabaseConfigured || !supabase) return { success: true };
  const { data, error } = await supabase.rpc('register_payment_order', {
    p_session_token: sessionToken,
    p_order_id: orderId,
    p_amount: amount,
  });
  if (error) return { success: false, error: error.message };
  const r = data as Record<string, unknown>;
  return { success: Boolean(r.success), error: r.error ? String(r.error) : undefined };
}

/** Idempotent — safe after webhook already credited */
export async function finalizePayboltDeposit(
  sessionToken: string,
  orderId: string,
  amount: number,
  utr?: string,
) {
  if (!isSupabaseConfigured || !supabase) {
    return depositToDb(sessionToken, amount, 'paybolt');
  }
  const { data, error } = await supabase.rpc('finalize_paybolt_deposit', {
    p_session_token: sessionToken,
    p_order_id: orderId,
    p_amount: amount,
    p_utr: utr ?? null,
    p_method: 'paybolt',
  });
  if (error) return { success: false, error: error.message };
  return data as { success: boolean; already_completed?: boolean };
}

export async function withdrawFromDb(sessionToken: string, amount: number) {
  if (!isSupabaseConfigured || !supabase) return { success: true };
  const { data, error } = await supabase.rpc('record_withdrawal', {
    p_session_token: sessionToken,
    p_amount: amount,
  });
  if (error) return { success: false, error: error.message };
  const r = data as Record<string, unknown>;
  return { success: Boolean(r.success), error: r.error ? String(r.error) : undefined };
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(PROFILE_KEY);
}
