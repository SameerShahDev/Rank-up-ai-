-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETE AUTH FIX — Supabase SQL Editor me run karo
-- Ye sab kuch fix karega: table, functions, grants, RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. Extensions ────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── 1. DROP old conflicting tables/functions ─────────────────────────────
-- Safe: purani phone OTP system hata do
drop function if exists public.request_phone_otp(text) cascade;
drop function if exists public.verify_phone_otp(text, text) cascade;
drop function if exists public.normalize_phone(text) cascade;
drop table if exists public.phone_otps cascade;

-- ─── 2. Profiles table — email based ─────────────────────────────────────
-- Pehle check karo ki phone column hai ya nahi
do $$ begin
  -- Agar purani table hai to nayi table se replace karo
  if exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'phone') then
    -- Phone column exists — check if email column exists
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'email') then
      -- Add email column
      alter table public.profiles add column email text;
      -- Backfill from phone if possible
      update public.profiles set email = phone || '@tryonetrade.app' where email is null;
      alter table public.profiles alter column email set not null;
      alter table public.profiles add constraint profiles_email_unique unique (email);
      -- Add password_hash if missing
      alter table public.profiles add column if not exists password_hash text;
    end if;
    -- Make phone nullable (it's no longer required)
    alter table public.profiles alter column phone drop not null;
  else
    -- No profiles table or different structure — create fresh
    drop table if exists public.profiles cascade;
    create table public.profiles (
      id uuid primary key default gen_random_uuid(),
      email text unique not null,
      password_hash text not null,
      display_name text,
      demo_balance numeric(14,2) not null default 10000,
      real_balance numeric(14,2) not null default 0,
      session_token uuid not null default gen_random_uuid(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

-- Ensure all required columns exist (safe — uses ADD COLUMN IF NOT EXISTS)
alter table public.profiles add column if not exists id uuid primary key default gen_random_uuid();
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists password_hash text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists demo_balance numeric(14,2) not null default 10000;
alter table public.profiles add column if not exists real_balance numeric(14,2) not null default 0;
alter table public.profiles add column if not exists session_token uuid not null default gen_random_uuid();
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Make email NOT NULL and unique (safe)
do $$ begin
  -- First backfill any null emails
  update public.profiles set email = 'user_' || substr(id::text, 1, 8) || '@tryonetrade.app' where email is null;
  alter table public.profiles alter column email set not null;
exception when others then null;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_email_unique' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_email_unique unique (email);
  end if;
exception when others then null;
end $$;

-- Make password_hash NOT NULL
do $$ begin
  update public.profiles set password_hash = 'migrated' where password_hash is null;
  alter table public.profiles alter column password_hash set not null;
exception when others then null;
end $$;

-- ─── 3. Transactions ──────────────────────────────────────────────────────
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

-- ─── 4. Trades ────────────────────────────────────────────────────────────
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

-- ─── 5. Deposits ──────────────────────────────────────────────────────────
create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null,
  method text,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

-- ─── 6. Withdrawals ───────────────────────────────────────────────────────
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null,
  status text not null default 'processing',
  created_at timestamptz not null default now()
);

-- ─── 7. Payment Orders ────────────────────────────────────────────────────
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  order_id text unique not null,
  amount numeric(14,2) not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  utr text,
  webhook_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_payment_orders_profile on public.payment_orders(profile_id, created_at desc);
create index if not exists idx_payment_orders_status on public.payment_orders(status) where status = 'pending';

-- ─── 8. User Settings ─────────────────────────────────────────────────────
create table if not exists public.user_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  confirm_trade boolean not null default true,
  one_click_trading boolean not null default false,
  push_notifications boolean not null default true,
  default_account_mode text not null default 'demo' check (default_account_mode in ('demo', 'real')),
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- AUTH FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Register
create or replace function public.register_user(p_email text, p_password text)
returns json language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_profile record;
begin
  if length(p_email) < 3 or p_email !~ '@' then
    return json_build_object('success', false, 'error', 'Enter a valid email address');
  end if;
  if length(p_password) < 6 then
    return json_build_object('success', false, 'error', 'Password must be at least 6 characters');
  end if;

  insert into public.profiles (email, password_hash)
  values (lower(trim(p_email)), crypt(p_password, gen_salt('bf')))
  returning * into v_profile;

  return json_build_object(
    'success', true,
    'profile_id', v_profile.id,
    'session_token', v_profile.session_token,
    'email', v_profile.email,
    'display_name', v_profile.display_name,
    'needs_name', true,
    'demo_balance', v_profile.demo_balance,
    'real_balance', v_profile.real_balance
  );
exception when unique_violation then
  return json_build_object('success', false, 'error', 'An account with this email already exists');
end;
$$;

-- Login
create or replace function public.login_user(p_email text, p_password text)
returns json language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_profile record;
begin
  select * into v_profile from public.profiles where email = lower(trim(p_email));
  if not found then
    return json_build_object('success', false, 'error', 'Invalid email or password');
  end if;
  if v_profile.password_hash != crypt(p_password, v_profile.password_hash) then
    return json_build_object('success', false, 'error', 'Invalid email or password');
  end if;

  update public.profiles set session_token = gen_random_uuid(), updated_at = now()
  where id = v_profile.id returning * into v_profile;

  return json_build_object(
    'success', true,
    'profile_id', v_profile.id,
    'session_token', v_profile.session_token,
    'email', v_profile.email,
    'display_name', v_profile.display_name,
    'needs_name', (v_profile.display_name is null or trim(v_profile.display_name) = ''),
    'demo_balance', v_profile.demo_balance,
    'real_balance', v_profile.real_balance
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROFILE FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.update_profile_name(p_session_token uuid, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v_profile record;
begin
  if trim(p_name) = '' then
    return json_build_object('success', false, 'error', 'Name is required');
  end if;
  update public.profiles set display_name = trim(p_name), updated_at = now()
  where session_token = p_session_token returning * into v_profile;
  if not found then return json_build_object('success', false, 'error', 'Session expired'); end if;
  return json_build_object('success', true, 'display_name', v_profile.display_name);
end;
$$;

create or replace function public.get_profile_by_session(p_session_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_profile record;
begin
  select * into v_profile from public.profiles where session_token = p_session_token;
  if not found then return json_build_object('success', false); end if;
  return json_build_object(
    'success', true,
    'profile_id', v_profile.id,
    'email', v_profile.email,
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
declare v_profile record;
begin
  update public.profiles set
    demo_balance = greatest(0, p_demo_balance),
    real_balance = greatest(0, p_real_balance),
    updated_at = now()
  where session_token = p_session_token returning * into v_profile;
  if not found then return json_build_object('success', false); end if;
  return json_build_object('success', true, 'demo_balance', v_profile.demo_balance, 'real_balance', v_profile.real_balance);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TRANSACTION FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.insert_transaction(
  p_session_token uuid,
  p_tx_type text,
  p_coin text,
  p_amount_text text,
  p_usd_text text,
  p_account_mode text default 'real'
) returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_tx record;
begin
  select id into v_pid from public.profiles where session_token = p_session_token;
  if v_pid is null then return json_build_object('success', false); end if;
  insert into public.transactions (profile_id, tx_type, coin, amount_text, usd_text, account_mode)
  values (v_pid, p_tx_type, p_coin, p_amount_text, p_usd_text, p_account_mode)
  returning * into v_tx;
  return json_build_object('success', true, 'id', v_tx.id);
end;
$$;

create or replace function public.get_transactions(p_session_token uuid, p_limit int default 50)
returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid;
begin
  select id into v_pid from public.profiles where session_token = p_session_token;
  if v_pid is null then return '[]'::json; end if;
  return (
    select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
    from (
      select id, tx_type as type, coin, amount_text as amount, usd_text as usd,
        price_text as price, fee_text as fee, account_mode as account, status,
        to_char(created_at, 'HH12:MI AM') as time,
        case when created_at::date = current_date then 'Today' else to_char(created_at, 'Mon DD') end as date
      from public.transactions where profile_id = v_pid order by created_at desc limit p_limit
    ) t
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- DEPOSIT / WITHDRAWAL
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.record_deposit(p_session_token uuid, p_amount numeric, p_method text default 'upi')
returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid;
begin
  select id into v_pid from public.profiles where session_token = p_session_token;
  if v_pid is null then return json_build_object('success', false); end if;
  update public.profiles set real_balance = real_balance + p_amount, updated_at = now() where id = v_pid;
  insert into public.deposits (profile_id, amount, method) values (v_pid, p_amount, p_method);
  return json_build_object('success', true);
end;
$$;

create or replace function public.record_withdrawal(p_session_token uuid, p_amount numeric)
returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_bal numeric;
begin
  select id, real_balance into v_pid, v_bal from public.profiles where session_token = p_session_token;
  if v_pid is null or v_bal < p_amount then return json_build_object('success', false, 'error', 'Insufficient balance'); end if;
  update public.profiles set real_balance = real_balance - p_amount, updated_at = now() where id = v_pid;
  insert into public.withdrawals (profile_id, amount) values (v_pid, p_amount);
  return json_build_object('success', true);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PAYBOLT / PAYMENT ORDERS
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.register_payment_order(
  p_session_token uuid, p_order_id text, p_amount numeric
) returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid;
begin
  select id into v_pid from public.profiles where session_token = p_session_token;
  if v_pid is null then return json_build_object('success', false, 'error', 'Invalid session'); end if;
  insert into public.payment_orders (profile_id, order_id, amount, status)
  values (v_pid, p_order_id, p_amount, 'pending')
  on conflict (order_id) do nothing;
  return json_build_object('success', true, 'order_id', p_order_id);
end;
$$;

create or replace function public.finalize_paybolt_deposit(
  p_session_token uuid, p_order_id text, p_amount numeric,
  p_utr text default null, p_method text default 'paybolt'
) returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_order record;
begin
  select id into v_pid from public.profiles where session_token = p_session_token;
  if v_pid is null then return json_build_object('success', false, 'error', 'Invalid session'); end if;
  select * into v_order from public.payment_orders
  where order_id = p_order_id and profile_id = v_pid for update;
  if not found then
    insert into public.payment_orders (profile_id, order_id, amount, status)
    values (v_pid, p_order_id, p_amount, 'pending')
    returning * into v_order;
  end if;
  if v_order.status = 'completed' then
    return json_build_object('success', true, 'already_completed', true);
  end if;
  update public.profiles set real_balance = real_balance + p_amount, updated_at = now() where id = v_pid;
  insert into public.deposits (profile_id, amount, method) values (v_pid, p_amount, p_method);
  update public.payment_orders set status = 'completed', utr = coalesce(p_utr, utr), completed_at = now() where id = v_order.id;
  return json_build_object('success', true);
end;
$$;

create or replace function public.webhook_complete_paybolt_order(
  p_order_id text, p_amount numeric default null, p_utr text default null,
  p_status text default null, p_payload jsonb default null
) returns json language plpgsql security definer set search_path = public as $$
declare v_order record; v_amt numeric; v_st text;
begin
  v_st := upper(coalesce(p_status, ''));
  if v_st not in ('COMPLETED', 'SUCCESS') then
    if p_payload is not null then
      v_st := upper(coalesce(p_payload->>'status', p_payload#>>'{result,status}', p_payload#>>'{result,txnStatus}', ''));
    end if;
  end if;
  if v_st not in ('COMPLETED', 'SUCCESS') then
    return json_build_object('success', false, 'message', 'Not a success status', 'status', v_st);
  end if;
  select * into v_order from public.payment_orders where order_id = p_order_id for update;
  if not found then return json_build_object('success', false, 'error', 'Unknown order_id'); end if;
  if v_order.status = 'completed' then
    return json_build_object('success', true, 'already_completed', true);
  end if;
  v_amt := coalesce(p_amount, v_order.amount);
  update public.profiles set real_balance = real_balance + v_amt, updated_at = now() where id = v_order.profile_id;
  insert into public.deposits (profile_id, amount, method) values (v_order.profile_id, v_amt, 'paybolt');
  update public.payment_orders set status = 'completed', amount = v_amt,
    utr = coalesce(p_utr, utr), webhook_payload = coalesce(p_payload, webhook_payload), completed_at = now()
  where id = v_order.id;
  return json_build_object('success', true, 'order_id', p_order_id);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- DASHBOARD / SETTINGS
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.get_account_dashboard(p_session_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_profile record; v_settings record;
  v_deposits numeric; v_withdrawals numeric; v_tx_count int; v_trades_count int;
begin
  select * into v_profile from public.profiles where session_token = p_session_token;
  if not found then return json_build_object('success', false); end if;
  insert into public.user_settings (profile_id) values (v_profile.id) on conflict (profile_id) do nothing;
  select * into v_settings from public.user_settings where profile_id = v_profile.id;
  select coalesce(sum(amount), 0) into v_deposits from public.deposits where profile_id = v_profile.id;
  select coalesce(sum(amount), 0) into v_withdrawals from public.withdrawals where profile_id = v_profile.id;
  select count(*) into v_tx_count from public.transactions where profile_id = v_profile.id;
  select count(*) into v_trades_count from public.trades where profile_id = v_profile.id;
  return json_build_object(
    'success', true, 'profile_id', v_profile.id, 'email', v_profile.email,
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
declare v_pid uuid; v_settings record;
begin
  select id into v_pid from public.profiles where session_token = p_session_token;
  if v_pid is null then return json_build_object('success', false); end if;
  insert into public.user_settings (profile_id) values (v_pid) on conflict do nothing;
  update public.user_settings set
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

-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS — anon role ko RPC execute permission do
-- ═══════════════════════════════════════════════════════════════════════════

grant execute on function public.register_user(text, text) to anon, authenticated;
grant execute on function public.login_user(text, text) to anon, authenticated;
grant execute on function public.update_profile_name(uuid, text) to anon, authenticated;
grant execute on function public.get_profile_by_session(uuid) to anon, authenticated;
grant execute on function public.update_profile_balances(uuid, numeric, numeric) to anon, authenticated;
grant execute on function public.insert_transaction(uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_transactions(uuid, int) to anon, authenticated;
grant execute on function public.record_deposit(uuid, numeric, text) to anon, authenticated;
grant execute on function public.record_withdrawal(uuid, numeric) to anon, authenticated;
grant execute on function public.register_payment_order(uuid, text, numeric) to anon, authenticated;
grant execute on function public.finalize_paybolt_deposit(uuid, text, numeric, text, text) to anon, authenticated;
grant execute on function public.webhook_complete_paybolt_order(text, numeric, text, text, jsonb) to service_role;
grant execute on function public.get_account_dashboard(uuid) to anon, authenticated;
grant execute on function public.update_user_settings(uuid, boolean, boolean, boolean, text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — Row Level Security
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.trades enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;
alter table public.user_settings enable row level security;
alter table public.payment_orders enable row level security;

-- Drop old policies if they exist, then create fresh
do $$ begin
  -- profiles
  if exists (select 1 from pg_policies where policyname = 'deny anon profiles' and tablename = 'profiles') then
    drop policy "deny anon profiles" on public.profiles;
  end if;
  create policy "deny anon profiles" on public.profiles for all to anon using (false);
  -- transactions
  if exists (select 1 from pg_policies where policyname = 'deny anon transactions' and tablename = 'transactions') then
    drop policy "deny anon transactions" on public.transactions;
  end if;
  create policy "deny anon transactions" on public.transactions for all to anon using (false);
  -- trades
  if exists (select 1 from pg_policies where policyname = 'deny anon trades' and tablename = 'trades') then
    drop policy "deny anon trades" on public.trades;
  end if;
  create policy "deny anon trades" on public.trades for all to anon using (false);
  -- deposits
  if exists (select 1 from pg_policies where policyname = 'deny anon deposits' and tablename = 'deposits') then
    drop policy "deny anon deposits" on public.deposits;
  end if;
  create policy "deny anon deposits" on public.deposits for all to anon using (false);
  -- withdrawals
  if exists (select 1 from pg_policies where policyname = 'deny anon withdrawals' and tablename = 'withdrawals') then
    drop policy "deny anon withdrawals" on public.withdrawals;
  end if;
  create policy "deny anon withdrawals" on public.withdrawals for all to anon using (false);
  -- user_settings
  if exists (select 1 from pg_policies where policyname = 'deny anon user_settings' and tablename = 'user_settings') then
    drop policy "deny anon user_settings" on public.user_settings;
  end if;
  create policy "deny anon user_settings" on public.user_settings for all to anon using (false);
  -- payment_orders
  if exists (select 1 from pg_policies where policyname = 'deny anon payment_orders' and tablename = 'payment_orders') then
    drop policy "deny anon payment_orders" on public.payment_orders;
  end if;
  create policy "deny anon payment_orders" on public.payment_orders for all to anon using (false);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! Ab tu Supabase Dashboard → Table Editor → profiles me emails dekh sakta hai
-- ═══════════════════════════════════════════════════════════════════════════
