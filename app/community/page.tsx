import { CommunityPageClient } from './community-page-client'
import {
  getDiscussionList,
  getDiscussionTags,
  type DiscussionListItem,
} from '@/lib/api/community-discussions'

interface CommunityPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const params = await searchParams
  const initialTab = params.tab === 'challenges' ? 'challenges' : 'discussions'
  const [discussionResult, tagsResult] = await Promise.allSettled([
    getDiscussionList({ page: 0, pageSize: 10, sort: 'hottest' }),
    getDiscussionTags(),
  ])

  const discussionData = discussionResult.status === 'fulfilled'
    ? discussionResult.value
    : { discussions: [] as DiscussionListItem[], total: null, hasMore: true }
  const discussionTags = tagsResult.status === 'fulfilled' ? tagsResult.value : []

  return (
    <CommunityPageClient
      initialTab={initialTab}
      initialDiscussionTotal={discussionData.total}
      initialDiscussions={discussionData.discussions}
      initialDiscussionsHasMore={discussionData.hasMore}
      initialDiscussionTags={discussionTags}
      initialDiscussionDataLoaded={discussionResult.status === 'fulfilled'}
      initialDiscussionTagsLoaded={tagsResult.status === 'fulfilled'}
    />
  )
}
