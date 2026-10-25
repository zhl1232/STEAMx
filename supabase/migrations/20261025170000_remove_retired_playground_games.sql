-- Retire 2048, Fifteen Puzzle and Quick Math. Apply only as an approved
-- migration batch via pnpm db:push; the runner supplies the transaction.
-- Preserve unrelated game stats, cross-game honors, XP and all old migrations.

CREATE OR REPLACE FUNCTION public.remove_retired_playground_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF jsonb_typeof(NEW.stats) = 'object' THEN
    NEW.stats := NEW.stats - ARRAY[
      'game_2048_stats', 'fifteen_puzzle_stats', 'quick_math_stats'
    ]::text[];
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_retired_playground_stats() FROM PUBLIC, anon, authenticated;

-- Independent of the existing Function Wars authority trigger: do not replace it.
DROP TRIGGER IF EXISTS trg_remove_retired_playground_stats ON public.playground_stats;
CREATE TRIGGER trg_remove_retired_playground_stats
BEFORE INSERT OR UPDATE OF stats ON public.playground_stats
FOR EACH ROW EXECUTE FUNCTION public.remove_retired_playground_stats();

UPDATE public.playground_stats
SET stats = stats - ARRAY['game_2048_stats', 'fifteen_puzzle_stats', 'quick_math_stats']::text[]
WHERE jsonb_typeof(stats) = 'object'
  AND stats ?| ARRAY['game_2048_stats', 'fifteen_puzzle_stats', 'quick_math_stats']::text[];

-- Enforce the reduced catalog on new writes before removing old rooms.
-- NOT VALID allows the existing retired rooms to be deleted within this transaction.
ALTER TABLE public.playground_race_matches
  DROP CONSTRAINT IF EXISTS playground_race_matches_game_key_check;
ALTER TABLE public.playground_race_matches
  ADD CONSTRAINT playground_race_matches_game_key_check
  CHECK (game_key IN (
    'game24', 'hanoi', 'nqueens', 'nonogram',
    'ballsort', 'balance', 'symmetry', 'tangram'
  )) NOT VALID;

DELETE FROM public.playground_race_matches
WHERE game_key IN ('quickmath', 'fifteen');

ALTER TABLE public.playground_race_matches
  VALIDATE CONSTRAINT playground_race_matches_game_key_check;

DELETE FROM public.user_badges
WHERE badge_id IN (
  'game2048_first_win', 'game2048_4096', 'game2048_8192', 'game2048_high_scorer',
  'fifteen_first', 'fifteen_master', 'quick_math_first', 'quick_math_combo'
);

DELETE FROM public.badges
WHERE id IN (
  'game2048_first_win', 'game2048_4096', 'game2048_8192', 'game2048_high_scorer',
  'fifteen_first', 'fifteen_master', 'quick_math_first', 'quick_math_combo'
);

-- All-games exploration remains attainable with the reduced catalog.
UPDATE public.badges
SET description = '玩过 15 个不同游乐场游戏'
WHERE id = 'playground_explorer_platinum';
