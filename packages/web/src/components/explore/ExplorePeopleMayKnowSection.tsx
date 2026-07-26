import { Link } from 'react-router-dom'
import FindPeopleProfileCard from '@/components/find-people/FindPeopleProfileCard'
import { mockPeople } from '@/data/mock-data'
import { PEOPLE_DIRECTORY_PATH } from '@/lib/app-routes'
import type { MockPerson } from '@/data/types'

type Props = {
  people?: MockPerson[]
  useDemoFallback?: boolean
}

export default function ExplorePeopleMayKnowSection({ people, useDemoFallback = false }: Props) {
  const pool = people?.length ? people : useDemoFallback ? mockPeople : []
  const rows = pool.slice(0, 6)

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-dc-text">People you may know</h2>
          <p className="mt-1 text-sm text-dc-text-muted">
            Members connected through events, groups, or shared regions.
          </p>
        </div>
        <Link
          to={PEOPLE_DIRECTORY_PATH}
          className="shrink-0 text-sm font-semibold text-dc-accent hover:underline"
        >
          See more people →
        </Link>
      </div>
      {rows.length === 0 ?
        <p className="text-sm text-dc-muted">Connect at events or complete your profile location to see suggestions.</p>
      : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((person) => (
            <FindPeopleProfileCard key={String(person.id)} person={person} />
          ))}
        </div>
      }
    </section>
  )
}
