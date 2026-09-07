-- `current_user` inside a SECURITY DEFINER trigger is the function owner,
-- which made the authenticated-client guard unreachable. Run as the invoking
-- database role so authenticated writes are blocked while trusted service-role
-- maintenance remains allowed.

alter function public.protect_profile_locked_fields() security invoker;
