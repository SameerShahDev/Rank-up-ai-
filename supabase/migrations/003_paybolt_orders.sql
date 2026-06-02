-- PayBolt payment orders (webhook + idempotent deposit)

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

-- Register order when user starts PayBolt checkout
create or replace function public.register_payment_order(
  p_session_token uuid,
  p_order_id text,
  p_amount numeric
) returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid;
begin
  select id into v_pid from profiles where session_token = p_session_token;
  if v_pid is null then return json_build_object('success', false, 'error', 'Invalid session'); end if;

  insert into payment_orders (profile_id, order_id, amount, status)
  values (v_pid, p_order_id, p_amount, 'pending')
  on conflict (order_id) do nothing;

  return json_build_object('success', true, 'order_id', p_order_id);
end;
$$;

-- Idempotent finalize (app poll or after webhook — credits once)
create or replace function public.finalize_paybolt_deposit(
  p_session_token uuid,
  p_order_id text,
  p_amount numeric,
  p_utr text default null,
  p_method text default 'paybolt'
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid;
  v_order public.payment_orders%rowtype;
begin
  select id into v_pid from profiles where session_token = p_session_token;
  if v_pid is null then return json_build_object('success', false, 'error', 'Invalid session'); end if;

  select * into v_order from payment_orders
  where order_id = p_order_id and profile_id = v_pid
  for update;

  if not found then
    insert into payment_orders (profile_id, order_id, amount, status)
    values (v_pid, p_order_id, p_amount, 'pending')
    returning * into v_order;
  end if;

  if v_order.status = 'completed' then
    return json_build_object('success', true, 'already_completed', true);
  end if;

  update profiles
  set real_balance = real_balance + p_amount, updated_at = now()
  where id = v_pid;

  insert into deposits (profile_id, amount, method) values (v_pid, p_amount, p_method);

  update payment_orders
  set status = 'completed', utr = coalesce(p_utr, utr), completed_at = now()
  where id = v_order.id;

  return json_build_object('success', true);
end;
$$;

-- Called by Supabase Edge Function webhook (service role only)
create or replace function public.webhook_complete_paybolt_order(
  p_order_id text,
  p_amount numeric default null,
  p_utr text default null,
  p_status text default null,
  p_payload jsonb default null
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_order public.payment_orders%rowtype;
  v_amt numeric;
  v_st text;
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

  select * into v_order from payment_orders where order_id = p_order_id for update;
  if not found then
    return json_build_object('success', false, 'error', 'Unknown order_id');
  end if;

  if v_order.status = 'completed' then
    return json_build_object('success', true, 'already_completed', true);
  end if;

  v_amt := coalesce(p_amount, v_order.amount);

  update profiles
  set real_balance = real_balance + v_amt, updated_at = now()
  where id = v_order.profile_id;

  insert into deposits (profile_id, amount, method)
  values (v_order.profile_id, v_amt, 'paybolt');

  update payment_orders
  set status = 'completed',
      amount = v_amt,
      utr = coalesce(p_utr, utr),
      webhook_payload = coalesce(p_payload, webhook_payload),
      completed_at = now()
  where id = v_order.id;

  return json_build_object('success', true, 'order_id', p_order_id);
end;
$$;

grant execute on function public.register_payment_order(uuid, text, numeric) to anon, authenticated;
grant execute on function public.finalize_paybolt_deposit(uuid, text, numeric, text, text) to anon, authenticated;
grant execute on function public.webhook_complete_paybolt_order(text, numeric, text, text, jsonb) to service_role;

alter table public.payment_orders enable row level security;
create policy "deny anon payment_orders" on public.payment_orders for all to anon using (false);
