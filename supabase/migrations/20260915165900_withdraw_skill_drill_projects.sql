-- Withdraw the seven explicitly reviewed skill drills. Retain records for recovery.
BEGIN;
SET LOCAL statement_timeout = '60s';
SET LOCAL request.jwt.claim.role = 'service_role';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.projects WHERE
      (id,title) IN ((296,'水彩渐变天空'),(300,'球体明暗素描'),
      (302,'油画棒风景创作'),(321,'叶片针法刺绣'),(358,'坐标画图'),
      (373,'数字连线画'),(381,'幻方填数'))) <> 7 THEN
    RAISE EXCEPTION 'Withdrawal target mismatch';
  END IF;
  UPDATE public.projects SET status='draft', image_url=NULL, updated_at=now()
    WHERE id IN (296,300,302,321,358,373,381);
  UPDATE public.project_steps SET image_url=NULL
    WHERE project_id IN (296,300,302,321,358,373,381);
END $$;
COMMIT;
