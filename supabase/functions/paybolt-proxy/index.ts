import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, params } = await req.json();

    const payboltBase = 'https://www.paybolt.online/api';
    const userToken = Deno.env.get('VITE_PAYBOLT_USER_TOKEN') ?? Deno.env.get('PAYBOLT_USER_TOKEN');

    if (!userToken) {
      return new Response(
        JSON.stringify({ error: 'PayBolt token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let endpoint = '';
    const body = new URLSearchParams();

    if (action === 'create-order') {
      endpoint = '/create-order';
      body.set('user_token', userToken);
      body.set('customer_mobile', params.customerMobile ?? '');
      body.set('amount', String(params.amount ?? 0));
      body.set('order_id', params.orderId ?? '');
      body.set('redirect_url', params.redirectUrl ?? '');
      body.set('remark1', params.remark1 ?? 'Tryonetrade');
      body.set('remark2', params.remark2 ?? '');
    } else if (action === 'check-order-status') {
      endpoint = '/check-order-status';
      body.set('user_token', userToken);
      body.set('order_id', params.orderId ?? '');
    } else {
      return new Response(
        JSON.stringify({ error: 'Unknown action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const res = await fetch(`${payboltBase}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Proxy failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
