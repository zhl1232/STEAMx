-- Ensure PostgREST sees the online Gomoku RPC immediately after migration sync.
-- Without an explicit reload, the function can exist in pg_proc while /rest/v1/rpc
-- still serves a stale schema cache for a short period.

NOTIFY pgrst, 'reload schema';
