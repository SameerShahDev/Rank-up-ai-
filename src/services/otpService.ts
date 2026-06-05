import { supabase, isSupabaseConfigured } from '../lib/supabase';

export async function sendOtp(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    const raw = localStorage.getItem('tryonetrade_profile');
    if (!raw) return { success: false, error: 'No account found. Please sign up first.' };
    const p = JSON.parse(raw);
    if (p.email !== email.trim().toLowerCase()) return { success: false, error: 'No account found with this email' };
    return { success: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-otp', {
      body: { action: 'send', email: email.trim() },
    });

    if (error) throw error;
    if (!data?.success) return { success: false, error: data?.error ?? 'Failed to send OTP' };
    return { success: true };
  } catch (e) {
    console.error('[otpService] sendOtp error:', e);
    return { success: false, error: 'Could not send OTP. Try again later.' };
  }
}

export async function verifyOtp(
  email: string,
  otp: string,
): Promise<{ success: boolean; profile?: { profileId: string; email: string; displayName: string | null }; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    const raw = localStorage.getItem('tryonetrade_profile');
    if (!raw) return { success: false, error: 'Verification not available in demo mode' };
    const p = JSON.parse(raw);
    if (p.email !== email.trim().toLowerCase()) return { success: false, error: 'Invalid code' };
    return { success: true, profile: p };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-otp', {
      body: { action: 'verify', email: email.trim(), otp },
    });

    if (error) throw error;
    if (!data?.success) return { success: false, error: data?.error ?? 'Invalid code' };
    return { success: true, profile: data.profile ?? undefined };
  } catch (e) {
    console.error('[otpService] verifyOtp error:', e);
    return { success: false, error: 'Verification failed. Try again.' };
  }
}
