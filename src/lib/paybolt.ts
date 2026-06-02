const rawBase = import.meta.env.VITE_PAYBOLT_API_BASE as string | undefined;
const proxyBase = import.meta.env.VITE_PAYBOLT_PROXY as string | undefined;

/** In dev use proxy to avoid CORS; in prod use Supabase Edge Function */
const isDev = import.meta.env.DEV;
export const PAYBOLT_API_BASE = isDev && proxyBase
  ? proxyBase
  : rawBase || 'https://www.paybolt.online/api';

/** Supabase Edge Function URL for production (avoids CORS) */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const PAYBOLT_PROXY_URL = supabaseUrl
  ? `${supabaseUrl}/functions/v1/paybolt-proxy`
  : null;
export const PAYBOLT_PROXY_ANON_KEY = supabaseAnonKey ?? null;

export const PAYBOLT_USER_TOKEN = import.meta.env.VITE_PAYBOLT_USER_TOKEN as string | undefined;

export const PAYBOLT_REDIRECT_URL =
  (import.meta.env.VITE_PAYBOLT_REDIRECT_URL as string | undefined) ||
  (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?paybolt_return=1` : '');

export const isPayboltConfigured = Boolean(
  PAYBOLT_USER_TOKEN && PAYBOLT_USER_TOKEN.length > 10 && !PAYBOLT_USER_TOKEN.includes('YOUR_'),
);

export const PENDING_DEPOSIT_KEY = 'tryonetrade_pending_deposit';

export function generatePayboltOrderId() {
  return `TR${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
}

/** API expects 10-digit mobile without country code */
/** Set in PayBolt dashboard after deploying supabase/functions/paybolt-webhook */
export function getPayboltWebhookUrl(supabaseProjectRef?: string) {
  if (!supabaseProjectRef) return null;
  return `https://${supabaseProjectRef}.supabase.co/functions/v1/paybolt-webhook`;
}

export function normalizePayboltMobile(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('91')) return d.slice(2);
  if (d.length === 10) return d;
  return d.slice(-10);
}
