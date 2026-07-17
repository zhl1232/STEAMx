-- Function Wars online match state and atomic fire RPC.
--
-- MVP trust boundary:
--   The database serializes turns and validates a narrow client-reported collision
--   summary, but it does not recompute the mathematical trajectory. A modified
--   client can still claim a geometrically false hit within the enforced weapon,
--   damage, crater, and crate limits. This is intentionally not described as
--   server-authoritative trajectory simulation.
--
-- The client cannot replace hp/inventory/crates/craters snapshots. function_wars_fire
-- applies those transitions from the stored row while holding a row lock.

CREATE TABLE IF NOT EXISTS public.function_wars_matches (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE
                     CHECK (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  host_user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_user_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'waiting'
                     CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
  map_seed           integer NOT NULL CHECK (map_seed BETWEEN 0 AND 2147483647),
  map_id             text NOT NULL DEFAULT 'symmetric-canyon'
                     CHECK (map_id IN ('symmetric-canyon')),
  craters            jsonb NOT NULL DEFAULT '[]'::jsonb
                     CHECK (
                       jsonb_typeof(craters) = 'array'
                       AND jsonb_array_length(craters) <= 600
                     ),
  hp                 jsonb NOT NULL DEFAULT '{"host":100,"guest":100}'::jsonb
                     CHECK (
                       jsonb_typeof(hp) = 'object'
                       AND jsonb_typeof(hp -> 'host') = 'number'
                       AND jsonb_typeof(hp -> 'guest') = 'number'
                       AND (hp ->> 'host')::integer BETWEEN 0 AND 100
                       AND (hp ->> 'guest')::integer BETWEEN 0 AND 100
                     ),
  inventory          jsonb NOT NULL
                     CHECK (jsonb_typeof(inventory) = 'object'),
  crates             jsonb NOT NULL DEFAULT '[]'::jsonb
                     CHECK (jsonb_typeof(crates) = 'array'),
  repairs            jsonb NOT NULL DEFAULT '[]'::jsonb
                     CHECK (
                       jsonb_typeof(repairs) = 'array'
                       AND jsonb_array_length(repairs) <= 16
                     ),
  current_turn       text NOT NULL DEFAULT 'host'
                     CHECK (current_turn IN ('host', 'guest')),
  turn_deadline_at   timestamptz,
  last_shot          jsonb,
  shot_seq           integer NOT NULL DEFAULT 0 CHECK (shot_seq BETWEEN 0 AND 200),
  winner             text CHECK (winner IS NULL OR winner IN ('host', 'guest', 'draw')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  started_at         timestamptz,
  finished_at        timestamptz,
  last_activity_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'playing' OR turn_deadline_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_function_wars_matches_host
  ON public.function_wars_matches(host_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_function_wars_matches_guest
  ON public.function_wars_matches(guest_user_id, status, created_at DESC)
  WHERE guest_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_function_wars_matches_status_activity
  ON public.function_wars_matches(status, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_function_wars_matches_active_deadline
  ON public.function_wars_matches(turn_deadline_at)
  WHERE status = 'playing';
CREATE UNIQUE INDEX IF NOT EXISTS idx_function_wars_matches_one_waiting_host
  ON public.function_wars_matches(host_user_id)
  WHERE status = 'waiting';

ALTER TABLE public.function_wars_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "function_wars_matches_select" ON public.function_wars_matches;
CREATE POLICY "function_wars_matches_select"
ON public.function_wars_matches FOR SELECT
USING (
  (SELECT auth.uid()) = host_user_id
  OR (SELECT auth.uid()) = guest_user_id
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'moderator')
  )
);

-- Creation also goes through an authenticated API route with service role so a
-- browser cannot seed a room with forged hp, inventory, or crate snapshots.
DROP POLICY IF EXISTS "function_wars_matches_insert" ON public.function_wars_matches;
CREATE POLICY "function_wars_matches_insert"
ON public.function_wars_matches FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "function_wars_matches_update" ON public.function_wars_matches;
CREATE POLICY "function_wars_matches_update"
ON public.function_wars_matches FOR UPDATE
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "function_wars_matches_delete" ON public.function_wars_matches;
CREATE POLICY "function_wars_matches_delete"
ON public.function_wars_matches FOR DELETE
USING (false);

CREATE OR REPLACE FUNCTION public.touch_function_wars_match_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.last_activity_at := now();

  IF OLD.status = 'waiting' AND NEW.status = 'playing' THEN
    NEW.turn_deadline_at := now() + interval '60 seconds';
  ELSIF NEW.status <> 'playing' THEN
    NEW.turn_deadline_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_function_wars_matches_touch_activity
  ON public.function_wars_matches;
CREATE TRIGGER trg_function_wars_matches_touch_activity
BEFORE UPDATE ON public.function_wars_matches
FOR EACH ROW EXECUTE FUNCTION public.touch_function_wars_match_last_activity();

REVOKE ALL ON FUNCTION public.touch_function_wars_match_last_activity() FROM PUBLIC;

-- Advance one expired turn. The authoritative GET endpoint invokes this with a
-- service-role client before reading the row; the 4 second room polling fallback
-- therefore progresses timeouts even when Realtime is unavailable.
CREATE OR REPLACE FUNCTION public.function_wars_advance_expired_turn(match_uuid uuid)
RETURNS TABLE(advanced boolean, current_turn text, turn_deadline_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_role text;
BEGIN
  UPDATE public.function_wars_matches AS match
  SET current_turn = CASE WHEN match.current_turn = 'host' THEN 'guest' ELSE 'host' END,
      turn_deadline_at = now() + interval '60 seconds'
  WHERE match.id = match_uuid
    AND match.status = 'playing'
    AND match.turn_deadline_at <= now()
  RETURNING match.current_turn, match.turn_deadline_at
  INTO next_role, turn_deadline_at;

  IF FOUND THEN
    RETURN QUERY SELECT true, next_role, turn_deadline_at;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT false, match.current_turn, match.turn_deadline_at
  FROM public.function_wars_matches AS match
  WHERE match.id = match_uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.function_wars_advance_expired_turn(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.function_wars_advance_expired_turn(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.function_wars_advance_expired_turn(uuid) TO service_role;

-- Fire summary shape:
-- {
--   "damage": {"target":"guest","amount":50} | null,
--   "craters": [{"x":1.2,"y":-3.4,"radius":0.8}],
--   "picked_crate_ids": ["crate-0-host"]
-- }
-- Unknown fields are rejected. hp/inventory/crates/craters are derived below.
CREATE OR REPLACE FUNCTION public.function_wars_fire(
  match_uuid uuid,
  p_weapon text,
  p_expression text,
  p_summary jsonb
)
RETURNS TABLE(
  ok boolean,
  reason text,
  shot_seq integer,
  current_turn text,
  winner text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  m record;
  caller_id uuid := auth.uid();
  caller_role text;
  target_role text;
  next_role text;
  next_seq integer;
  clean_expression text;
  inventory_state jsonb;
  shooter_inventory jsonb;
  hp_state jsonb;
  crates_state jsonb;
  repairs_state jsonb;
  normalized_craters jsonb := '[]'::jsonb;
  picked_ids_json jsonb := '[]'::jsonb;
  damage_detail jsonb := NULL;
  last_shot_state jsonb;
  damage_obj jsonb;
  crater_input jsonb;
  crater_obj jsonb;
  pickup_input jsonb;
  pickup_value jsonb;
  crate_obj jsonb;
  crate_id text;
  crate_type text;
  reward_weapon text;
  picked_ids text[] := ARRAY[]::text[];
  crate_index integer;
  crater_index integer := 0;
  ammo_count integer;
  max_damage integer;
  max_craters integer;
  max_radius numeric;
  damage_numeric numeric;
  damage_amount integer := 0;
  applied_damage integer := 0;
  target_hp integer;
  new_target_hp integer;
  crater_x numeric;
  crater_y numeric;
  crater_radius numeric;
  blast_active boolean;
  penetration_active boolean;
  shield_active boolean := false;
  win text := NULL;
  found_crate boolean;
  repairs_count integer;
  repair_x numeric;
BEGIN
  SELECT match.* INTO m
  FROM public.function_wars_matches AS match
  WHERE match.id = match_uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'match_not_found'::text, NULL::integer, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF m.status <> 'playing' THEN
    RETURN QUERY SELECT false, 'match_not_playing'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  IF caller_id IS NULL THEN
    RETURN QUERY SELECT false, 'not_authenticated'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  IF caller_id = m.host_user_id THEN
    caller_role := 'host';
  ELSIF caller_id = m.guest_user_id THEN
    caller_role := 'guest';
  ELSE
    RETURN QUERY SELECT false, 'not_participant'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  IF m.current_turn <> caller_role THEN
    RETURN QUERY SELECT false, 'not_your_turn'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  next_role := CASE WHEN caller_role = 'host' THEN 'guest' ELSE 'host' END;

  IF m.turn_deadline_at IS NULL OR m.turn_deadline_at <= now() THEN
    UPDATE public.function_wars_matches
    SET current_turn = next_role,
        turn_deadline_at = now() + interval '60 seconds'
    WHERE id = match_uuid;
    RETURN QUERY SELECT false, 'turn_expired'::text, m.shot_seq, next_role, m.winner;
    RETURN;
  END IF;

  IF p_weapon IS NULL OR p_weapon NOT IN ('standard', 'heavy', 'drill', 'split', 'mirror') THEN
    RETURN QUERY SELECT false, 'invalid_weapon'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  clean_expression := btrim(p_expression);
  IF clean_expression IS NULL
     OR char_length(clean_expression) < 1
     OR char_length(clean_expression) > 256
     OR clean_expression !~ '^[0-9A-Za-z_+*/^().,[:space:]-]+$'
     OR regexp_replace(
          lower(clean_expression),
          '(round|sqrt|floor|ceil|sin|cos|tan|abs|log|exp|pi|e|x)',
          '',
          'g'
        ) ~ '[a-z_]'
  THEN
    RETURN QUERY SELECT false, 'invalid_expression'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  IF p_summary IS NULL
     OR jsonb_typeof(p_summary) <> 'object'
     OR octet_length(p_summary::text) > 16384
     OR (p_summary - ARRAY['damage', 'craters', 'picked_crate_ids']) <> '{}'::jsonb
  THEN
    RETURN QUERY SELECT false, 'invalid_summary'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  inventory_state := m.inventory;
  shooter_inventory := inventory_state -> caller_role;
  IF jsonb_typeof(shooter_inventory) <> 'object' THEN
    RETURN QUERY SELECT false, 'invalid_inventory_state'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  IF p_weapon <> 'standard' THEN
    IF jsonb_typeof(shooter_inventory -> p_weapon) <> 'number' THEN
      RETURN QUERY SELECT false, 'invalid_inventory_state'::text, m.shot_seq, m.current_turn, m.winner;
      RETURN;
    END IF;
    ammo_count := (shooter_inventory ->> p_weapon)::integer;
    IF ammo_count <= 0 THEN
      RETURN QUERY SELECT false, 'weapon_out_of_ammo'::text, m.shot_seq, m.current_turn, m.winner;
      RETURN;
    END IF;
    inventory_state := jsonb_set(
      inventory_state,
      ARRAY[caller_role, p_weapon],
      to_jsonb(ammo_count - 1),
      false
    );
  END IF;

  blast_active := COALESCE((shooter_inventory ->> 'blast_boost')::boolean, false);
  penetration_active := COALESCE((shooter_inventory ->> 'penetration')::boolean, false);
  IF blast_active THEN
    inventory_state := jsonb_set(
      inventory_state,
      ARRAY[caller_role, 'blast_boost'],
      'false'::jsonb,
      false
    );
  END IF;
  IF penetration_active THEN
    inventory_state := jsonb_set(
      inventory_state,
      ARRAY[caller_role, 'penetration'],
      'false'::jsonb,
      false
    );
  END IF;

  CASE p_weapon
    WHEN 'standard' THEN max_damage := 50; max_craters := 1; max_radius := 0.72;
    WHEN 'heavy' THEN max_damage := 70; max_craters := 1; max_radius := 1.30;
    WHEN 'drill' THEN max_damage := 50; max_craters := 1; max_radius := 0.82;
    WHEN 'split' THEN max_damage := 75; max_craters := 3; max_radius := 0.42;
    WHEN 'mirror' THEN max_damage := 80; max_craters := 2; max_radius := 0.68;
  END CASE;
  IF blast_active THEN max_radius := max_radius * 1.5; END IF;

  damage_obj := p_summary -> 'damage';
  IF damage_obj IS NOT NULL AND jsonb_typeof(damage_obj) <> 'null' THEN
    IF jsonb_typeof(damage_obj) <> 'object'
       OR (damage_obj - ARRAY['target', 'amount']) <> '{}'::jsonb
       OR jsonb_typeof(damage_obj -> 'target') <> 'string'
       OR jsonb_typeof(damage_obj -> 'amount') <> 'number'
    THEN
      RETURN QUERY SELECT false, 'invalid_damage'::text, m.shot_seq, m.current_turn, m.winner;
      RETURN;
    END IF;

    target_role := damage_obj ->> 'target';
    IF target_role <> next_role THEN
      RETURN QUERY SELECT false, 'invalid_damage_target'::text, m.shot_seq, m.current_turn, m.winner;
      RETURN;
    END IF;

    damage_numeric := (damage_obj ->> 'amount')::numeric;
    IF damage_numeric <> trunc(damage_numeric)
       OR damage_numeric <= 0
       OR damage_numeric > max_damage
    THEN
      RETURN QUERY SELECT false, 'damage_out_of_range'::text, m.shot_seq, m.current_turn, m.winner;
      RETURN;
    END IF;
    damage_amount := damage_numeric::integer;
  END IF;

  crater_input := COALESCE(p_summary -> 'craters', '[]'::jsonb);
  IF jsonb_typeof(crater_input) <> 'array'
     OR jsonb_array_length(crater_input) > max_craters
     OR jsonb_array_length(m.craters) + jsonb_array_length(crater_input) > 600
  THEN
    RETURN QUERY SELECT false, 'invalid_craters'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  FOR crater_obj IN SELECT value FROM jsonb_array_elements(crater_input)
  LOOP
    crater_index := crater_index + 1;
    IF jsonb_typeof(crater_obj) <> 'object'
       OR (crater_obj - ARRAY['x', 'y', 'radius']) <> '{}'::jsonb
       OR jsonb_typeof(crater_obj -> 'x') <> 'number'
       OR jsonb_typeof(crater_obj -> 'y') <> 'number'
       OR jsonb_typeof(crater_obj -> 'radius') <> 'number'
    THEN
      RETURN QUERY SELECT false, 'invalid_craters'::text, m.shot_seq, m.current_turn, m.winner;
      RETURN;
    END IF;

    crater_x := (crater_obj ->> 'x')::numeric;
    crater_y := (crater_obj ->> 'y')::numeric;
    crater_radius := (crater_obj ->> 'radius')::numeric;
    IF crater_x < -12 OR crater_x > 12
       OR crater_y < -7 OR crater_y > 7
       OR crater_radius <= 0 OR crater_radius > max_radius + 0.000001
    THEN
      RETURN QUERY SELECT false, 'crater_out_of_range'::text, m.shot_seq, m.current_turn, m.winner;
      RETURN;
    END IF;

    normalized_craters := normalized_craters || jsonb_build_array(jsonb_build_object(
      'id', match_uuid::text || '-' || (m.shot_seq + 1)::text || '-' || crater_index::text,
      'x', crater_x,
      'y', crater_y,
      'radius', crater_radius,
      'by', caller_role,
      'weapon', p_weapon,
      'shot_seq', m.shot_seq + 1
    ));
  END LOOP;

  pickup_input := COALESCE(p_summary -> 'picked_crate_ids', '[]'::jsonb);
  IF jsonb_typeof(pickup_input) <> 'array'
     OR jsonb_array_length(pickup_input) > 4
  THEN
    RETURN QUERY SELECT false, 'invalid_crate_pickups'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  crates_state := m.crates;
  IF jsonb_typeof(crates_state) <> 'array' THEN
    RETURN QUERY SELECT false, 'invalid_crate_state'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  repairs_state := m.repairs;
  IF jsonb_typeof(repairs_state) <> 'array'
     OR jsonb_array_length(repairs_state) > 16
  THEN
    RETURN QUERY SELECT false, 'invalid_repair_state'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  FOR pickup_value IN SELECT value FROM jsonb_array_elements(pickup_input)
  LOOP
    IF jsonb_typeof(pickup_value) <> 'string' THEN
      RETURN QUERY SELECT false, 'invalid_crate_pickups'::text, m.shot_seq, m.current_turn, m.winner;
      RETURN;
    END IF;
    crate_id := pickup_value #>> '{}';
    IF char_length(crate_id) > 80 OR crate_id = ANY(picked_ids) THEN
      RETURN QUERY SELECT false, 'invalid_crate_pickups'::text, m.shot_seq, m.current_turn, m.winner;
      RETURN;
    END IF;

    found_crate := false;
    FOR crate_index IN 0 .. jsonb_array_length(crates_state) - 1
    LOOP
      crate_obj := crates_state -> crate_index;
      IF crate_obj ->> 'id' = crate_id THEN
        found_crate := true;
        IF COALESCE(crate_obj ->> 'picked_by', '') <> ''
           OR COALESCE((crate_obj ->> 'spawn_shot')::integer, 2147483647) > m.shot_seq
        THEN
          RETURN QUERY SELECT false, 'crate_not_available'::text, m.shot_seq, m.current_turn, m.winner;
          RETURN;
        END IF;

        crate_type := crate_obj ->> 'type';
        IF crate_type NOT IN ('ammo', 'blast_boost', 'penetration', 'shield', 'repair') THEN
          RETURN QUERY SELECT false, 'invalid_crate_state'::text, m.shot_seq, m.current_turn, m.winner;
          RETURN;
        END IF;

        crates_state := jsonb_set(
          crates_state,
          ARRAY[crate_index::text, 'picked_by'],
          to_jsonb(caller_role),
          false
        );
        crates_state := jsonb_set(
          crates_state,
          ARRAY[crate_index::text, 'picked_seq'],
          to_jsonb(m.shot_seq + 1),
          false
        );

        IF crate_type = 'ammo' THEN
          reward_weapon := crate_obj ->> 'reward_weapon';
          IF reward_weapon NOT IN ('heavy', 'drill', 'split', 'mirror') THEN
            RETURN QUERY SELECT false, 'invalid_crate_state'::text, m.shot_seq, m.current_turn, m.winner;
            RETURN;
          END IF;
          ammo_count := COALESCE((inventory_state #>> ARRAY[caller_role, reward_weapon])::integer, 0);
          inventory_state := jsonb_set(
            inventory_state,
            ARRAY[caller_role, reward_weapon],
            to_jsonb(least(ammo_count + 1, 9)),
            false
          );
        ELSIF crate_type = 'blast_boost' THEN
          inventory_state := jsonb_set(
            inventory_state, ARRAY[caller_role, 'blast_boost'], 'true'::jsonb, false
          );
        ELSIF crate_type = 'penetration' THEN
          inventory_state := jsonb_set(
            inventory_state, ARRAY[caller_role, 'penetration'], 'true'::jsonb, false
          );
        ELSIF crate_type = 'shield' THEN
          inventory_state := jsonb_set(
            inventory_state, ARRAY[caller_role, 'shield'], 'true'::jsonb, false
          );
        ELSIF crate_type = 'repair' THEN
          repairs_count := jsonb_array_length(repairs_state);
          IF repairs_count >= 16 THEN
            RETURN QUERY SELECT false, 'repair_limit_reached'::text, m.shot_seq, m.current_turn, m.winner;
            RETURN;
          END IF;
          repair_x := CASE WHEN caller_role = 'host' THEN -8.55 ELSE 8.55 END;
          repairs_state := repairs_state || jsonb_build_array(jsonb_build_object(
            'id', match_uuid::text || '-repair-' || (m.shot_seq + 1)::text || '-' || crate_id,
            'shape', 'circle',
            'x', repair_x,
            'y', -5.15,
            'radius', 1.15,
            'destructible', true,
            'material', 'earth',
            'by', caller_role,
            'shot_seq', m.shot_seq + 1
          ));
        END IF;

        EXIT;
      END IF;
    END LOOP;

    IF NOT found_crate THEN
      RETURN QUERY SELECT false, 'crate_not_found'::text, m.shot_seq, m.current_turn, m.winner;
      RETURN;
    END IF;
    picked_ids := array_append(picked_ids, crate_id);
    picked_ids_json := picked_ids_json || to_jsonb(crate_id);
  END LOOP;

  hp_state := m.hp;
  IF damage_amount > 0 THEN
    shield_active := COALESCE((inventory_state #>> ARRAY[target_role, 'shield'])::boolean, false);
    applied_damage := damage_amount;
    IF shield_active THEN
      applied_damage := ceil(damage_amount / 2.0)::integer;
      inventory_state := jsonb_set(
        inventory_state, ARRAY[target_role, 'shield'], 'false'::jsonb, false
      );
    END IF;

    target_hp := COALESCE((hp_state ->> target_role)::integer, 100);
    new_target_hp := greatest(0, target_hp - applied_damage);
    hp_state := jsonb_set(
      hp_state, ARRAY[target_role], to_jsonb(new_target_hp), false
    );
    damage_detail := jsonb_build_object(
      'target', target_role,
      'claimed', damage_amount,
      'applied', applied_damage,
      'shielded', shield_active
    );
    IF new_target_hp = 0 THEN win := caller_role; END IF;
  END IF;

  next_seq := m.shot_seq + 1;
  IF win IS NULL AND next_seq >= 200 THEN
    win := 'draw';
  END IF;
  last_shot_state := jsonb_build_object(
    'seq', next_seq,
    'by', caller_role,
    'weapon', p_weapon,
    'expression', clean_expression,
    'damage', damage_detail,
    'craters', crater_input,
    'picked_crate_ids', picked_ids_json,
    'buffs_used', jsonb_build_object(
      'blast_boost', blast_active,
      'penetration', penetration_active
    ),
    'fired_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  UPDATE public.function_wars_matches
  SET craters = m.craters || normalized_craters,
      hp = hp_state,
      inventory = inventory_state,
      crates = crates_state,
      repairs = repairs_state,
      current_turn = next_role,
      last_shot = last_shot_state,
      shot_seq = next_seq,
      winner = win,
      status = CASE WHEN win IS NULL THEN 'playing' ELSE 'finished' END,
      finished_at = CASE WHEN win IS NULL THEN NULL ELSE now() END,
      turn_deadline_at = CASE
        WHEN win IS NULL THEN now() + interval '60 seconds'
        ELSE NULL
      END
  WHERE id = match_uuid;

  RETURN QUERY SELECT true, CASE
                               WHEN win IS NULL THEN 'ok'
                               WHEN win = 'draw' THEN 'draw'
                               ELSE 'win'
                             END,
                      next_seq, next_role, win;
END;
$$;

REVOKE ALL ON FUNCTION public.function_wars_fire(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.function_wars_fire(uuid, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.function_wars_fire(uuid, text, text, jsonb) TO authenticated;

COMMENT ON TABLE public.function_wars_matches IS
  'Function Wars turn-based online matches. Snapshot writes are limited to atomic RPC/API transitions.';
COMMENT ON FUNCTION public.function_wars_fire(uuid, text, text, jsonb) IS
  'Atomically validates turn/inventory and applies a bounded client-adjudicated collision summary; trajectory geometry is not recomputed by PostgreSQL.';
COMMENT ON FUNCTION public.function_wars_advance_expired_turn(uuid) IS
  'Advances one expired Function Wars turn; service-role only and called by the authoritative GET endpoint.';

NOTIFY pgrst, 'reload schema';
