-- The foundation migration schema-qualified COALESCE as if it were a regular
-- pg_catalog function. COALESCE is SQL syntax, so repair the installed
-- function while the original migration remains correct for fresh databases.

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
    'pg_catalog.coalesce(v_points, 0)',
    'coalesce(v_points, 0)'
  );
  function_definition := replace(
    function_definition,
    'pg_catalog.coalesce(v_value_cents, 0)',
    'coalesce(v_value_cents, 0)'
  );

  execute function_definition;
end;
$$;
