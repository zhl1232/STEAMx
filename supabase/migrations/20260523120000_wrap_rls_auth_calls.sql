-- Wrap auth.<fn>() calls inside RLS policies with (select auth.<fn>())
-- to stop per-row re-evaluation. Addresses ~110 auth_rls_initplan warnings
-- reported by Supabase Performance Advisor (lint 0003).
--
-- The body introspects pg_policies because most policy SQL was lost when
-- early migrations were squashed. It is idempotent: re-running is a no-op.

DO $do$
DECLARE
  pol record;
  pat_bare    constant text := 'auth\.(uid|jwt|role|email)\(\s*\)';
  pat_wrapped constant text := '\(\s*select\s+auth\.(uid|jwt|role|email)\s*\(\s*\)\s*\)';
  q_new      text;
  c_new      text;
  roles_list text;
  drop_s     text;
  make_s     text;
  rewrote int := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual       IS NOT NULL AND qual       ~* pat_bare)
        OR
        (with_check IS NOT NULL AND with_check ~* pat_bare)
      )
  LOOP
    -- Skip if every bare occurrence is already inside (select ...)
    IF  (pol.qual       IS NULL OR regexp_replace(pol.qual,       pat_wrapped, '', 'gi') !~* pat_bare)
    AND (pol.with_check IS NULL OR regexp_replace(pol.with_check, pat_wrapped, '', 'gi') !~* pat_bare)
    THEN
      CONTINUE;
    END IF;

    -- Rewrite qual
    q_new := pol.qual;
    IF q_new IS NOT NULL THEN
      q_new := regexp_replace(q_new, pat_wrapped, '@@W_\1@@', 'gi');
      q_new := regexp_replace(q_new, pat_bare,    '(select auth.\1())', 'g');
      q_new := regexp_replace(q_new, '@@W_(uid|jwt|role|email)@@', '(select auth.\1())', 'g');
    END IF;

    -- Rewrite with_check
    c_new := pol.with_check;
    IF c_new IS NOT NULL THEN
      c_new := regexp_replace(c_new, pat_wrapped, '@@W_\1@@', 'gi');
      c_new := regexp_replace(c_new, pat_bare,    '(select auth.\1())', 'g');
      c_new := regexp_replace(c_new, '@@W_(uid|jwt|role|email)@@', '(select auth.\1())', 'g');
    END IF;

    -- Roles -> "anon, authenticated, ..." quoted
    SELECT string_agg(quote_ident(r), ', ')
      INTO roles_list
      FROM unnest(pol.roles) AS r;

    drop_s := format('DROP POLICY %I ON %I.%I',
                     pol.policyname, pol.schemaname, pol.tablename);

    make_s := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
                     pol.policyname, pol.schemaname, pol.tablename,
                     pol.permissive, pol.cmd, roles_list);

    IF q_new IS NOT NULL THEN
      make_s := make_s || format(' USING (%s)', q_new);
    END IF;
    IF c_new IS NOT NULL THEN
      make_s := make_s || format(' WITH CHECK (%s)', c_new);
    END IF;

    RAISE NOTICE 'rewriting %.%: %', pol.schemaname, pol.tablename, pol.policyname;
    EXECUTE drop_s;
    EXECUTE make_s;
    rewrote := rewrote + 1;
  END LOOP;

  RAISE NOTICE 'wrap_rls_auth_calls: % policies rewritten', rewrote;
END
$do$;
