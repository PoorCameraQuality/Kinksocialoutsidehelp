import ConventionsFeaturedCard from '@/components/conventions/ConventionsFeaturedCard'
import type { ConventionDiscoverView } from '@/lib/conventions-page-utils'

type Props = {
  featured: ConventionDiscoverView[]
}

export default function ConventionsFeaturedRow({ featured }: Props) {
  if (featured.length === 0) return null

  return (
    <section className="mb-8" aria-label="Featured conventions">
      <h2 className="sr-only">Featured</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {featured.map((view) => (
          <ConventionsFeaturedCard key={view.row.id} view={view} />
        ))}
      </div>
    </section>
  )
}
