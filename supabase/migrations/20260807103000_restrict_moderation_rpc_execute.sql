-- CREATE OR REPLACE preserves explicit grants on legacy functions. Remove the
-- old anonymous grants from moderation actions after repairing their bodies.

REVOKE ALL ON FUNCTION public.approve_project(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_project(bigint) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reject_project(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_project(bigint, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reject_completion(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_completion(bigint, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.log_moderator_action(text, text, bigint, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_moderator_action(text, text, bigint, text, jsonb) TO authenticated, service_role;
