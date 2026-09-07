-- Bound the growth of store_checkin_tokens.
--
-- The Hub rotates its check-in QR every 45 seconds and writes a row per token,
-- and nothing ever deleted them. A single tablet had accumulated 4,631 rows in
-- three days (~1,772/day), of which exactly 2 were ever redeemed. Ten stores
-- running a tablet each works out to roughly 17,700 rows/day, or ~3.5 GB/year
-- of rows that serve no purpose once they expire.
--
-- Rotation itself is a security property, so the fix is expiry, not a slower
-- QR. A stateless signed token would remove the writes altogether, but that
-- changes how replay is detected on the check-in path and is not worth
-- attempting while that path is mid-fix.

create extension if not exists pg_cron;

-- Partial indexes matching the two sweep predicates below. Unredeemed tokens
-- are ~99.96% of the table, so keeping the redeemed branch out of the first
-- index keeps it small.
create index if not exists store_checkin_tokens_expired_idx
  on public.store_checkin_tokens (expires_at)
  where used_at is null;

create index if not exists store_checkin_tokens_redeemed_idx
  on public.store_checkin_tokens (used_at)
  where used_at is not null;

-- One-time catch-up for everything already accumulated.
--
-- Redeemed tokens are kept for 30 days because disputeVerifiedVisitAction lets
-- a store contest a visit, and the token is the evidence that a scan happened.
delete from public.store_checkin_tokens
where (used_at is null and expires_at < now() - interval '1 hour')
   or (used_at is not null and used_at < now() - interval '30 days');

-- Hourly sweep, at :17 to avoid the top-of-hour crowd.
--
-- Scheduled as `postgres`, which holds BYPASSRLS. That matters: this table has
-- RLS enabled with no policies and FORCE ROW LEVEL SECURITY on, so a role
-- without BYPASSRLS would delete zero rows and report success.
--
-- The delete is capped per run so it cannot hold locks or generate WAL without
-- bound if the job has been paused; the hourly cadence catches up over time.
select cron.schedule(
  'purge-expired-checkin-tokens',
  '17 * * * *',
  $job$
    with doomed as (
      select id
      from public.store_checkin_tokens
      where (used_at is null and expires_at < now() - interval '1 hour')
         or (used_at is not null and used_at < now() - interval '30 days')
      limit 20000
    )
    delete from public.store_checkin_tokens t
    using doomed d
    where t.id = d.id;
  $job$
);

comment on table public.store_checkin_tokens is
  'Rotating Hub check-in tokens. Swept hourly by the purge-expired-checkin-tokens cron job: unredeemed tokens are dropped 1 hour past expiry, redeemed ones after 30 days so visit disputes can still be investigated.';
