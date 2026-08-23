-- V2A2: Efficient read-only operational analytics for trusted admin services.

create or replace function public.get_admin_dashboard_metrics(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with order_window as (
    select orders.id, orders.status, orders.created_at
    from public.orders
    where (p_from is null or orders.created_at >= p_from)
      and (p_to is null or orders.created_at < p_to)
  ),
  order_summary as (
    select
      count(*) as total_orders,
      count(*) filter (where status = 'AWAITING_PAYMENT') as awaiting_payment,
      count(*) filter (where status = 'PENDING') as pending,
      count(*) filter (where status = 'PREPARING') as preparing,
      count(*) filter (where status = 'READY_FOR_PICKUP') as ready_for_pickup,
      count(*) filter (where status = 'COMPLETED') as completed,
      count(*) filter (where status = 'CANCELLED') as cancelled
    from order_window
  ),
  payment_state_window as (
    select
      payments.order_id,
      payments.method,
      payments.status,
      payments.amount_minor,
      orders.status as order_status
    from public.payments
    join public.orders on orders.id = payments.order_id
    where (p_from is null or payments.created_at >= p_from)
      and (p_to is null or payments.created_at < p_to)
  ),
  paid_payment_window as (
    select payments.order_id, payments.method, payments.amount_minor, payments.paid_at
    from public.payments
    where payments.status = 'PAID'
      and (p_from is null or payments.paid_at >= p_from)
      and (p_to is null or payments.paid_at < p_to)
  ),
  payment_summary as (
    select
      (select count(*) from paid_payment_window) as paid_order_count,
      (select coalesce(sum(amount_minor), 0) from paid_payment_window) as paid_revenue_minor,
      (select coalesce(sum(amount_minor), 0) from paid_payment_window where method = 'CASH') as cash_paid_minor,
      (select coalesce(sum(amount_minor), 0) from paid_payment_window where method = 'MOBILE_MONEY') as mobile_money_paid_minor,
      (select coalesce(sum(amount_minor), 0) from paid_payment_window where method = 'CARD') as card_paid_minor,
      coalesce(sum(amount_minor) filter (
        where method = 'CASH' and status = 'UNPAID' and order_status <> 'CANCELLED'
      ), 0) as cash_unpaid_minor,
      count(*) filter (
        where method = 'CASH' and status = 'UNPAID' and order_status <> 'CANCELLED'
      ) as cash_unpaid_count,
      count(*) filter (
        where method in ('MOBILE_MONEY', 'CARD') and status = 'PENDING'
      ) as pending_electronic_count,
      count(*) filter (
        where method in ('MOBILE_MONEY', 'CARD') and status = 'FAILED'
      ) as failed_electronic_count
    from payment_state_window
  ),
  order_daily as (
    select created_at::date as day, count(*) as order_count
    from order_window
    group by created_at::date
    order by day
  ),
  revenue_daily as (
    select paid_at::date as day, sum(amount_minor) as revenue_minor
    from paid_payment_window
    group by paid_at::date
    order by day
  ),
  top_item_rows as (
    select
      order_items.item_name_snapshot as item_name,
      sum(order_items.quantity) as quantity,
      sum(order_items.line_total_minor_snapshot) as revenue_minor
    from public.order_items
    join order_window on order_window.id = order_items.order_id
    join public.payments on payments.order_id = order_items.order_id
    where order_window.status = 'COMPLETED'
      and payments.status = 'PAID'
    group by order_items.item_name_snapshot
    order by quantity desc, revenue_minor desc, item_name
    limit 10
  )
  select jsonb_build_object(
    'total_orders', order_summary.total_orders,
    'order_status_counts', jsonb_build_object(
      'AWAITING_PAYMENT', order_summary.awaiting_payment,
      'PENDING', order_summary.pending,
      'PREPARING', order_summary.preparing,
      'READY_FOR_PICKUP', order_summary.ready_for_pickup,
      'COMPLETED', order_summary.completed,
      'CANCELLED', order_summary.cancelled
    ),
    'paid_order_count', payment_summary.paid_order_count,
    'paid_revenue_minor', payment_summary.paid_revenue_minor,
    'revenue_by_payment_method_minor', jsonb_build_object(
      'CASH', payment_summary.cash_paid_minor,
      'MOBILE_MONEY', payment_summary.mobile_money_paid_minor,
      'CARD', payment_summary.card_paid_minor
    ),
    'unpaid_cash_value_minor', payment_summary.cash_unpaid_minor,
    'average_paid_order_value_minor', case
      when payment_summary.paid_order_count = 0 then 0
      else round(
        payment_summary.paid_revenue_minor::numeric
        / payment_summary.paid_order_count
      )::bigint
    end,
    'payment_summary', jsonb_build_object(
      'cash_paid_minor', payment_summary.cash_paid_minor,
      'cash_unpaid_minor', payment_summary.cash_unpaid_minor,
      'cash_unpaid_count', payment_summary.cash_unpaid_count,
      'mobile_money_paid_minor', payment_summary.mobile_money_paid_minor,
      'card_paid_minor', payment_summary.card_paid_minor,
      'pending_electronic_count', payment_summary.pending_electronic_count,
      'failed_electronic_count', payment_summary.failed_electronic_count
    ),
    'order_count_by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'count', order_count) order by day)
      from order_daily
    ), '[]'::jsonb),
    'revenue_by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'revenue_minor', revenue_minor) order by day)
      from revenue_daily
    ), '[]'::jsonb),
    'top_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_name', item_name,
        'quantity', quantity,
        'revenue_minor', revenue_minor
      ) order by quantity desc, revenue_minor desc, item_name)
      from top_item_rows
    ), '[]'::jsonb)
  )
  from order_summary
  cross join payment_summary;
$$;

comment on function public.get_admin_dashboard_metrics(timestamptz, timestamptz) is
  'Trusted operational metrics. Orders use created_at; revenue uses paid_at; refunded payments are excluded.';

revoke all on function public.get_admin_dashboard_metrics(timestamptz, timestamptz) from public;
revoke all on function public.get_admin_dashboard_metrics(timestamptz, timestamptz) from anon, authenticated;
grant execute on function public.get_admin_dashboard_metrics(timestamptz, timestamptz) to service_role;
