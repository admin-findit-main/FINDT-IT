-- The Hub can identify an existing shopper by their authenticated account
-- email when SMS verification is unavailable. The server action performs the
-- exact email lookup and this function remains callable only by trusted server
-- roles, so this widens eligibility without exposing a public lookup RPC.
do $$
declare
  function_oid oid;
  definition text;
  old_guard text :=
    '(p_source = ''request'' or (p.phone_e164 is not null and p.phone_verified = true))';
  new_guard text :=
    '(p_source = ''request'' or p.email is not null or (p.phone_e164 is not null and p.phone_verified = true))';
begin
  select p.oid
  into function_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'confirm_store_purchase'
  limit 1;

  if function_oid is null then
    raise exception 'public.confirm_store_purchase was not found';
  end if;

  definition := pg_get_functiondef(function_oid);
  if position(old_guard in definition) = 0 then
    raise exception 'confirm_store_purchase eligibility guard did not match';
  end if;

  execute replace(definition, old_guard, new_guard);
end;
$$;
