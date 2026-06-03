-- ═══════════════════════════════════════════════════════════════════════════
-- SUPABASE AUTH MIGRATION — Fresh Start
-- Supabase SQL Editor me run karo
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. Extensions ────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── 1. Drop old custom auth functions ────────────────────────────────────
drop function if exists public.register_user(text, text) cascade;
drop function if exists public.login_user(text, text) cascade;
drop function if exists public.get_profile_by_session(uuid) cascade;

-- ─── 2. Drop old tables that depend on old profiles ───────────────────────
-- (Triggers and foreign keys first)
drop trigger if exists on_auth_user_created on auth.users cascade;
drop function if exists public.handle_new_user() cascade;

-- ─── 3. Recreate profiles table linked to auth.users ──────────────────────
-- Backup old data first
create table if not exists public.profiles_backup as select * from public.profiles;

-- Drop old profiles
drop table if exists public.profiles cascade;

-- Create new profiles linked to auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  demo_balance numeric(14,2) not null default 10000,
  real_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── 4. Trigger — auto create profile on signup ───────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── 5. Transactions ──────────────────────────────────────────────────────
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

-- ─── 6. Trades ────────────────────────────────────────────────────────────
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

-- ─── 7. Deposits ──────────────────────────────────────────────────────────
create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null,
  method text,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

-- ─── 8. Withdrawals ───────────────────────────────────────────────────────
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null,
  status text not null default 'processing',
  created_at timestamptz not null default now()
);

-- ─── 9. Payment Orders ────────────────────────────────────────────────────
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

-- ─── 10. User Settings ────────────────────────────────────────────────────
create table if not exists public.user_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  confirm_trade boolean not null default true,
  one_click_trading boolean not null default false,
  push_notifications boolean not null default true,
  default_account_mode text not null default 'demo' check (default_account_mode in ('demo', 'real')),
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- RPC FUNCTIONS — all use auth.uid() instead of session_token
-- ═══════════════════════════════════════════════════════════════════════════

-- Get my profile
create or replace function public.get_my_profile()
returns json language plpgsql security definer
set search_path = public as $$
declare v_profile record;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then return json_build_object('success', false); end if;
  return json_build_object(
    'success', true,
    'profile_id', v_profile.id,
    'email', v_profile.email,
    'display_name', v_profile.display_name,
    'demo_balance', v_profile.demo_balance,
    'real_balance', v_profile.real_balance,
    'created_at', v_profile.created_at
  );
end;
$$;

-- Update display name
create or replace function public.update_display_name(p_name text)
returns json language plpgsql security definer
set search_path = public as $$
declare v_profile record;
begin
  if trim(p_name) = '' then
    return json_build_object('success', false, 'error', 'Name is required');
  end if;
  update public.profiles set display_name = trim(p_name), updated_at = now()
  where id = auth.uid() returning * into v_profile;
  if not found then return json_build_object('success', false, 'error', 'Profile not found'); end if;
  return json_build_object('success', true, 'display_name', v_profile.display_name);
end;
$$;

-- Update balances
create or replace function public.update_my_balances(
  p_demo_balance numeric,
  p_real_balance numeric
) returns json language plpgsql security definer
set search_path = public as $$
declare v_profile record;
begin
  update public.profiles set
    demo_balance = greatest(0, p_demo_balance),
    real_balance = greatest(0, p_real_balance),
    updated_at = now()
  where id = auth.uid() returning * into v_profile;
  if not found then return json_build_object('success', false); end if;
  return json_build_object('success', true, 'demo_balance', v_profile.demo_balance, 'real_balance', v_profile.real_balance);
end;
$$;

