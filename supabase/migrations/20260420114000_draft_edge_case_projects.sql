DO $$
BEGIN
  UPDATE public.projects
  SET status = 'draft'
  WHERE (category, title) IN (
    ('工程', '纸板弹珠机'),
    ('工程', '生态系统微缩模型'),
    ('艺术', '连环画创作'),
    ('艺术', '多材料组合雕塑')
  );
END
$$;
