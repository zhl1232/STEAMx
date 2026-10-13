-- Keep this aligned with DEFAULT_WELCOME_SETTINGS and PLATFORM_SUPPORT_HREF.
-- Exact legacy defaults only: preserve custom copy, enabled/title/activated_after,
-- existing delivered messages, read state, ledger and all platform announcements.
-- No re-delivery, trigger replacement or auth changes. Safe to re-run.

UPDATE public.platform_welcome_settings
SET body = '和孩子选一件想做的事，一起动手试试。'
WHERE id = true AND body IN (
  '从兴趣出发，在动手中成长。你可以探索积木搭建、Scratch 编程、科学实验、自然观察、项目式学习和游乐场挑战，遇到问题随时联系我们。',
  '兴趣是最好的老师。在真实项目中动手探索，学会拆解问题、持续迭代。创探空间是少儿 STEAM 项目式学习平台：你可以探索积木搭建、Scratch 编程、科学实验、自然观察、PBL 挑战和游乐场，遇到问题随时联系我们。'
);

UPDATE public.platform_welcome_settings
SET contact_href = '/about#support'
WHERE id = true AND contact_href IN ('/about#contact', '/settings/about#contact');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid = 'public.platform_welcome_settings'::regclass
      AND a.attname = 'body'
      AND pg_get_expr(d.adbin, d.adrelid) IN (
        quote_literal('从兴趣出发，在动手中成长。你可以探索积木搭建、Scratch 编程、科学实验、自然观察、项目式学习和游乐场挑战，遇到问题随时联系我们。') || '::text',
        quote_literal('兴趣是最好的老师。在真实项目中动手探索，学会拆解问题、持续迭代。创探空间是少儿 STEAM 项目式学习平台：你可以探索积木搭建、Scratch 编程、科学实验、自然观察、PBL 挑战和游乐场，遇到问题随时联系我们。') || '::text'
      )
  ) THEN
    ALTER TABLE public.platform_welcome_settings
      ALTER COLUMN body SET DEFAULT '和孩子选一件想做的事，一起动手试试。';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid = 'public.platform_welcome_settings'::regclass
      AND a.attname = 'contact_href'
      AND pg_get_expr(d.adbin, d.adrelid) IN (
        quote_literal('/about#contact') || '::text',
        quote_literal('/settings/about#contact') || '::text'
      )
  ) THEN
    ALTER TABLE public.platform_welcome_settings
      ALTER COLUMN contact_href SET DEFAULT '/about#support';
  END IF;
END $$;
