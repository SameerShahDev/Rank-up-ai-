import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, email, otp } = await req.json() as {
      action: 'send' | 'verify';
      email: string;
      otp?: string;
    };

    const normalizedEmail = email.trim().toLowerCase();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === 'send') {
      const code = generateOtp();
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
        .then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''));

      await supabase.from('otp_codes').insert({
        email: normalizedEmail,
        code_hash: hash,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Resend API key not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Tryonetrade <noreply@tryonetrade.com>',
          to: normalizedEmail,
          subject: 'Your login code',
          html: `
            <div style="font-family:sans-serif;padding:24px;background:#0a0b0f;color:#fff;border-radius:12px;max-width:400px;margin:0 auto;">
              <h2 style="font-size:20px;font-weight:800;margin:0 0 8px;">Tryonetrade</h2>
              <p style="color:#aaa;font-size:14px;margin:0 0 20px;">Use the code below to sign in.</p>
              <div style="background:#161821;border-radius:10px;padding:16px;text-align:center;font-size:32px;font-weight:800;letter-spacing:8px;color:#fff;">
                ${code}
              </div>
              <p style="color:#666;font-size:12px;margin:20px 0 0;">This code expires in 10 minutes.</p>
            </div>
          `,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('[Resend] Error:', err);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to send email' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      console.log('[Resend] OTP sent to:', normalizedEmail);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'verify') {
      if (!otp) {
        return new Response(
          JSON.stringify({ success: false, error: 'OTP is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: rows, error: dbErr } = await supabase
        .from('otp_codes')
        .select('code_hash, expires_at')
        .eq('email', normalizedEmail)
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (dbErr || !rows?.length) {
        return new Response(
          JSON.stringify({ success: false, error: 'No OTP found. Request a new one.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const record = rows[0];
      if (new Date(record.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Code expired. Request a new one.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(otp))
        .then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''));

      if (hash !== record.code_hash) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid code' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      await supabase.from('otp_codes').update({ used: true }).eq('email', normalizedEmail);

      let profile = null;
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', normalizedEmail)
        .single();

      if (prof) {
        profile = {
          profileId: prof.id,
          email: prof.email,
          displayName: prof.display_name,
          demoBalance: Number(prof.demo_balance),
          realBalance: Number(prof.real_balance),
        };
      }

      return new Response(
        JSON.stringify({ success: true, profile }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('[send-otp] Error:', e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
