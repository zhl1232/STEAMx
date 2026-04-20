DO $$
BEGIN
  UPDATE public.projects
  SET status = 'draft'
  WHERE (category, title) IN (
    ('工程', '纸板自动分拣机'),
    ('工程', '纸板自动贩卖机'),
    ('技术', '红外遥控小车'),
    ('技术', '行星齿轮组')
  );
END
$$;
