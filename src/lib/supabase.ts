import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes('YOUR_PROJECT'),
);

console.log('[Supabase] Configured:', isSupabaseConfigured, '| URL:', url?.substring(0, 40) + '...');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;

export const SESSION_KEY = 'tryonetrade_session_token';
export const PROFILE_KEY = 'tryonetrade_profile';
