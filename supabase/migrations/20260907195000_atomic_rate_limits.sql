-- Make abuse limits correct under concurrent requests. The previous
-- read-then-upsert implementation could lose increments when two requests
-- arrived together.

create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_ms integer
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.rate_limit_buckets%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_window interval;
begin
  if p_bucket_key is null
     or char_length(p_bucket_key) < 3
     or char_length(p_bucket_key) > 500
     or p_limit < 1
     or p_window_ms < 1000 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  v_window := pg_catalog.make_interval(secs => p_window_ms::numeric / 1000);

  insert into public.rate_limit_buckets (
    bucket_key,
    hit_count,
    window_started_at
  )
  values (p_bucket_key, 1, v_now)
  on conflict (bucket_key)
  do update set
    hit_count = case
      when public.rate_limit_buckets.window_started_at + v_window <= v_now
        then 1
      else public.rate_limit_buckets.hit_count + 1
    end,
    window_started_at = case
      when public.rate_limit_buckets.window_started_at + v_window <= v_now
        then v_now
      else public.rate_limit_buckets.window_started_at
    end
  returning * into v_row;

  return query
    select
      v_row.hit_count <= p_limit,
      case
        when v_row.hit_count <= p_limit then 0
        else pg_catalog.greatest(
          1,
          pg_catalog.ceil(
            extract(epoch from (v_row.window_started_at + v_window - v_now))
          )::integer
        )
      end;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;

comment on function public.consume_rate_limit(text, integer, integer) is
  'Service-role-only atomic fixed-window rate limiter.';

-- One row per identity/bucket would otherwise remain forever.
select cron.unschedule(jobid)
from cron.job
where jobname = 'purge-expired-rate-limit-buckets';

select cron.schedule(
  'purge-expired-rate-limit-buckets',
  '17 3 * * *',
  $$delete from public.rate_limit_buckets
    where window_started_at < now() - interval '2 days'$$
);
