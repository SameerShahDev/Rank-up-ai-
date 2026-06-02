-- Email + password auth (run after 001_schema.sql + 003_paybolt_orders.sql)
-- Adds email/password columns, drops phone OTP system, creates new auth RPCs

-- ─── 0. Ensure pgcrypto is available for password hashing ─────────────────
create extension if not exists "pgcrypto" with schema public;

-- ─── 1. Add email + password_hash to profiles ─────────────────────────────
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists password_hash text;

-- Backfill: copy phone as email for existing users
update public.profiles set email = phone || '@cryptox.app' where email is null;

-- Make email NOT NULL after backfill
alter table public.profiles alter column email set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_email_unique' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_email_unique unique (email);
  end if;
end $$;

-- ─── 2. Drop old OTP functions ────────────────────────────────────────────
drop function if exists public.request_phone_otp(text);
drop function if exists public.verify_phone_otp(text, text);
drop function if exists public.normalize_phone(text);

-- ─── 3. Drop old RPCs that return phone (will be recreated with email) ─────
drop function if exists public.get_profile_by_session(uuid);
drop function if exists public.get_account_dashboard(uuid);

-- ─── 4. Create new auth functions ─────────────────────────────────────────
create or replace function public.register_user(p_email text, p_password text)
returns json language plpgsql security definer set search_path = 'public, extensions' as $$
declare
  v_profile profiles%rowtype;
begin
  if length(p_email) < 3 or p_email !~ '@' then
    return json_build_object('success', false, 'error', 'Enter a valid email address');
  end if;
  if length(p_password) < 6 then
    return json_build_object('success', false, 'error', 'Password must be at least 6 characters');
  end if;

  insert into profiles (email, password_hash)
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

create or replace function public.login_user(p_email text, p_password text)
returns json language plpgsql security definer set search_path = 'public, extensions' as $$
declare
  v_profile profiles%rowtype;
begin
  select * into v_profile from profiles where email = lower(trim(p_email));
  if not found then
    return json_build_object('success', false, 'error', 'Invalid email or password');
  end if;
  if v_profile.password_hash != crypt(p_password, v_profile.password_hash) then
    return json_build_object('success', false, 'error', 'Invalid email or password');
  end if;

  update profiles set session_token = gen_random_uuid(), updated_at = now()
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

-- ─── 5. Recreate RPCs with email instead of phone ─────────────────────────
create or replace function public.get_profile_by_session(p_session_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_profile profiles%rowtype;
begin
  select * into v_profile from profiles where session_token = p_session_token;
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

-- ─── 6. Update grants ─────────────────────────────────────────────────────
grant execute on function public.register_user(text, text) to anon, authenticated;
grant execute on function public.login_user(text, text) to anon, authenticated;
grant execute on function public.get_profile_by_session(uuid) to anon, authenticated;
grant execute on function public.get_account_dashboard(uuid) to anon, authenticated;

-- ─── 7. Clean up OTP table ───────────────────────────────────────────────
drop table if exists public.phone_otps;
