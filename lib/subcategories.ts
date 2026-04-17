import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

type CategoryRow = Database['public']['Tables']['categories']['Row']
type SubCategoryRow = Database['public']['Tables']['sub_categories']['Row']

export async function resolveSubCategoryId(
  supabase: SupabaseClient<Database>,
  category: string,
  subCategoryId?: number | null,
  subCategoryName?: string,
): Promise<number | null> {
  const { data: categoryRow, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('name', category)
    .maybeSingle()

  if (categoryError) {
    throw categoryError
  }

  if (!categoryRow) {
    throw new Error(`Unknown category: ${category}`)
  }

  const categoryId = (categoryRow as CategoryRow).id
  const trimmedName = subCategoryName?.trim()

  if (typeof subCategoryId === 'number' && Number.isInteger(subCategoryId) && subCategoryId > 0) {
    const { data: subCategoryRow, error: subCategoryError } = await supabase
      .from('sub_categories')
      .select('id, category_id, name')
      .eq('id', subCategoryId)
      .maybeSingle()

    if (subCategoryError) {
      throw subCategoryError
    }

    if (!subCategoryRow) {
      throw new Error(`Unknown sub category id: ${subCategoryId}`)
    }

    const typedSubCategory = subCategoryRow as Pick<SubCategoryRow, 'id' | 'category_id' | 'name'>
    if (typedSubCategory.category_id !== categoryId) {
      throw new Error(`Sub category ${subCategoryId} does not belong to category ${category}`)
    }
    if (trimmedName && typedSubCategory.name !== trimmedName) {
      throw new Error(`Sub category ${subCategoryId} does not match name ${trimmedName}`)
    }

    return typedSubCategory.id
  }

  if (!trimmedName) {
    return null
  }

  const { data: subCategoryRow, error: subCategoryError } = await supabase
    .from('sub_categories')
    .select('id')
    .eq('category_id', categoryId)
    .eq('name', trimmedName)
    .maybeSingle()

  if (subCategoryError) {
    throw subCategoryError
  }

  if (!subCategoryRow) {
    throw new Error(`Unknown sub category: ${trimmedName}`)
  }

  return (subCategoryRow as Pick<SubCategoryRow, 'id'>).id
}

export async function getSubCategoryNameById(
  supabase: SupabaseClient<Database>,
  subCategoryId?: number | null,
): Promise<string | null> {
  if (typeof subCategoryId !== 'number' || !Number.isInteger(subCategoryId) || subCategoryId <= 0) {
    return null
  }

  const { data, error } = await supabase
    .from('sub_categories')
    .select('name')
    .eq('id', subCategoryId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as Pick<SubCategoryRow, 'name'> | null)?.name ?? null
}