-- Insert transaction
create or replace function public.insert_my_transaction(
  p_tx_type text,
  p_coin text,
  p_amount_text text,
  p_usd_text text,
  p_account_mode text default 'real'
) returns json language plpgsql security definer
set search_path = public as $$
declare v_tx record;
begin
  insert into public.transactions (profile_id, tx_type, coin, amount_text, usd_text, account_mode)
  values (auth.uid(), p_tx_type, p_coin, p_amount_text, p_usd_text, p_account_mode)
  returning * into v_tx;
  return json_build_object('success', true, 'id', v_tx.id);
end;
$$;

-- Get transactions
create or replace function public.get_my_transactions(p_limit int default 50)
returns json language plpgsql security definer
set search_path = public as $$
begin
  return (
    select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
    from (
      select id, tx_type as type, coin, amount_text as amount, usd_text as usd,
        price_text as price, fee_text as fee, account_mode as account, status,
        to_char(created_at, 'HH12:MI AM') as time,
        case when created_at::date = current_date then 'Today' else to_char(created_at, 'Mon DD') end as date
      from public.transactions where profile_id = auth.uid() order by created_at desc limit p_limit
    ) t
  );
end;
$$;

-- Record deposit
create or replace function public.record_my_deposit(p_amount numeric, p_method text default 'upi')
returns json language plpgsql security definer
set search_path = public as $$
begin
  update public.profiles set real_balance = real_balance + p_amount, updated_at = now() where id = auth.uid();
  insert into public.deposits (profile_id, amount, method) values (auth.uid(), p_amount, p_method);
  return json_build_object('success', true);
end;
$$;

-- Record withdrawal
create or replace function public.record_my_withdrawal(p_amount numeric)
returns json language plpgsql security definer
set search_path = public as $$
declare v_bal numeric;
begin
  select real_balance into v_bal from public.profiles where id = auth.uid();
  if v_bal is null or v_bal < p_amount then
    return json_build_object('success', false, 'error', 'Insufficient balance');
  end if;
  update public.profiles set real_balance = real_balance - p_amount, updated_at = now() where id = auth.uid();
  insert into public.withdrawals (profile_id, amount) values (auth.uid(), p_amount);
  return json_build_object('success', true);
end;
$$;

-- Register payment order
create or replace function public.register_my_payment_order(p_order_id text, p_amount numeric)
returns json language plpgsql security definer
set search_path = public as $$
begin
  insert into public.payment_orders (profile_id, order_id, amount, status)
  values (auth.uid(), p_order_id, p_amount, 'pending')
  on conflict (order_id) do nothing;
  return json_build_object('success', true, 'order_id', p_order_id);
end;
$$;

-- Finalize PayBolt deposit (idempotent)
create or replace function public.finalize_my_paybolt_deposit(
  p_order_id text, p_amount numeric,
  p_utr text default null, p_method text default 'paybolt'
) returns json language plpgsql security definer
set search_path = public as $$
declare v_order record;
begin
  select * into v_order from public.payment_orders
  where order_id = p_order_id and profile_id = auth.uid() for update;
  if not found then
    insert into public.payment_orders (profile_id, order_id, amount, status)
    values (auth.uid(), p_order_id, p_amount, 'pending')
    returning * into v_order;
  end if;
  if v_order.status = 'completed' then
    return json_build_object('success', true, 'already_completed', true);
  end if;
  update public.profiles set real_balance = real_balance + p_amount, updated_at = now() where id = auth.uid();
  insert into public.deposits (profile_id, amount, method) values (auth.uid(), p_amount, p_method);
  update public.payment_orders set status = 'completed', utr = coalesce(p_utr, utr), completed_at = now() where id = v_order.id;
  return json_build_object('success', true);
end;
$$;

-- Webhook finalize (service role only)
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

-- Get account dashboard
create or replace function public.get_my_account_dashboard()
returns json language plpgsql security definer
set search_path = public as $$
declare
  v_profile record; v_settings record;
  v_deposits numeric; v_withdrawals numeric; v_tx_count int; v_trades_count int;
begin
  select * into v_profile from public.profiles where id = auth.uid();
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

