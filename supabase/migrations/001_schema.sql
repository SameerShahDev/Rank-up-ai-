-- CryptoX Trading — run in Supabase SQL Editor

create extension if not exists "pgcrypto";

-- ─── Profiles (user accounts) ─────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  display_name text,
  demo_balance numeric(14,2) not null default 10000,
  real_balance numeric(14,2) not null default 0,
  session_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── OTP (in-app delivery for demo; use SMS provider in production) ───────
create table if not exists public.phone_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_phone_otps_phone on public.phone_otps(phone, created_at desc);

-- ─── Transactions (activity feed) ───────────────────────────────────────
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tx_type text not null,
  coin text not null default 'INR',
  amount_text text not null,
  usd_text text not null,
  price_text text default '₹1.00',
  fee_text text default '₹0.00',
  account_mode text not null default 'real',
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

-- ─── Trades (binary options history) ──────────────────────────────────────
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  asset_id text not null,
  direction text not null check (direction in ('UP', 'DOWN')),
  amount numeric(14,2) not null,
  entry_price numeric(18,6) not null,
  exit_price numeric(18,6),
  profit numeric(14,2) not null default 0,
  account_mode text not null default 'demo',
  status text not null default 'open',
  duration_sec int not null default 60,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

-- ─── Deposits & withdrawals ───────────────────────────────────────────────
create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null,
  method text,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null,
  status text not null default 'processing',
  created_at timestamptz not null default now()
);

-- ─── Helpers ──────────────────────────────────────────────────────────────
create or replace function public.normalize_phone(p text)
returns text language sql immutable as $$
  select regexp_replace(trim(p), '[^0-9]', '', 'g');
$$;

