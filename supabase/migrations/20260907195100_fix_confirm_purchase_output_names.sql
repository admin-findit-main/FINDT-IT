-- OUT parameters are PL/pgSQL variables. Qualify relationship counter columns
-- so they cannot be confused with the `points_balance` OUT parameter.

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.confirm_store_purchase(uuid,uuid,uuid,uuid,uuid,uuid,text,text)'::regprocedure
  )
  into function_definition;

  function_definition := replace(
    function_definition,
    'update public.store_customers set points_balance = points_balance + v_points, lifetime_points = lifetime_points + v_points, confirmed_purchases = confirmed_purchases + 1, last_seen_at = pg_catalog.now(), updated_at = pg_catalog.now()',
    'update public.store_customers as sc set points_balance = sc.points_balance + v_points, lifetime_points = sc.lifetime_points + v_points, confirmed_purchases = sc.confirmed_purchases + 1, last_seen_at = pg_catalog.now(), updated_at = pg_catalog.now()'
  );

  execute function_definition;
end;
$$;
