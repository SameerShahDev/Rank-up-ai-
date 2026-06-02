import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parsePayload(req: Request, raw: string): Record<string, unknown> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  const params = new URLSearchParams(raw);
  if ([...params.keys()].length > 0) {
    const out: Record<string, unknown> = {};
    params.forEach((v, k) => { out[k] = v; });
    return out;
  }
  return {};
}

function pickOrderId(body: Record<string, unknown>): string | null {
  const result = body.result as Record<string, unknown> | undefined;
  const id =
    body.order_id ??
    body.orderId ??
    result?.orderId ??
    result?.order_id;
  return id ? String(id) : null;
}

function pickStatus(body: Record<string, unknown>): string {
  const result = body.result as Record<string, unknown> | undefined;
  return String(
    body.status ??
    result?.status ??
    result?.txnStatus ??
    '',
  );
}

function pickAmount(body: Record<string, unknown>): number | null {
  const result = body.result as Record<string, unknown> | undefined;
  const raw = body.amount ?? result?.amount;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function pickUtr(body: Record<string, unknown>): string | null {
  const result = body.result as Record<string, unknown> | undefined;
  const utr = body.utr ?? result?.utr;
  return utr ? String(utr) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ success: false, error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const raw = await req.text();
  const body = parsePayload(req, raw);
  const orderId = pickOrderId(body);

  if (!orderId) {
    return new Response(JSON.stringify({ success: false, error: 'order_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.rpc('webhook_complete_paybolt_order', {
    p_order_id: orderId,
    p_amount: pickAmount(body),
    p_utr: pickUtr(body),
    p_status: pickStatus(body),
    p_payload: body,
  });

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data ?? { success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
