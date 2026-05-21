import { ProfileLibraryPage } from '@/components/profile/profile-library-page'
import { parseProfileLibraryTab } from '@/lib/profile/library-tabs'

interface ProfileLibraryRouteProps {
  searchParams: Promise<{
    tab?: string | string[]
  }>
}

export default async function ProfileLibraryRoute({ searchParams }: ProfileLibraryRouteProps) {
  const params = await searchParams
  return <ProfileLibraryPage initialTab={parseProfileLibraryTab(params.tab)} />
}