-- Update user settings
create or replace function public.update_my_settings(
  p_confirm_trade boolean default null,
  p_one_click boolean default null,
  p_push_notifications boolean default null,
  p_default_mode text default null
) returns json language plpgsql security definer
set search_path = public as $$
declare v_settings record;
begin
  insert into public.user_settings (profile_id) values (auth.uid()) on conflict do nothing;
  update public.user_settings set
    confirm_trade = coalesce(p_confirm_trade, confirm_trade),
    one_click_trading = coalesce(p_one_click, one_click_trading),
    push_notifications = coalesce(p_push_notifications, push_notifications),
    default_account_mode = coalesce(p_default_mode, default_account_mode),
    updated_at = now()
  where profile_id = auth.uid() returning * into v_settings;
  return json_build_object('success', true,
    'confirm_trade', v_settings.confirm_trade, 'one_click_trading', v_settings.one_click_trading,
    'push_notifications', v_settings.push_notifications, 'default_account_mode', v_settings.default_account_mode);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════════════════

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_display_name(text) to authenticated;
grant execute on function public.update_my_balances(numeric, numeric) to authenticated;
grant execute on function public.insert_my_transaction(text, text, text, text, text) to authenticated;
grant execute on function public.get_my_transactions(int) to authenticated;
grant execute on function public.record_my_deposit(numeric, text) to authenticated;
grant execute on function public.record_my_withdrawal(numeric) to authenticated;
grant execute on function public.register_my_payment_order(text, numeric) to authenticated;
grant execute on function public.finalize_my_paybolt_deposit(text, numeric, text, text) to authenticated;
grant execute on function public.get_my_account_dashboard() to authenticated;
grant execute on function public.update_my_settings(boolean, boolean, boolean, text) to authenticated;
grant execute on function public.webhook_complete_paybolt_order(text, numeric, text, text, jsonb) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — users can only access their own data
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.trades enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;
alter table public.user_settings enable row level security;
alter table public.payment_orders enable row level security;

-- Profiles: users can read/update their own
create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Transactions: users can read/insert their own
create policy "Users can read own transactions" on public.transactions
  for select using (auth.uid() = profile_id);
create policy "Users can insert own transactions" on public.transactions
  for insert with check (auth.uid() = profile_id);

-- Trades: users can read/insert their own
create policy "Users can read own trades" on public.trades
  for select using (auth.uid() = profile_id);
create policy "Users can insert own trades" on public.trades
  for insert with check (auth.uid() = profile_id);
create policy "Users can update own trades" on public.trades
  for update using (auth.uid() = profile_id);

-- Deposits: users can read their own
create policy "Users can read own deposits" on public.deposits
  for select using (auth.uid() = profile_id);
create policy "Users can insert own deposits" on public.deposits
  for insert with check (auth.uid() = profile_id);

-- Withdrawals: users can read their own
create policy "Users can read own withdrawals" on public.withdrawals
  for select using (auth.uid() = profile_id);
create policy "Users can insert own withdrawals" on public.withdrawals
  for insert with check (auth.uid() = profile_id);

-- User settings: users can read/update their own
create policy "Users can read own settings" on public.user_settings
  for select using (auth.uid() = profile_id);
create policy "Users can insert own settings" on public.user_settings
  for insert with check (auth.uid() = profile_id);
create policy "Users can update own settings" on public.user_settings
  for update using (auth.uid() = profile_id);

-- Payment orders: users can read their own
create policy "Users can read own payment orders" on public.payment_orders
  for select using (auth.uid() = profile_id);
create policy "Users can insert own payment orders" on public.payment_orders
  for insert with check (auth.uid() = profile_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Cleanup old backup table (run manually after verifying)
-- ═══════════════════════════════════════════════════════════════════════════
-- drop table if exists public.profiles_backup;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! Ab Supabase Dashboard → Authentication → Providers → Google enable karo
-- ═══════════════════════════════════════════════════════════════════════════
