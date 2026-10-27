-- Retire ball sort, pixel symmetry and tangram. Apply only as an approved
-- migration batch via pnpm db:push; the runner supplies the transaction.
-- Running this migration in production needs the user's explicit approval.
-- Preserve unrelated game stats, cross-game honors, XP and all old migrations.

CREATE OR REPLACE FUNCTION public.remove_retired_playground_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF jsonb_typeof(NEW.stats) = 'object' THEN
    NEW.stats := NEW.stats - ARRAY[
      'game_2048_stats', 'fifteen_puzzle_stats', 'quick_math_stats',
      'ball_sort_stats', 'symmetry_stats', 'tangram_stats'
    ]::text[];
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_retired_playground_stats() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_remove_retired_playground_stats ON public.playground_stats;
CREATE TRIGGER trg_remove_retired_playground_stats
BEFORE INSERT OR UPDATE OF stats ON public.playground_stats
FOR EACH ROW EXECUTE FUNCTION public.remove_retired_playground_stats();

UPDATE public.playground_stats
SET stats = stats - ARRAY[
  'ball_sort_stats', 'symmetry_stats', 'tangram_stats'
]::text[]
WHERE jsonb_typeof(stats) = 'object'
  AND stats ?| ARRAY[
    'ball_sort_stats', 'symmetry_stats', 'tangram_stats'
  ]::text[];

-- Enforce the reduced catalog on new writes before removing old rooms.
-- NOT VALID allows the existing retired rooms to be deleted within this transaction.
ALTER TABLE public.playground_race_matches
  DROP CONSTRAINT IF EXISTS playground_race_matches_game_key_check;
ALTER TABLE public.playground_race_matches
  ADD CONSTRAINT playground_race_matches_game_key_check
  CHECK (game_key IN (
    'game24', 'hanoi', 'nqueens', 'nonogram', 'balance'
  )) NOT VALID;

DELETE FROM public.playground_race_matches
WHERE game_key IN ('ballsort', 'symmetry', 'tangram');

ALTER TABLE public.playground_race_matches
  VALIDATE CONSTRAINT playground_race_matches_game_key_check;

DELETE FROM public.user_badges
WHERE badge_id IN ('tangram_all');

DELETE FROM public.badges
WHERE id IN ('tangram_all');

-- All-games exploration remains attainable with the reduced catalog (12 games).
UPDATE public.badges
SET description = '玩过 12 个不同游乐场游戏'
WHERE id = 'playground_explorer_platinum';
