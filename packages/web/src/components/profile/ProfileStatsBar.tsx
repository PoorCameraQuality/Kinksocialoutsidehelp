import { Link } from 'react-router-dom'

export type ProfileStatItem =
  | { kind: 'value'; label: string; value: number; href?: string; accent?: boolean }
  | { kind: 'placeholder'; label: string }

export default function ProfileStatsBar({ stats }: { stats: ProfileStatItem[] }) {
  if (stats.length === 0) return null
  return (
    <div className="flex flex-wrap gap-6 mb-6 py-4 border-y border-dc-border" aria-label="Profile stats">
      {stats.map((stat) =>
        stat.kind === 'placeholder' ?
          <div key={stat.label}>
            <span className="text-2xl font-bold text-dc-muted">-</span>
            <span className="text-sm text-dc-muted ml-1">{stat.label}</span>
          </div>
        : stat.href ?
          <div key={stat.label}>
            <Link to={stat.href} className="group inline-flex flex-col">
              <span
                className={`text-2xl font-bold group-hover:text-dc-accent ${stat.accent ? 'text-dc-accent' : 'text-dc-text'}`}
              >
                {stat.value}
              </span>
              <span className="text-sm text-dc-muted ml-0 group-hover:text-dc-text-muted">{stat.label}</span>
            </Link>
          </div>
        : <div key={stat.label}>
            <span className={`text-2xl font-bold ${stat.accent ? 'text-dc-accent' : 'text-dc-text'}`}>{stat.value}</span>
            <span className="text-sm text-dc-muted ml-1">{stat.label}</span>
          </div>,
      )}
    </div>
  )
}
