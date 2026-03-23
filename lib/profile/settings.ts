import { z } from 'zod'

import { DEFAULT_AVATAR_PATHS, isDefaultAvatarPath } from '@/lib/profile/avatar-options'

export const PROFILE_GENDER_OPTIONS = ['男', '女', '其他', '不愿透露'] as const
const CURRENT_YEAR = new Date().getFullYear()

export const PROFILE_BIRTH_YEAR_OPTIONS = Array.from(
  { length: 98 },
  (_, index) => String(CURRENT_YEAR - 3 - index),
)

const avatarUrlSchema = z
  .string()
  .trim()
  .min(1, '请选择头像')
  .max(500, '头像地址无效')

export const ProfileSettingsUpdateSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(1, '昵称不能为空')
      .max(30, '昵称不能超过 30 个字符'),
    bio: z
      .string()
      .trim()
      .max(30, '简介不能超过 30 个字符')
      .default(''),
    gender: z.enum(PROFILE_GENDER_OPTIONS).nullable(),
    birth_year: z
      .string()
      .regex(/^\d{4}$/, '出生年份无效')
      .refine((value) => PROFILE_BIRTH_YEAR_OPTIONS.includes(value), '出生年份无效')
      .nullable(),
    birth_month: z.string().regex(/^(?:[1-9]|1[0-2])$/, '出生月份无效').nullable(),
    avatar_url: avatarUrlSchema,
  })
  .superRefine((value, ctx) => {
    const hasBirthYear = Boolean(value.birth_year)
    const hasBirthMonth = Boolean(value.birth_month)

    if (hasBirthYear !== hasBirthMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasBirthYear ? ['birth_month'] : ['birth_year'],
        message: '出生年月需要同时选择',
      })
    }
  })

export type ProfileSettingsUpdateInput = z.infer<typeof ProfileSettingsUpdateSchema>

export const PROFILE_SETTINGS_DEFAULTS: ProfileSettingsUpdateInput = {
  display_name: '',
  bio: '',
  gender: null,
  birth_year: null,
  birth_month: null,
  avatar_url: DEFAULT_AVATAR_PATHS[0],
}

export function toBirthDate(
  birthYear: string | null,
  birthMonth: string | null,
) {
  if (!birthYear || !birthMonth) return null
  return `${birthYear}-${birthMonth.padStart(2, '0')}-01`
}

export function splitBirthDate(birthDate: string | null) {
  if (!birthDate) {
    return { birthYear: null, birthMonth: null }
  }

  const [birthYear, birthMonth] = birthDate.split('-')
  if (!birthYear || !birthMonth) {
    return { birthYear: null, birthMonth: null }
  }

  return {
    birthYear,
    birthMonth: String(Number(birthMonth)),
  }
}

export function isOwnedAvatarUrl(avatarUrl: string, userId: string) {
  if (isDefaultAvatarPath(avatarUrl)) {
    return true
  }

  let pathname = avatarUrl
  if (!avatarUrl.startsWith('/')) {
    try {
      pathname = new URL(avatarUrl).pathname
    } catch {
      return false
    }
  }

  const prefix = '/storage/v1/object/public/avatars/'
  if (!pathname.startsWith(prefix)) {
    return false
  }

  const segments = pathname
    .slice(prefix.length)
    .split('/')
    .filter(Boolean)

  return segments.length >= 2 && segments.includes(userId)
}
