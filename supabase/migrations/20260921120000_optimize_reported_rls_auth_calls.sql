BEGIN;

-- Keep this helper temporary: policy expressions are read from pg_policies and
-- altered in place, so removed policies are naturally skipped and reruns are
-- harmless.  The scanner deliberately leaves quoted strings/identifiers and
-- comments untouched, and recognizes calls already under SELECT.
CREATE OR REPLACE FUNCTION pg_temp.optimize_rls_auth_calls(input text)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  i integer := 1;
  n integer := coalesce(length(input), 0);
  ch text;
  next_ch text;
  token text;
  output text := '';
  call_name text;
  call_length integer;
  previous text;
  quote_char text;
  is_escape_string boolean;
BEGIN
  IF input IS NULL THEN
    RETURN NULL;
  END IF;

  WHILE i <= n LOOP
    ch := substr(input, i, 1);
    next_ch := substr(input, i + 1, 1);

    -- SQL string and quoted identifier literals.  Doubled delimiters and
    -- backslash escapes are copied as part of the literal.
    IF ch IN ('''', '"') THEN
      quote_char := ch;
      is_escape_string := quote_char = '''' AND i > 1 AND substr(input, i - 1, 1) IN ('E', 'e');
      output := output || ch;
      i := i + 1;
      WHILE i <= n LOOP
        ch := substr(input, i, 1);
        output := output || ch;
        IF is_escape_string AND ch = E'\\' AND i < n THEN
          output := output || substr(input, i + 1, 1);
          i := i + 2;
        ELSIF ch = quote_char AND substr(input, i + 1, 1) = ch THEN
          output := output || ch;
          i := i + 2;
        ELSIF ch = quote_char THEN
          i := i + 1;
          EXIT;
        ELSE
          i := i + 1;
        END IF;
      END LOOP;
      CONTINUE;
    END IF;

    -- SQL comments are opaque to the tokenizer.
    IF ch = '-' AND next_ch = '-' THEN
      token := substr(input, i, coalesce(nullif(strpos(substr(input, i), E'\n'), 0), n - i + 1));
      output := output || token;
      i := i + length(token);
      CONTINUE;
    ELSIF ch = '/' AND next_ch = '*' THEN
      token := substr(input, i, coalesce(nullif(strpos(substr(input, i + 2), '*/'), 0) + 3, n - i + 1));
      output := output || token;
      i := i + length(token);
      CONTINUE;
    END IF;

    call_name := NULL;
    FOREACH token IN ARRAY ARRAY['auth.uid()', 'auth.jwt()', 'auth.role()', 'auth.email()'] LOOP
      IF lower(substr(input, i, length(token))) = token
         AND (i = 1 OR substr(input, i - 1, 1) !~ '[[:alnum:]_$\.]') THEN
        call_name := token;
        call_length := length(token);
        EXIT;
      END IF;
    END LOOP;

    IF call_name IS NOT NULL THEN
      previous := right(output, 32);
      IF previous ~* '(^|[^[:alnum:]_])select[[:space:]]*$' THEN
        output := output || substr(input, i, call_length);
      ELSE
        output := output || '(SELECT ' || call_name || ')';
      END IF;
      i := i + call_length;
    ELSE
      output := output || ch;
      i := i + 1;
    END IF;
  END LOOP;

  RETURN output;
END;
$function$;

DO $migration$
DECLARE
  policy_row record;
  new_using text;
  new_check text;
  alter_sql text;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND (
        (tablename = 'project_journeys' AND policyname IN (
          'project_journeys_owner_insert', 'project_journeys_owner_update',
          'project_journeys_owner_delete', 'project_journeys_owner_or_staff'
        ))
        OR (tablename = 'project_journey_records' AND policyname IN (
          'project_journey_records_owner_or_public', 'project_journey_records_owner_update',
          'project_journey_records_owner_delete'
        ))
        OR (tablename = 'messages' AND policyname = 'Users can mark received messages read')
        OR (tablename = 'ai_credit_logs' AND policyname = 'ai_credit_logs_select_own')
        OR (tablename = 'ai_credit_wallets' AND policyname = 'ai_credit_wallets_select_own')
        OR (tablename = 'challenge_stage_progress' AND policyname IN (
          'challenge_stage_progress_select', 'challenge_stage_progress_insert',
          'challenge_stage_progress_update', 'challenge_stage_progress_delete'
        ))
        OR (tablename = 'gomoku_matches' AND policyname IN (
          'gomoku_matches_select', 'gomoku_matches_insert',
          'gomoku_matches_update', 'gomoku_matches_delete'
        ))
        OR (tablename = 'course_lessons' AND policyname IN (
          'course_lessons_admin_delete', 'course_lessons_admin_insert',
          'course_lessons_admin_update', 'course_lessons_select'
        ))
        OR (tablename = 'courses' AND policyname IN (
          'courses_admin_delete', 'courses_admin_insert',
          'courses_admin_update', 'courses_select_approved'
        ))
        OR (tablename = 'learning_resources' AND policyname IN (
          'learning_resources_admin_delete', 'learning_resources_admin_insert',
          'learning_resources_admin_update', 'learning_resources_select'
        ))
        OR (tablename = 'tutor_conversations' AND policyname IN (
          'tutor_conversations_insert', 'tutor_conversations_update', 'tutor_conversations_select'
        ))
        OR (tablename = 'tutor_messages' AND policyname IN (
          'tutor_messages_delete', 'tutor_messages_insert', 'tutor_messages_select'
        ))
        OR (tablename = 'tutor_notebooks' AND policyname = 'tutor_notebooks_select_own')
        OR (tablename = 'user_lesson_progress' AND policyname = 'user_lesson_progress_select')
        OR (tablename = 'playground_stats' AND policyname = 'Users can delete own playground stats')
        OR (tablename = 'user_course_completions' AND policyname = 'user_course_completions_select')
        OR (tablename = 'challenge_submissions' AND policyname = 'challenge_submissions_delete')
      )
  LOOP
    new_using := pg_temp.optimize_rls_auth_calls(policy_row.qual);
    new_check := pg_temp.optimize_rls_auth_calls(policy_row.with_check);

    IF new_using IS DISTINCT FROM policy_row.qual
       OR new_check IS DISTINCT FROM policy_row.with_check THEN
      alter_sql := format(
        'ALTER POLICY %I ON %I.%I%s%s',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        CASE WHEN new_using IS NOT NULL THEN format(' USING (%s)', new_using) ELSE '' END,
        CASE WHEN new_check IS NOT NULL THEN format(' WITH CHECK (%s)', new_check) ELSE '' END
      );
      EXECUTE alter_sql;
    END IF;
  END LOOP;
END;
$migration$;

DROP FUNCTION pg_temp.optimize_rls_auth_calls(text);

COMMIT;
