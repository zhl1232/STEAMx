-- ============================================
-- 修复所有 public 下 SECURITY DEFINER 函数的 search_path
-- 对应 Supabase Insights: Function Search Path Mutable (SECURITY)
-- 参考: docs/supabase-security-inventory.md
-- ============================================

DO $$
DECLARE
  r RECORD;
  alter_sql text;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    alter_sql := format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public',
      r.schema_name,
      r.func_name,
      r.args
    );
    BEGIN
      EXECUTE alter_sql;
      RAISE NOTICE 'Set search_path for %.%(%)', r.schema_name, r.func_name, r.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not alter %.%(%): %', r.schema_name, r.func_name, r.args, SQLERRM;
    END;
  END LOOP;
END $$;
