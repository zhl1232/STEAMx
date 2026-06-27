-- Fix gomoku_place_stone JSONB path lookups.
-- jsonb #> expects text[] paths; array[p_row] is inferred as integer[] and
-- fails at runtime with "operator does not exist: jsonb #> integer[]".

CREATE OR REPLACE FUNCTION public.gomoku_place_stone(match_uuid uuid, p_row int, p_col int)
RETURNS TABLE(ok boolean, reason text, board jsonb, current_turn text, winner text, win_line jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  caller_id uuid := auth.uid();
  caller_color text;
  board_arr jsonb;
  cell_value text;
  next_turn text;
  mv jsonb;
  line jsonb;
  found_win jsonb;
  i int;
  dr int;
  dc int;
  r int;
  c int;
  cnt int;
  line_arr jsonb;
  total_cells int;
  dirs_dr int[] := ARRAY[0,1,1,1];
  dirs_dc int[] := ARRAY[1,0,1,-1];
BEGIN
  SELECT * INTO m FROM public.gomoku_matches WHERE id = match_uuid FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'match_not_found'::text, NULL::jsonb, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;

  IF m.status <> 'playing' THEN
    RETURN QUERY SELECT false, 'match_not_playing'::text, m.board, m.current_turn, m.winner, m.win_line;
    RETURN;
  END IF;

  IF caller_id IS NULL THEN
    RETURN QUERY SELECT false, 'not_authenticated'::text, m.board, m.current_turn, m.winner, m.win_line;
    RETURN;
  END IF;

  IF caller_id = m.host_user_id THEN
    caller_color := m.host_color;
  ELSIF caller_id = m.guest_user_id THEN
    caller_color := CASE WHEN m.host_color = 'black' THEN 'white' ELSE 'black' END;
  ELSE
    RETURN QUERY SELECT false, 'not_participant'::text, m.board, m.current_turn, m.winner, m.win_line;
    RETURN;
  END IF;

  IF m.current_turn <> caller_color THEN
    RETURN QUERY SELECT false, 'not_your_turn'::text, m.board, m.current_turn, m.winner, m.win_line;
    RETURN;
  END IF;

  IF p_row < 0 OR p_row > 14 OR p_col < 0 OR p_col > 14 THEN
    RETURN QUERY SELECT false, 'out_of_bounds'::text, m.board, m.current_turn, m.winner, m.win_line;
    RETURN;
  END IF;

  cell_value := m.board#>ARRAY[p_row::text, p_col::text]#>>'{value}';
  IF cell_value IS NOT NULL AND cell_value <> 'null' THEN
    RETURN QUERY SELECT false, 'cell_occupied'::text, m.board, m.current_turn, m.winner, m.win_line;
    RETURN;
  END IF;

  board_arr := jsonb_set(
    m.board,
    ARRAY[p_row::text, p_col::text, 'value'],
    to_jsonb(caller_color),
    true
  );

  next_turn := CASE WHEN m.current_turn = 'black' THEN 'white' ELSE 'black' END;

  found_win := NULL;
  line := NULL;
  FOR i IN 1..4 LOOP
    dr := dirs_dr[i];
    dc := dirs_dc[i];

    line_arr := jsonb_build_array(jsonb_build_object('row', p_row, 'col', p_col));
    r := p_row + dr; c := p_col + dc; cnt := 1;
    WHILE r >= 0 AND r <= 14 AND c >= 0 AND c <= 14
      AND (board_arr#>ARRAY[r::text, c::text]#>>'{value}') = caller_color
    LOOP
      line_arr := line_arr || jsonb_build_array(jsonb_build_object('row', r, 'col', c));
      cnt := cnt + 1;
      r := r + dr; c := c + dc;
    END LOOP;

    r := p_row - dr; c := p_col - dc;
    WHILE r >= 0 AND r <= 14 AND c >= 0 AND c <= 14
      AND (board_arr#>ARRAY[r::text, c::text]#>>'{value}') = caller_color
    LOOP
      line_arr := jsonb_build_array(jsonb_build_object('row', r, 'col', c)) || line_arr;
      cnt := cnt + 1;
      r := r - dr; c := c - dc;
    END LOOP;

    IF cnt >= 5 THEN
      found_win := to_jsonb(caller_color);
      line := line_arr;
      EXIT;
    END IF;
  END LOOP;

  mv := jsonb_build_object(
    'row', p_row, 'col', p_col,
    'player', caller_color,
    'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  IF found_win IS NOT NULL THEN
    UPDATE public.gomoku_matches
      SET board = board_arr,
          current_turn = next_turn,
          moves = m.moves || jsonb_build_array(mv),
          winner = caller_color,
          win_line = line,
          status = 'finished',
          finished_at = now()
      WHERE id = match_uuid;
    RETURN QUERY SELECT true, 'win'::text, board_arr, next_turn, caller_color, line;
    RETURN;
  END IF;

  SELECT count(*) INTO total_cells
  FROM jsonb_array_elements(board_arr) AS br,
       jsonb_array_elements(br.value) AS cell_obj
  WHERE (cell_obj#>>'{value}') IS NOT NULL AND (cell_obj#>>'{value}') <> 'null';

  IF total_cells >= 225 THEN
    UPDATE public.gomoku_matches
      SET board = board_arr,
          current_turn = next_turn,
          moves = m.moves || jsonb_build_array(mv),
          winner = 'draw',
          status = 'finished',
          finished_at = now()
      WHERE id = match_uuid;
    RETURN QUERY SELECT true, 'draw'::text, board_arr, next_turn, 'draw'::text, NULL::jsonb;
    RETURN;
  END IF;

  UPDATE public.gomoku_matches
    SET board = board_arr,
        current_turn = next_turn,
        moves = m.moves || jsonb_build_array(mv)
    WHERE id = match_uuid;

  RETURN QUERY SELECT true, 'ok'::text, board_arr, next_turn, NULL::text, NULL::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gomoku_place_stone(uuid, int, int) TO authenticated;

COMMENT ON FUNCTION public.gomoku_place_stone(uuid, int, int) IS '五子棋服务端权威落子，单条 UPDATE 内完成校验+落子+胜负判定+轮次切换；JSONB 路径使用 text[]。';

NOTIFY pgrst, 'reload schema';
