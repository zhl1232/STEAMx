-- Durable request identity and topic generations. Apply after tutor_token_billing.
CREATE TABLE public.tutor_chat_scopes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type text NOT NULL CHECK (context_type IN ('global','challenge','project','observation','course','species')),
  context_id text NOT NULL DEFAULT '',
  epoch bigint NOT NULL DEFAULT 0 CHECK (epoch >= 0),
  PRIMARY KEY (user_id, context_type, context_id)
);
CREATE TABLE public.tutor_chat_requests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  request_hash text NOT NULL,
  executor_id uuid NOT NULL,
  context_type text NOT NULL,
  context_id text NOT NULL,
  epoch bigint NOT NULL,
  conversation_id uuid REFERENCES public.tutor_conversations(id) ON DELETE SET NULL,
  message_id bigint REFERENCES public.tutor_messages(id) ON DELETE SET NULL,
  receipt_id bigint NOT NULL,
  max_output_tokens int NOT NULL CHECK (max_output_tokens BETWEEN 1 AND 8192),
  state text NOT NULL DEFAULT 'processing' CHECK (state IN ('processing','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  PRIMARY KEY (user_id, request_id)
);
CREATE INDEX tutor_chat_requests_processing_scope ON public.tutor_chat_requests(user_id, context_type, context_id, epoch)
  WHERE state = 'processing';
CREATE INDEX tutor_chat_requests_conversation ON public.tutor_chat_requests(conversation_id);
CREATE INDEX tutor_chat_requests_message ON public.tutor_chat_requests(message_id);
ALTER TABLE public.tutor_chat_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_chat_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tutor_chat_scopes, public.tutor_chat_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tutor_chat_scopes, public.tutor_chat_requests TO service_role;
-- All writes now use service RPCs. Keep existing owner-only SELECT/RLS policies.
-- Direct client mutations would bypass request identity, topic epochs and locks.
REVOKE INSERT, UPDATE, DELETE ON public.tutor_conversations, public.tutor_messages FROM PUBLIC, anon, authenticated;

-- No second copy of message text: deleting history also makes replay unavailable.
CREATE FUNCTION public._tutor_request_result(r public.tutor_chat_requests)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('status', CASE WHEN r.state='completed' AND m.id IS NULL THEN 'unavailable' ELSE r.state END,
    'conversationId', r.conversation_id, 'message', CASE WHEN r.state='completed' THEN to_jsonb(m) ELSE NULL END)
  FROM (SELECT 1) AS base LEFT JOIN public.tutor_messages m ON m.id=r.message_id AND m.user_id=r.user_id
$$;

CREATE FUNCTION public.get_tutor_chat_session_service(p_user_id uuid, p_context_type text, p_context_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('epoch', COALESCE((SELECT epoch FROM public.tutor_chat_scopes
    WHERE user_id=p_user_id AND context_type=p_context_type AND context_id=p_context_id),0),
    'conversation', (SELECT to_jsonb(c) FROM public.tutor_conversations c WHERE c.user_id=p_user_id
      AND c.context_type=p_context_type AND c.context_id=p_context_id AND c.status='active' LIMIT 1))
$$;

CREATE FUNCTION public.archive_tutor_chat_service(p_user_id uuid, p_context_type text, p_context_id text, p_epoch bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_epoch bigint;
BEGIN
  IF p_user_id IS NULL OR p_epoch IS NULL OR p_epoch < 0 THEN RAISE EXCEPTION 'invalid_params'; END IF;
  -- Same user lock and lock order as all credit RPCs; never held during generation.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  INSERT INTO public.tutor_chat_scopes(user_id,context_type,context_id) VALUES(p_user_id,p_context_type,p_context_id)
    ON CONFLICT DO NOTHING;
  SELECT epoch INTO v_epoch FROM public.tutor_chat_scopes WHERE user_id=p_user_id AND context_type=p_context_type AND context_id=p_context_id;
  IF v_epoch <> p_epoch THEN RETURN jsonb_build_object('epoch',v_epoch); END IF;
  -- Empty conversations may already have a running generator attached to them.
  UPDATE public.tutor_conversations SET status='archived',archived_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE user_id=p_user_id AND context_type=p_context_type AND context_id=p_context_id AND status='active';
  UPDATE public.tutor_chat_scopes SET epoch=epoch+1 WHERE user_id=p_user_id AND context_type=p_context_type AND context_id=p_context_id
    RETURNING epoch INTO v_epoch;
  RETURN jsonb_build_object('epoch',v_epoch);
END;
$$;

CREATE FUNCTION public.begin_tutor_request_service(p_user_id uuid, p_request_id uuid, p_request_hash text,
  p_context_type text, p_context_id text, p_epoch bigint, p_max_output_tokens int, p_executor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.tutor_chat_requests%ROWTYPE; c public.tutor_conversations%ROWTYPE;
DECLARE v_epoch bigint; credit jsonb; expired record;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_executor_id IS NULL OR p_epoch IS NULL OR p_epoch<0 OR p_request_hash IS NULL
    OR p_request_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_params'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  -- Expired work can never be resumed under the same request ID, including a late executor.
  FOR expired IN SELECT * FROM public.tutor_chat_requests WHERE user_id=p_user_id AND state='processing'
    AND created_at <= clock_timestamp()-interval '20 minutes' FOR UPDATE LOOP
    credit := public.settle_tutor_credit_service(p_user_id,expired.receipt_id,NULL,true);
    IF (credit->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'release_failed'; END IF;
    UPDATE public.tutor_chat_requests SET state='failed',finished_at=clock_timestamp()
      WHERE user_id=p_user_id AND request_id=expired.request_id;
  END LOOP;
  SELECT * INTO r FROM public.tutor_chat_requests WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF r.request_hash <> p_request_hash THEN RETURN jsonb_build_object('status','conflict'); END IF;
    -- Only the same server invocation may recover a lost admission response.
    -- A separate HTTP retry has a different executor ID and must not generate.
    IF r.state='processing' AND r.executor_id=p_executor_id THEN
      SELECT * INTO c FROM public.tutor_conversations WHERE id=r.conversation_id AND user_id=p_user_id;
      IF FOUND THEN RETURN jsonb_build_object('status','started','conversation',to_jsonb(c),'receiptId',r.receipt_id,'maxOutputTokens',r.max_output_tokens); END IF;
    END IF;
    RETURN public._tutor_request_result(r);
  END IF;
  INSERT INTO public.tutor_chat_scopes(user_id,context_type,context_id) VALUES(p_user_id,p_context_type,p_context_id) ON CONFLICT DO NOTHING;
  SELECT epoch INTO v_epoch FROM public.tutor_chat_scopes WHERE user_id=p_user_id AND context_type=p_context_type AND context_id=p_context_id;
  IF v_epoch<>p_epoch THEN RETURN jsonb_build_object('status','stale_topic','epoch',v_epoch); END IF;
  IF EXISTS (SELECT 1 FROM public.tutor_chat_requests WHERE user_id=p_user_id AND context_type=p_context_type
    AND context_id=p_context_id AND epoch=p_epoch AND state='processing') THEN
    RETURN jsonb_build_object('status','busy');
  END IF;
  credit := public.reserve_tutor_credit_service(p_user_id,p_request_id,p_max_output_tokens);
  IF (credit->>'ok')::boolean IS DISTINCT FROM true THEN
    RETURN credit || jsonb_build_object('status','rejected');
  END IF;
  SELECT * INTO c FROM public.tutor_conversations WHERE user_id=p_user_id AND context_type=p_context_type AND context_id=p_context_id AND status='active';
  IF NOT FOUND THEN
    INSERT INTO public.tutor_conversations(user_id,context_type,context_id) VALUES(p_user_id,p_context_type,p_context_id) RETURNING * INTO c;
  END IF;
  INSERT INTO public.tutor_chat_requests(user_id,request_id,request_hash,executor_id,context_type,context_id,epoch,conversation_id,receipt_id,max_output_tokens)
    VALUES(p_user_id,p_request_id,p_request_hash,p_executor_id,p_context_type,p_context_id,p_epoch,c.id,(credit->>'receiptId')::bigint,(credit->>'maxOutputTokens')::int);
  RETURN credit || jsonb_build_object('status','started','conversation',to_jsonb(c));
END;
$$;

CREATE FUNCTION public.complete_tutor_request_service(p_user_id uuid, p_request_id uuid, p_user_content text,
  p_images text[], p_user_meta jsonb, p_reply text, p_assistant_meta jsonb, p_output_tokens int, p_clarification boolean, p_title text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.tutor_chat_requests%ROWTYPE; credit jsonb; v_message_id bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO r FROM public.tutor_chat_requests WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  IF r.state <> 'processing' THEN RETURN public._tutor_request_result(r); END IF;
  IF r.conversation_id IS NULL OR r.created_at <= clock_timestamp()-interval '20 minutes' THEN
    credit := public.settle_tutor_credit_service(p_user_id,r.receipt_id,NULL,true);
    IF (credit->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'release_failed'; END IF;
    UPDATE public.tutor_chat_requests SET state='failed',finished_at=clock_timestamp() WHERE user_id=p_user_id AND request_id=p_request_id RETURNING * INTO r;
    RETURN public._tutor_request_result(r);
  END IF;
  IF p_reply IS NULL OR btrim(p_reply)='' OR p_user_content IS NULL OR p_clarification IS NULL THEN RAISE EXCEPTION 'invalid_reply'; END IF;
  -- Lock against concurrent history deletion. Status is deliberately not changed:
  -- a generation begun before archive may finish only in its pinned old thread.
  PERFORM 1 FROM public.tutor_conversations WHERE id=r.conversation_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'conversation_missing'; END IF;
  INSERT INTO public.tutor_messages(conversation_id,user_id,context_type,context_id,role,content,images,meta)
    VALUES(r.conversation_id,p_user_id,r.context_type,r.context_id,'user',p_user_content,p_images,
      COALESCE(p_user_meta,'{}'::jsonb)||jsonb_build_object('requestId',p_request_id));
  INSERT INTO public.tutor_messages(conversation_id,user_id,context_type,context_id,role,content,meta)
    VALUES(r.conversation_id,p_user_id,r.context_type,r.context_id,'assistant',p_reply,
      COALESCE(p_assistant_meta,'{}'::jsonb)||jsonb_build_object('requestId',p_request_id,
        'ai',COALESCE(p_assistant_meta->'ai','{}'::jsonb)||jsonb_build_object('creditReceiptId',r.receipt_id))) RETURNING id INTO v_message_id;
  -- Message insert, credit settlement and terminal request state commit together.
  credit := public.settle_tutor_credit_service(p_user_id,r.receipt_id,p_output_tokens,p_clarification);
  IF (credit->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'settlement_failed'; END IF;
  UPDATE public.tutor_messages SET meta=meta||jsonb_build_object('billing',credit) WHERE id=v_message_id;
  UPDATE public.tutor_conversations SET updated_at=clock_timestamp(),title=COALESCE(NULLIF(left(p_title,120),''),title)
    WHERE id=r.conversation_id AND user_id=p_user_id;
  UPDATE public.tutor_chat_requests SET state='completed',message_id=v_message_id,finished_at=clock_timestamp()
    WHERE user_id=p_user_id AND request_id=p_request_id RETURNING * INTO r;
  RETURN public._tutor_request_result(r);
END;
$$;

CREATE FUNCTION public.fail_tutor_request_service(p_user_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.tutor_chat_requests%ROWTYPE; credit jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT * INTO r FROM public.tutor_chat_requests WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  IF r.state<>'processing' THEN RETURN public._tutor_request_result(r); END IF;
  credit := public.settle_tutor_credit_service(p_user_id,r.receipt_id,NULL,true);
  IF (credit->>'ok')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'release_failed'; END IF;
  UPDATE public.tutor_chat_requests SET state='failed',finished_at=clock_timestamp() WHERE user_id=p_user_id AND request_id=p_request_id RETURNING * INTO r;
  RETURN public._tutor_request_result(r);
END;
$$;

CREATE FUNCTION public.delete_tutor_conversation_service(p_user_id uuid, p_conversation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_status text; r record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  SELECT status INTO v_status FROM public.tutor_conversations WHERE id=p_conversation_id AND user_id=p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  IF v_status<>'archived' THEN RETURN jsonb_build_object('status','active'); END IF;
  FOR r IN SELECT request_id FROM public.tutor_chat_requests WHERE user_id=p_user_id AND conversation_id=p_conversation_id AND state='processing' LOOP
    PERFORM public.fail_tutor_request_service(p_user_id,r.request_id);
  END LOOP;
  DELETE FROM public.tutor_conversations WHERE id=p_conversation_id AND user_id=p_user_id;
  RETURN jsonb_build_object('status','deleted');
END;
$$;

REVOKE ALL ON FUNCTION public._tutor_request_result(public.tutor_chat_requests) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_tutor_chat_session_service(uuid,text,text), public.archive_tutor_chat_service(uuid,text,text,bigint),
  public.begin_tutor_request_service(uuid,uuid,text,text,text,bigint,int,uuid),
  public.complete_tutor_request_service(uuid,uuid,text,text[],jsonb,text,jsonb,int,boolean,text),
  public.fail_tutor_request_service(uuid,uuid), public.delete_tutor_conversation_service(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_tutor_chat_session_service(uuid,text,text), public.archive_tutor_chat_service(uuid,text,text,bigint),
  public.begin_tutor_request_service(uuid,uuid,text,text,text,bigint,int,uuid),
  public.complete_tutor_request_service(uuid,uuid,text,text[],jsonb,text,jsonb,int,boolean,text),
  public.fail_tutor_request_service(uuid,uuid), public.delete_tutor_conversation_service(uuid,uuid) TO service_role;
