import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapProject, type DbProject } from '@/lib/mappers/project'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, bio, xp, role, created_at')
      .eq('id', id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: projectRows, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .eq('author_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })

    if (projectsError) throw projectsError

    const projects = (projectRows || []).map((project) =>
      mapProject(project as DbProject, profile.display_name || undefined)
    )

    const { count: followerCount } = await supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', id)

    const { count: followingCount } = await supabase
      .from('follows')
      .select('following_id', { count: 'exact', head: true })
      .eq('follower_id', id)

    const { data: badgeRows } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', id)

    const badgeIds = (badgeRows as { badge_id: string }[] | null)?.map((row) => row.badge_id) || []

    return NextResponse.json({
      profile,
      projects,
      followerCount: followerCount || 0,
      followingCount: followingCount || 0,
      badgeIds,
    })
  } catch (error) {
    console.error('Error in GET /api/users/[id]:', error)
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 })
  }
}
