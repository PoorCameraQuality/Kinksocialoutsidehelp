import { Link } from 'react-router-dom'
import { OrgHubSectionCard, OrgHubStatusBadge } from '@/components/org/hub/OrgHubSectionCard'
import { formatOrgVisibilityLabel } from '@/components/org/hub/orgHubMeta'

type GalleryRow = {
  id: string
  imageUrl: string
  caption: string | null
}

type PersonnelGroups = {
  order: string[]
  byRole: Record<string, { userId: string; username: string; displayName: string | null }[]>
  memberCount: number
}

type OrgFlags = {
  calendarEnabled: boolean
  forumsEnabled: boolean
  chatEnabled: boolean
  subgroupsEnabled: boolean
}

export function OrgHubAboutTab({
  org,
  flags,
  bioFmt,
  gallery,
  galleryLocked,
  galleryUrl,
  personnelGroups,
  hasUpcomingEvents,
  canManageOrg,
  organizerBase,
  onJoin,
  onOpenCalendar,
}: {
  org: {
    slug: string
    displayName: string
    bio: string | null
    visibility: string
    memberCount: number
    isMember: boolean
    community?: {
      links?: { label: string; url: string }[]
      faq?: { q: string; a: string }[]
    } | null
    externalEmbedAllowed: boolean
    externalSiteUrl: string | null
  }
  flags: OrgFlags
  bioFmt: 'text' | 'html'
  gallery: GalleryRow[] | null
  galleryLocked: boolean
  galleryUrl: (url: string) => string | undefined
  personnelGroups: PersonnelGroups | null
  hasUpcomingEvents: boolean
  canManageOrg: boolean
  organizerBase: string
  onJoin: () => void
  onOpenCalendar: () => void
}) {
  const publicPersonnel = personnelGroups
    ? personnelGroups.order.flatMap((role) => {
        if (role === 'MEMBER') return []
        const list = personnelGroups.byRole[role]
        if (!list?.length) return []
        return list.map((m) => ({ ...m, role }))
      })
    : []

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      <div className="space-y-6 lg:col-span-8">
        <OrgHubSectionCard eyebrow="About" title="About this organization">
          {org.bio ?
            bioFmt === 'html' ?
              <div
                className="c2k-rich-html prose prose-invert prose-sm max-w-none text-dc-text-muted prose-a:text-dc-accent prose-headings:text-dc-text prose-strong:text-dc-text"
                dangerouslySetInnerHTML={{ __html: org.bio }}
              />
            : <p className="whitespace-pre-wrap text-sm leading-relaxed text-dc-text-muted">{org.bio}</p>
          : <>
              <p className="text-sm leading-relaxed text-dc-text-muted">
                This organization has not added a full About section yet.
              </p>
              {canManageOrg ?
                <Link
                  to={`${organizerBase}?tab=settings&settingsSection=content`}
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-dc-accent hover:underline"
                >
                  Add About content
                </Link>
              : null}
            </>
          }
        </OrgHubSectionCard>

        <OrgHubSectionCard eyebrow="Programs" title="What they host">
          {hasUpcomingEvents ?
            <>
              <p className="text-sm leading-relaxed text-dc-text-muted">
                {org.displayName} hosts public programs and community events. Visit the Calendar tab to see upcoming
                dates and RSVP.
              </p>
              <button
                type="button"
                onClick={onOpenCalendar}
                className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-dc-accent-border/50 bg-dc-accent-muted px-4 py-2 text-sm font-semibold text-dc-accent hover:bg-dc-accent/15"
              >
                View calendar
              </button>
            </>
          : <p className="text-sm leading-relaxed text-dc-text-muted">
              Upcoming events will appear here once the organizers publish them.
            </p>
          }
        </OrgHubSectionCard>

        <OrgHubSectionCard eyebrow="Community" title="Community expectations">
          <p className="text-sm leading-relaxed text-dc-text-muted">
            Review this organization&apos;s guidelines before participating in events, forums, or chat.
          </p>
          <Link
            to="/guidelines"
            className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-dc-accent-border/50 px-4 py-2 text-sm font-semibold text-dc-accent hover:bg-dc-accent/10"
          >
            Read community guidelines
          </Link>
        </OrgHubSectionCard>

        {org.community?.links && org.community.links.length > 0 ?
          <OrgHubSectionCard eyebrow="Resources" title="Links & resources">
            <ul className="space-y-2">
              {org.community.links.map((l, i) => (
                <li key={i}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-dc-accent hover:underline"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </OrgHubSectionCard>
        : null}

        {org.externalEmbedAllowed && org.externalSiteUrl ?
          <OrgHubSectionCard eyebrow="Web" title="External site">
            <p className="mb-3 text-xs text-dc-muted">Third-party content. Use caution with links and logins.</p>
            <iframe
              title="Organization external site"
              src={org.externalSiteUrl}
              className="min-h-[420px] w-full rounded-xl border border-dc-border bg-black/20"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </OrgHubSectionCard>
        : null}
      </div>

      <aside className="space-y-6 lg:col-span-4">
        <OrgHubSectionCard eyebrow="Details" title="Organization details">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-dc-muted">Members</dt>
              <dd className="font-medium text-dc-text">{org.memberCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-dc-muted">Visibility</dt>
              <dd>
                <OrgHubStatusBadge tone={org.visibility.toLowerCase() === 'public' ? 'public' : 'members'}>
                  {formatOrgVisibilityLabel(org.visibility)}
                </OrgHubStatusBadge>
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-dc-muted">Public hub</dt>
              <dd className="truncate font-mono text-xs text-dc-text-muted">/orgs/{org.slug}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-dc-muted">Calendar</dt>
              <dd>
                <OrgHubStatusBadge tone={flags.calendarEnabled ? 'enabled' : 'disabled'}>
                  {flags.calendarEnabled ? 'Enabled' : 'Disabled'}
                </OrgHubStatusBadge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-dc-muted">Forums</dt>
              <dd>
                <OrgHubStatusBadge tone={flags.forumsEnabled ? 'enabled' : 'disabled'}>
                  {flags.forumsEnabled ? 'Enabled' : 'Disabled'}
                </OrgHubStatusBadge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-dc-muted">Chat</dt>
              <dd>
                <OrgHubStatusBadge tone={flags.chatEnabled ? 'enabled' : 'disabled'}>
                  {flags.chatEnabled ? 'Enabled' : 'Disabled'}
                </OrgHubStatusBadge>
              </dd>
            </div>
          </dl>
        </OrgHubSectionCard>

        <OrgHubSectionCard eyebrow="Gallery" title="Gallery">
          {galleryLocked && !org.isMember ?
            <div className="rounded-xl border border-dashed border-dc-border-strong p-5 text-center">
              <p className="text-sm text-dc-text-muted">Gallery images are available to members.</p>
              <button type="button" onClick={onJoin} className="mt-2 text-sm font-semibold text-dc-accent hover:underline">
                Join to view
              </button>
            </div>
          : gallery === null ?
            <div className="h-20 animate-pulse rounded-xl bg-dc-elevated-muted" />
          : gallery.length === 0 ?
            <>
              <p className="text-sm text-dc-text-muted">No gallery images yet.</p>
              <p className="mt-2 text-xs leading-relaxed text-dc-muted">
                Organizers can add photos, banners, or visual highlights from the dashboard.
              </p>
              {canManageOrg ?
                <Link
                  to={`${organizerBase}?tab=settings&settingsSection=branding`}
                  className="mt-3 inline-flex text-sm font-semibold text-dc-accent hover:underline"
                >
                  Add gallery images
                </Link>
              : null}
            </>
          : <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {gallery.map((g) => (
                <li key={g.id} className="overflow-hidden rounded-xl border border-dc-border bg-black/20">
                  <img
                    src={galleryUrl(g.imageUrl)}
                    alt=""
                    className="h-44 w-full object-cover"
                    loading="lazy"
                  />
                  {g.caption ?
                    <p className="line-clamp-3 px-2 py-2 text-xs leading-snug text-dc-muted">{g.caption}</p>
                  : null}
                </li>
              ))}
            </ul>
          }
        </OrgHubSectionCard>

        <OrgHubSectionCard eyebrow="Team" title="Personnel">
          {publicPersonnel.length === 0 ?
            <p className="text-sm text-dc-text-muted">No public personnel are listed yet.</p>
          : <ul className="space-y-3">
              {publicPersonnel.map((m) => (
                <li key={m.userId}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted">{m.role.replace('_', ' ')}</p>
                  <Link
                    to={`/profile/${encodeURIComponent(m.username)}`}
                    className="text-sm font-semibold text-dc-accent hover:underline"
                  >
                    {m.displayName || m.username}
                  </Link>
                </li>
              ))}
            </ul>
          }
        </OrgHubSectionCard>

        {canManageOrg ?
          <OrgHubSectionCard eyebrow="Organizer" title="Manage this page">
            <p className="text-sm text-dc-text-muted">Quick links for people who run this organization.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to={`${organizerBase}?tab=settings&settingsSection=content`} className="font-medium text-dc-accent hover:underline">
                  Edit About content
                </Link>
              </li>
              <li>
                <Link to={`${organizerBase}?tab=settings&settingsSection=branding`} className="font-medium text-dc-accent hover:underline">
                  Edit branding
                </Link>
              </li>
              <li>
                <Link to={`${organizerBase}?tab=settings&settingsSection=features`} className="font-medium text-dc-accent hover:underline">
                  Manage features
                </Link>
              </li>
              <li>
                <Link to={organizerBase} className="font-medium text-dc-accent hover:underline">
                  Open organizer dashboard
                </Link>
              </li>
            </ul>
          </OrgHubSectionCard>
        : null}
      </aside>
    </div>
  )
}
