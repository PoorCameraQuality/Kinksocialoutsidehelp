import { useSearchParams } from 'react-router-dom'
import GroupsDiscoverPage from '@/app/groups/GroupsDiscoverPage'
import GroupsPersonalLibraryPage from '@/app/groups/GroupsPersonalLibraryPage'
import { parseGroupsSectionMode } from '@/lib/groups-section-mode'

export default function GroupsPage() {
  const [searchParams] = useSearchParams()
  const mode = parseGroupsSectionMode(searchParams)

  if (mode !== 'discover') {
    return <GroupsPersonalLibraryPage mode={mode} />
  }

  return <GroupsDiscoverPage />
}
