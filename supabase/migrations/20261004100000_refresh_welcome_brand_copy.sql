-- Refresh the default in-app welcome message to the 2026-10 brand copy
-- (tagline「兴趣是最好的老师。在真实项目中动手探索，学会拆解问题、持续迭代。」,
-- positioning「少儿 STEAM 项目式学习平台」). Must match DEFAULT_WELCOME_SETTINGS.body
-- in lib/communications/types.ts.
--
-- Only touches content that still equals the original default inserted by
-- 20260922120000_platform_communications.sql; admin-customized text is kept.
-- Idempotent: re-running finds no matching row / default and changes nothing.

UPDATE public.platform_welcome_settings
SET body = '兴趣是最好的老师。在真实项目中动手探索，学会拆解问题、持续迭代。创探空间是少儿 STEAM 项目式学习平台：你可以探索积木搭建、Scratch 编程、科学实验、自然观察、PBL 挑战和游乐场，遇到问题随时联系我们。'
WHERE body = '从兴趣出发，在动手中成长。你可以探索积木搭建、Scratch 编程、科学实验、自然观察、项目式学习和游乐场挑战，遇到问题随时联系我们。';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid = 'public.platform_welcome_settings'::regclass
      AND a.attname = 'body'
      AND pg_get_expr(d.adbin, d.adrelid) = quote_literal('从兴趣出发，在动手中成长。你可以探索积木搭建、Scratch 编程、科学实验、自然观察、项目式学习和游乐场挑战，遇到问题随时联系我们。') || '::text'
  ) THEN
    ALTER TABLE public.platform_welcome_settings
      ALTER COLUMN body SET DEFAULT '兴趣是最好的老师。在真实项目中动手探索，学会拆解问题、持续迭代。创探空间是少儿 STEAM 项目式学习平台：你可以探索积木搭建、Scratch 编程、科学实验、自然观察、PBL 挑战和游乐场，遇到问题随时联系我们。';
  END IF;
END $$;
