-- 扩展通用竞速房间支持的小游戏：24 点共享牌面、数字华容道共享初始棋盘。

ALTER TABLE public.playground_race_matches
  DROP CONSTRAINT IF EXISTS playground_race_matches_game_key_check;

ALTER TABLE public.playground_race_matches
  ADD CONSTRAINT playground_race_matches_game_key_check
  CHECK (game_key IN (
    'game24',
    'quickmath',
    'hanoi',
    'nqueens',
    'fifteen',
    'nonogram',
    'ballsort',
    'balance',
    'symmetry',
    'tangram'
  ));