-- Request OTP (returns code for in-app popup — use SMS in production)
create or replace function public.request_phone_otp(p_phone text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_code text;
begin
  v_phone := normalize_phone(p_phone);
  if length(v_phone) < 10 then
    return json_build_object('success', false, 'error', 'Enter a valid 10-digit mobile number');
  end if;
  if length(v_phone) = 10 then v_phone := '91' || v_phone; end if;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into phone_otps (phone, code, expires_at) values (v_phone, v_code, now() + interval '5 minutes');

  return json_build_object('success', true, 'phone', v_phone, 'otp', v_code);
end;
$$;

-- Verify OTP → create/login profile
create or replace function public.verify_phone_otp(p_phone text, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_row phone_otps%rowtype;
  v_profile profiles%rowtype;
begin
  v_phone := normalize_phone(p_phone);
  if length(v_phone) = 10 then v_phone := '91' || v_phone; end if;

  select * into v_row from phone_otps
  where phone = v_phone and code = p_code and used = false and expires_at > now()
  order by created_at desc limit 1;

  if not found then
    return json_build_object('success', false, 'error', 'Invalid or expired OTP');
  end if;

  update phone_otps set used = true where id = v_row.id;

  select * into v_profile from profiles where phone = v_phone;

  if not found then
    insert into profiles (phone) values (v_phone) returning * into v_profile;
  else
    update profiles set session_token = gen_random_uuid(), updated_at = now()
    where id = v_profile.id returning * into v_profile;
  end if;

  return json_build_object(
    'success', true,
    'profile_id', v_profile.id,
    'session_token', v_profile.session_token,
    'phone', v_profile.phone,
    'display_name', v_profile.display_name,
    'needs_name', (v_profile.display_name is null or trim(v_profile.display_name) = ''),
    'demo_balance', v_profile.demo_balance,
    'real_balance', v_profile.real_balance
  );
end;
$$;

create or replace function public.update_profile_name(p_session_token uuid, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v_profile profiles%rowtype;
begin
  if trim(p_name) = '' then
    return json_build_object('success', false, 'error', 'Name is required');
  end if;
  update profiles set display_name = trim(p_name), updated_at = now()
  where session_token = p_session_token returning * into v_profile;
  if not found then return json_build_object('success', false, 'error', 'Session expired'); end if;
  return json_build_object('success', true, 'display_name', v_profile.display_name);
end;
$$;

create or replace function public.get_profile_by_session(p_session_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_profile profiles%rowtype;
begin
  select * into v_profile from profiles where session_token = p_session_token;
  if not found then return json_build_object('success', false); end if;
  return json_build_object(
    'success', true,
    'profile_id', v_profile.id,
    'phone', v_profile.phone,
    'display_name', v_profile.display_name,
    'demo_balance', v_profile.demo_balance,
    'real_balance', v_profile.real_balance,
    'needs_name', (v_profile.display_name is null or trim(v_profile.display_name) = '')
  );
end;
$$;

create or replace function public.update_profile_balances(
  p_session_token uuid,
  p_demo_balance numeric,
  p_real_balance numeric
) returns json language plpgsql security definer set search_path = public as $$
declare v_profile profiles%rowtype;
begin
  update profiles set
    demo_balance = greatest(0, p_demo_balance),
    real_balance = greatest(0, p_real_balance),
    updated_at = now()
  where session_token = p_session_token returning * into v_profile;
  if not found then return json_build_object('success', false); end if;
  return json_build_object('success', true, 'demo_balance', v_profile.demo_balance, 'real_balance', v_profile.real_balance);
end;
$$;

create or replace function public.insert_transaction(
  p_session_token uuid,
  p_tx_type text,
  p_coin text,
  p_amount_text text,
  p_usd_text text,
  p_account_mode text default 'real'
) returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid;
  v_tx transactions%rowtype;
begin
  select id into v_pid from profiles where session_token = p_session_token;
  if v_pid is null then return json_build_object('success', false); end if;
  insert into transactions (profile_id, tx_type, coin, amount_text, usd_text, account_mode)
  values (v_pid, p_tx_type, p_coin, p_amount_text, p_usd_text, p_account_mode)
  returning * into v_tx;
  return json_build_object('success', true, 'id', v_tx.id);
end;
$$;

create or replace function public.get_transactions(p_session_token uuid, p_limit int default 50)
returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid;
begin
  select id into v_pid from profiles where session_token = p_session_token;
  if v_pid is null then return '[]'::json; end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
    from (
      select id, tx_type as type, coin, amount_text as amount, usd_text as usd,
        price_text as price, fee_text as fee, account_mode as account, status,
        to_char(created_at, 'HH12:MI AM') as time,
        case when created_at::date = current_date then 'Today' else to_char(created_at, 'Mon DD') end as date
      from transactions where profile_id = v_pid order by created_at desc limit p_limit
    ) t
  );
end;
$$;

create or replace function public.record_deposit(p_session_token uuid, p_amount numeric, p_method text default 'upi')
returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid;
begin
  select id into v_pid from profiles where session_token = p_session_token;
  if v_pid is null then return json_build_object('success', false); end if;
  update profiles set real_balance = real_balance + p_amount, updated_at = now() where id = v_pid;
  insert into deposits (profile_id, amount, method) values (v_pid, p_amount, p_method);
  return json_build_object('success', true);
end;
$$;

create or replace function public.record_withdrawal(p_session_token uuid, p_amount numeric)
returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid;
  v_bal numeric;
begin
  select id, real_balance into v_pid, v_bal from profiles where session_token = p_session_token;
  if v_pid is null or v_bal < p_amount then return json_build_object('success', false, 'error', 'Insufficient balance'); end if;
  update profiles set real_balance = real_balance - p_amount, updated_at = now() where id = v_pid;
  insert into withdrawals (profile_id, amount) values (v_pid, p_amount);
  return json_build_object('success', true);
end;
$$;

grant execute on function public.request_phone_otp(text) to anon, authenticated;
grant execute on function public.verify_phone_otp(text, text) to anon, authenticated;
grant execute on function public.update_profile_name(uuid, text) to anon, authenticated;
grant execute on function public.get_profile_by_session(uuid) to anon, authenticated;
grant execute on function public.update_profile_balances(uuid, numeric, numeric) to anon, authenticated;
grant execute on function public.insert_transaction(uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_transactions(uuid, int) to anon, authenticated;
grant execute on function public.record_deposit(uuid, numeric, text) to anon, authenticated;
grant execute on function public.record_withdrawal(uuid, numeric) to anon, authenticated;

-- ─── User settings (Settings tab) ─────────────────────────────────────────
create table if not exists public.user_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  confirm_trade boolean not null default true,
  one_click_trading boolean not null default false,
  push_notifications boolean not null default true,
  default_account_mode text not null default 'demo' check (default_account_mode in ('demo', 'real')),
  updated_at timestamptz not null default now()
);

create or replace function public.get_account_dashboard(p_session_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles%rowtype;
  v_settings user_settings%rowtype;
  v_deposits numeric;
  v_withdrawals numeric;
  v_tx_count int;
  v_trades_count int;
begin
  select * into v_profile from profiles where session_token = p_session_token;
  if not found then return json_build_object('success', false); end if;
  insert into user_settings (profile_id) values (v_profile.id) on conflict (profile_id) do nothing;
  select * into v_settings from user_settings where profile_id = v_profile.id;
  select coalesce(sum(amount), 0) into v_deposits from deposits where profile_id = v_profile.id;
  select coalesce(sum(amount), 0) into v_withdrawals from withdrawals where profile_id = v_profile.id;
  select count(*) into v_tx_count from transactions where profile_id = v_profile.id;
  select count(*) into v_trades_count from trades where profile_id = v_profile.id;
  return json_build_object(
    'success', true, 'profile_id', v_profile.id, 'phone', v_profile.phone,
    'display_name', v_profile.display_name, 'demo_balance', v_profile.demo_balance,
    'real_balance', v_profile.real_balance, 'created_at', v_profile.created_at,
    'confirm_trade', v_settings.confirm_trade, 'one_click_trading', v_settings.one_click_trading,
    'push_notifications', v_settings.push_notifications, 'default_account_mode', v_settings.default_account_mode,
    'total_deposits', v_deposits, 'total_withdrawals', v_withdrawals,
    'transaction_count', v_tx_count, 'trade_count', v_trades_count
  );
end;
$$;

create or replace function public.update_user_settings(
  p_session_token uuid, p_confirm_trade boolean default null,
  p_one_click boolean default null, p_push_notifications boolean default null,
  p_default_mode text default null
) returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_settings user_settings%rowtype;
begin
  select id into v_pid from profiles where session_token = p_session_token;
  if v_pid is null then return json_build_object('success', false); end if;
  insert into user_settings (profile_id) values (v_pid) on conflict do nothing;
  update user_settings set
    confirm_trade = coalesce(p_confirm_trade, confirm_trade),
    one_click_trading = coalesce(p_one_click, one_click_trading),
    push_notifications = coalesce(p_push_notifications, push_notifications),
    default_account_mode = coalesce(p_default_mode, default_account_mode),
    updated_at = now()
  where profile_id = v_pid returning * into v_settings;
  return json_build_object('success', true,
    'confirm_trade', v_settings.confirm_trade, 'one_click_trading', v_settings.one_click_trading,
    'push_notifications', v_settings.push_notifications, 'default_account_mode', v_settings.default_account_mode);
end;
$$;

grant execute on function public.get_account_dashboard(uuid) to anon, authenticated;
grant execute on function public.update_user_settings(uuid, boolean, boolean, boolean, text) to anon, authenticated;

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.phone_otps enable row level security;
alter table public.transactions enable row level security;
alter table public.trades enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;
alter table public.user_settings enable row level security;

-- No direct table access for anon (all via RPC)
create policy if not exists "deny anon profiles" on public.profiles for all to anon using (false);
create policy if not exists "deny anon otps" on public.phone_otps for all to anon using (false);
create policy if not exists "deny anon user_settings" on public.user_settings for all to anon using (false);
