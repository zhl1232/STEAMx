BEGIN;

-- Advisor function_search_path_mutable: all application objects in these
-- function bodies are already schema-qualified. Builtins remain available
-- through PostgreSQL's implicit pg_catalog lookup with an empty search_path.
-- ALTER preserves bodies, owners, SECURITY DEFINER/INVOKER and existing ACLs.
-- Use exact signatures so unrelated overloads are not changed.
ALTER FUNCTION public.get_shop_item_price(text) SET search_path = '';
ALTER FUNCTION public.purchase_item(text) SET search_path = '';
ALTER FUNCTION public.enforce_project_journey_transition() SET search_path = '';
ALTER FUNCTION public.protect_profiles_sensitive_fields() SET search_path = '';
ALTER FUNCTION public.get_shop_item_min_level(text) SET search_path = '';
ALTER FUNCTION public.equip_avatar_frame(text) SET search_path = '';
ALTER FUNCTION public.user_owns_project_journey(bigint, uuid) SET search_path = '';
ALTER FUNCTION public.enforce_project_journey_record_write() SET search_path = '';
ALTER FUNCTION public.mark_store_order_paid(uuid, text, text) SET search_path = '';
ALTER FUNCTION public.create_store_order(uuid, text, uuid, text, integer, integer, integer, jsonb) SET search_path = '';
ALTER FUNCTION public.set_store_updated_at() SET search_path = '';
ALTER FUNCTION public.count_ai_free_chats_today(uuid) SET search_path = '';
ALTER FUNCTION public._release_expired_tutor_holds(uuid) SET search_path = '';
ALTER FUNCTION public.admin_adjust_ai_credit(uuid, integer, text) SET search_path = '';
ALTER FUNCTION public.reserve_tutor_credit_service(uuid, uuid, integer) SET search_path = '';
ALTER FUNCTION public.settle_tutor_credit_service(uuid, bigint, integer, boolean) SET search_path = '';
ALTER FUNCTION public.consume_ai_credit_service(uuid, integer) SET search_path = '';
ALTER FUNCTION public.refund_ai_credit_service(uuid, integer, text, bigint) SET search_path = '';
ALTER FUNCTION public.get_ai_credit_status(boolean, integer, integer) SET search_path = '';

COMMIT;
