#!/usr/bin/env bash
set -euo pipefail
# Disposable local PostgreSQL only. No external URL, env file, ports or credentials.
container="steamx-growth-${RANDOM}-${RANDOM}"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$container" --network none -e POSTGRES_PASSWORD=isolated-test-only postgres:17-alpine >/dev/null
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
sql() { docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"; }
sql < tests/growth/schema.sql
sql < supabase/migrations/20260131100000_add_completion_interactions.sql
sql < tests/growth/fixture.sql
sql < supabase/migrations/20261026100000_reviewed_growth_rewards.sql
sql < tests/growth/assertions.sql
# Different content rows, same recipient: one daily exchange can win.
pids=()
for id in 101 102; do
  sql -c "SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; SELECT public.review_growth_reward('comment',$id,ARRAY['exchange'],md5(public.growth_evidence('comment',$id)::text),'specific new question');" >/dev/null &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
sql -c "DO \$\$ BEGIN IF (SELECT count(*) FROM growth_reward_reviews WHERE user_id='00000000-0000-0000-0000-000000000005' AND stage='exchange')<>1 THEN RAISE EXCEPTION 'concurrent daily quota'; END IF; END \$\$;"
# Independent records claiming the same source and stage award it once.
pids=()
for id in 201 202; do
  sql -c "SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; SELECT public.review_growth_reward('completion',$id,ARRAY['process'],md5(public.growth_evidence('completion',$id)::text),'actual first process');" >/dev/null &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
sql -c "DO \$\$ BEGIN IF (SELECT sum(xp) FROM growth_reward_reviews WHERE source_key='project:201')<>40 THEN RAISE EXCEPTION 'concurrent stage once'; END IF; END \$\$;"
# Simultaneous login calls preserve one day, three XP and two coins.
pids=()
for attempt in 1 2; do
  sql -c "SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000005'; SELECT public.daily_check_in();" >/dev/null &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
sql -c "DO \$\$ BEGIN IF (SELECT count(*) FROM xp_logs WHERE user_id='00000000-0000-0000-0000-000000000005' AND action_type='daily_login' AND xp_amount=3)<>1 OR (SELECT coins FROM profiles WHERE id='00000000-0000-0000-0000-000000000005')<>2 THEN RAISE EXCEPTION 'concurrent login once'; END IF; END \$\$;"
printf 'Growth SQL and concurrency checks passed.\n'
