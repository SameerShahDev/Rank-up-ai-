import {
  PAYBOLT_API_BASE,
  PAYBOLT_PROXY_URL,
  PAYBOLT_PROXY_ANON_KEY,
  PAYBOLT_REDIRECT_URL,
  PAYBOLT_USER_TOKEN,
  isPayboltConfigured,
} from '../lib/paybolt';
import { registerPaymentOrder } from './authService';
import type {
  PayboltCheckStatusResponse,
  PayboltCreateOrderResponse,
} from '../types/paybolt';

const TIMEOUT_MS = 15000;

async function proxyCall<T>(action: string, params: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(PAYBOLT_PROXY_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAYBOLT_PROXY_ANON_KEY}`,
        'apikey': PAYBOLT_PROXY_ANON_KEY ?? '',
      },
      body: JSON.stringify({ action, params }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    if (!res.ok) {
      let msg = `Gateway error (${res.status})`;
      try { const j = JSON.parse(text); msg = j.message || j.error || j.detail || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    try { return JSON.parse(text) as T; } catch { throw new Error('Invalid gateway response'); }
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('Gateway timeout. Try again.');
    throw e;
  }
}

async function directCall<T>(path: string, fields: Record<string, string>): Promise<T> {
  const body = new URLSearchParams(fields);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${PAYBOLT_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    if (!res.ok) {
      let msg = `Gateway error (${res.status})`;
      try { const j = JSON.parse(text); msg = j.message || j.error || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    try { return JSON.parse(text) as T; } catch { throw new Error('Invalid gateway response'); }
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('Gateway timeout. Try again.');
    throw e;
  }
}

const isDev = import.meta.env.DEV;

/** Use Edge Function in prod, direct call in dev */
async function payboltPost<T>(path: string, fields: Record<string, string>, action: string, params: Record<string, unknown>): Promise<T> {
  if (!isDev && PAYBOLT_PROXY_URL) {
    return proxyCall<T>(action, params);
  }
  return directCall<T>(path, fields);
}

export function isPaymentComplete(data: PayboltCheckStatusResponse): boolean {
  const top = String(data.status ?? '').toUpperCase();
  const r = data.result;
  const txn = String(r?.txnStatus ?? r?.status ?? '').toUpperCase();
  return (
    top === 'COMPLETED' ||
    top === 'SUCCESS' ||
    txn === 'COMPLETED' ||
    txn === 'SUCCESS'
  );
}

export async function createPayboltOrder(params: {
  customerMobile: string;
  amount: number;
  orderId: string;
  sessionToken?: string;
  remark1?: string;
  remark2?: string;
}): Promise<{ success: true; paymentUrl: string; orderId: string } | { success: false; error: string }> {
  if (!isPayboltConfigured || !PAYBOLT_USER_TOKEN) {
    return { success: false, error: 'PayBolt is not configured. Add VITE_PAYBOLT_USER_TOKEN to .env' };
  }

  try {
    const data = await payboltPost<PayboltCreateOrderResponse>(
      '/create-order',
      {
        customer_mobile: params.customerMobile,
        user_token: PAYBOLT_USER_TOKEN,
        amount: String(params.amount),
        order_id: params.orderId,
        redirect_url: PAYBOLT_REDIRECT_URL,
        remark1: params.remark1 ?? 'Tryonetrade deposit',
        remark2: params.remark2 ?? params.orderId,
      },
      'create-order',
      {
        customerMobile: params.customerMobile,
        amount: params.amount,
        orderId: params.orderId,
        redirectUrl: PAYBOLT_REDIRECT_URL,
        remark1: params.remark1 ?? 'Tryonetrade deposit',
        remark2: params.remark2 ?? params.orderId,
      },
    );

    if (!data.status || !data.result?.payment_url) {
      return { success: false, error: data.message || 'Could not create payment order' };
    }

    const finalOrderId = data.result.orderId || params.orderId;

    if (params.sessionToken) {
      await registerPaymentOrder(params.sessionToken, finalOrderId, params.amount);
    }

    return {
      success: true,
      paymentUrl: data.result.payment_url,
      orderId: finalOrderId,
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Payment failed' };
  }
}

export async function checkPayboltOrderStatus(
  orderId: string,
): Promise<
  | { success: true; completed: true; utr?: string; amount?: string }
  | { success: true; completed: false; message?: string }
  | { success: false; error: string }
> {
  if (!isPayboltConfigured || !PAYBOLT_USER_TOKEN) {
    return { success: false, error: 'PayBolt not configured' };
  }

  try {
    const data = await payboltPost<PayboltCheckStatusResponse>(
      '/check-order-status',
      { user_token: PAYBOLT_USER_TOKEN, order_id: orderId },
      'check-order-status',
      { orderId },
    );

    if (isPaymentComplete(data)) {
      return {
        success: true,
        completed: true,
        utr: data.result?.utr,
        amount: data.result?.amount,
      };
    }

    return { success: true, completed: false, message: data.message };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Status check failed' };
  }
}
