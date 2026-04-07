import { ProfileUserListPage } from '@/components/profile/profile-user-list-page'

export default function ProfileFollowersPage() {
  return (
    <ProfileUserListPage
      type="followers"
      title="粉丝"
      emptyTitle="还没有粉丝"
      emptyDescription="先持续发布内容，后续这里会出现关注你的人。"
    />
  )
}
