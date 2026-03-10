import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapProject, type DbProject } from '@/lib/mappers/project'

export async function GET() {
  const supabase = await createClient()

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: followingData, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    if (followingError) throw followingError

    const followingIds = (followingData as { following_id: string }[] | null)
      ?.map((row) => row.following_id) || []

    if (followingIds.length === 0) {
      return NextResponse.json({ projects: [], followingCount: 0 })
    }

    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('*, profiles:author_id(display_name)')
      .in('author_id', followingIds)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(20)

    if (projectsError) throw projectsError

    const list = projectsData as (DbProject & { profiles?: { display_name?: string | null } })[] | null
    const projects = (list || []).map((project) => {
      const authorName = project.profiles?.display_name || undefined
      return mapProject(project as DbProject, authorName)
    })

    return NextResponse.json({ projects, followingCount: followingIds.length })
  } catch (error) {
    console.error('Error in GET /api/following-feed:', error)
    return NextResponse.json({ error: 'Failed to fetch following feed' }, { status: 500 })
  }
}
