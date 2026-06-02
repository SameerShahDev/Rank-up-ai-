import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AccountDashboard, UserSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

const SETTINGS_KEY = 'tryonetrade_user_settings';

function settingsStorageKey(profileId: string) {
  return `${SETTINGS_KEY}_${profileId}`;
}

function loadLocalSettings(profileId: string): UserSettings {
  try {
    const raw = localStorage.getItem(settingsStorageKey(profileId));
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveLocalSettings(profileId: string, settings: UserSettings) {
  localStorage.setItem(settingsStorageKey(profileId), JSON.stringify(settings));
}

function mapDashboard(row: Record<string, unknown>): AccountDashboard {
  const created = String(row.created_at ?? new Date().toISOString());
  return {
    profile: {
      profileId: String(row.profile_id),
      email: String(row.email),
      displayName: row.display_name ? String(row.display_name) : null,
      demoBalance: Number(row.demo_balance ?? 0),
      realBalance: Number(row.real_balance ?? 0),
      createdAt: created,
    },
    settings: {
      confirmTrade: Boolean(row.confirm_trade ?? true),
      oneClickTrading: Boolean(row.one_click_trading ?? false),
      pushNotifications: Boolean(row.push_notifications ?? true),
      defaultAccountMode: row.default_account_mode === 'real' ? 'real' : 'demo',
    },
    stats: {
      totalDeposits: Number(row.total_deposits ?? 0),
      totalWithdrawals: Number(row.total_withdrawals ?? 0),
      transactionCount: Number(row.transaction_count ?? 0),
      tradeCount: Number(row.trade_count ?? 0),
      memberSince: new Date(created).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    },
  };
}

export async function fetchAccountDashboard(
  sessionToken: string,
  profileId: string,
): Promise<AccountDashboard | null> {
  if (!isSupabaseConfigured || !supabase) {
    const local = loadLocalSettings(profileId);
    const cached = localStorage.getItem('tryonetrade_profile');
    const p = cached ? JSON.parse(cached) : null;
    if (!p) return null;
    return {
      profile: {
        profileId: p.profileId ?? profileId,
        email: p.email ?? '',
        displayName: p.displayName ?? null,
        demoBalance: p.demoBalance ?? 10000,
        realBalance: p.realBalance ?? 0,
        createdAt: new Date().toISOString(),
      },
      settings: local,
      stats: {
        totalDeposits: 0,
        totalWithdrawals: 0,
        transactionCount: 0,
        tradeCount: 0,
        memberSince: new Date().toLocaleDateString('en-IN'),
      },
    };
  }

  const { data, error } = await supabase.rpc('get_account_dashboard', {
    p_session_token: sessionToken,
  });

  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  if (!r.success) return null;
  return mapDashboard(r);
}

export async function saveUserSettings(
  sessionToken: string,
  profileId: string,
  settings: UserSettings,
): Promise<boolean> {
  saveLocalSettings(profileId, settings);

  if (!isSupabaseConfigured || !supabase) return true;

  const { data, error } = await supabase.rpc('update_user_settings', {
    p_session_token: sessionToken,
    p_confirm_trade: settings.confirmTrade,
    p_one_click: settings.oneClickTrading,
    p_push_notifications: settings.pushNotifications,
    p_default_mode: settings.defaultAccountMode,
  });

  if (error) return false;
  const r = data as Record<string, unknown>;
  return Boolean(r.success);
}
