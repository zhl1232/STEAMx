/**
 * 分类数据 API
 * 从数据库获取分类和子分类
 */

import { createClient } from "@/lib/supabase/client"

export interface Category {
    id: number
    name: string
    icon: string | null
    sort_order: number
}

export interface SubCategory {
    id: number
    category_id: number
    name: string
    sort_order: number
}

export interface CategoryWithSubs extends Category {
    sub_categories: SubCategory[]
}

/**
 * 获取所有主分类
 */
export async function getCategories(): Promise<Category[]> {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order')

    if (error) {
        console.error('Error fetching categories:', error)
        return []
    }

    return (data as Category[]) || []
}

/**
 * 获取指定分类下的子分类
 */
export async function getSubCategories(categoryId: number): Promise<SubCategory[]> {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('sub_categories')
        .select('*')
        .eq('category_id', categoryId)
        .order('sort_order')

    if (error) {
        console.error('Error fetching sub categories:', error)
        return []
    }

    return (data as SubCategory[]) || []
}

/**
 * 获取所有分类及其子分类（嵌套结构）
 */
export async function getCategoriesWithSubs(): Promise<CategoryWithSubs[]> {
    const supabase = createClient()

    // 获取所有分类
    const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order')

    if (catError || !categories) {
        console.error('Error fetching categories:', catError)
        return []
    }

    // 获取所有子分类
    const { data: subCategories, error: subError } = await supabase
        .from('sub_categories')
        .select('*')
        .order('sort_order')

    if (subError || !subCategories) {
        console.error('Error fetching sub categories:', subError)
        return (categories as Category[]).map(c => ({ ...c, sub_categories: [] }))
    }

    // 组合成嵌套结构
    return (categories as Category[]).map(category => ({
        ...category,
        sub_categories: (subCategories as SubCategory[]).filter(sub => sub.category_id === category.id)
    }))
}

/**
 * 根据子分类ID获取分类信息
 */
export async function getCategoryBySubId(subCategoryId: number): Promise<{
    category: Category | null
    subCategory: SubCategory | null
}> {
    const supabase = createClient()

    const { data: subCategory, error: subError } = await supabase
        .from('sub_categories')
        .select('*, categories(*)')
        .eq('id', subCategoryId)
        .single()

    if (subError || !subCategory) {
        return { category: null, subCategory: null }
    }

    return {
        category: (subCategory as unknown as { categories: Category }).categories,
        subCategory: {
            id: (subCategory as unknown as SubCategory).id,
            category_id: (subCategory as unknown as SubCategory).category_id,
            name: (subCategory as unknown as SubCategory).name,
            sort_order: (subCategory as unknown as SubCategory).sort_order
        }
    }
}
