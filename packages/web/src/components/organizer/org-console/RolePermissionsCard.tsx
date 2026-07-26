import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'

const ROLE_COPY: Record<string, { title: string; console: string; public: string }> = {
  OWNER: {
    title: 'Owner',
    console: 'Full dashboard access including settings, roles, branding, and publishing.',
    public: 'Shown as organization leadership on the public hub.',
  },
  ADMIN: {
    title: 'Admin',
    console: 'Settings, people, communications, and program tools.',
    public: 'Can moderate all community surfaces.',
  },
  MODERATOR: {
    title: 'Moderator',
    console: 'Communications and moderation. No organization settings.',
    public: 'Day-to-day community management for members.',
  },
  STAFF: {
    title: 'Staff',
    console: 'People and volunteer tools. No settings access; communications read-only.',
    public: 'Listed on programs when assigned duties.',
  },
}

type Props = {
  viewerRole: string | null
  showSettings: boolean
}

export default function RolePermissionsCard({ viewerRole, showSettings }: Props) {
  const key = viewerRole ?? 'MEMBER'
  const copy = ROLE_COPY[key] ?? {
    title: key,
    console: 'Organizer access depends on your role.',
    public: 'See the public hub for member-facing features.',
  }

  return (
    <OrganizerPanel title="Your role" description="What you can do in this dashboard.">
      <p className="text-sm font-medium text-dc-text">{copy.title}</p>
      <p className="mt-2 text-sm text-dc-text-muted">{copy.console}</p>
      <p className="mt-2 text-dc-micro text-dc-muted">{copy.public}</p>
      {!showSettings && (key === 'MODERATOR' || key === 'STAFF') ?
        <p className="mt-3 rounded-lg border border-dc-border/80 bg-dc-surface/40 px-3 py-2 text-dc-micro text-dc-text-muted">
          Organization settings are limited to owners and admins. Use Communications or Moderation tabs for
          community work.
        </p>
      : null}
    </OrganizerPanel>
  )
}
