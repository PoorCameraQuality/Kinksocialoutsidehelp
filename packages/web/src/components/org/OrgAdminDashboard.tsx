import { useEffect, useState } from 'react'



export type OrgFlags = {
  calendarEnabled: boolean
  forumsEnabled: boolean
  subgroupsEnabled: boolean
  chatEnabled: boolean
  externalEmbedEnabled: boolean
  listingKind?: 'community' | 'venue' | 'dungeon'
  eckeDungeonListing?: boolean
  venueCategory?: 'dungeon_club' | 'nude_beach' | 'kink_friendly_hotel' | 'web_resource' | 'other' | null
  city?: string | null
  region?: string | null
  country?: string | null
  lat?: number | null
  lng?: number | null
  addressVisibility?: 'city_only' | 'full'
}



type OrgAdminDashboardOrg = {

  displayName: string

  slug: string

  visibility: string

  logoUrl: string | null

  bannerUrl: string | null

  featureFlags: OrgFlags

  externalSiteUrl: string | null

  showExternalEmbed: boolean

  galleryPublic?: boolean

}



export type OrgAdminSection =

  | 'moderation'

  | 'profile'

  | 'branding'

  | 'features'

  | 'external'

  | 'gallery'

  | 'content'

  | 'members'



export default function OrgAdminDashboard({

  org,

  isAdmin,

  canModerate,

  viewerRole,

  bannerUploading,

  logoUploading,

  onPatchFlags,

  onPatchOrganization,

  onGoToTab,

  onOpenCommunityEditor,

  onUploadBanner,

  onClearBanner,

  onUploadLogo,

  onClearLogo,

  onToggleGalleryPublic,

  variant = 'hub',

  section,

}: {

  org: OrgAdminDashboardOrg

  isAdmin: boolean

  canModerate: boolean

  viewerRole: string | null

  bannerUploading: boolean

  logoUploading: boolean

  onPatchFlags: (next: Partial<OrgFlags>) => void

  onPatchOrganization: (body: Record<string, unknown>, successMessage?: string) => Promise<boolean>

  onGoToTab: (tab: string) => void

  onOpenCommunityEditor: () => void

  onUploadBanner: () => void

  onClearBanner: () => void

  onUploadLogo: () => void

  onClearLogo: () => void

  onToggleGalleryPublic: (next: boolean) => void

  /** hub = public org admin tab; organizer = command bridge settings sections */

  variant?: 'hub' | 'organizer'

  /** When set (organizer variant), render only this section */

  section?: OrgAdminSection

}) {

  const [displayName, setDisplayName] = useState(org.displayName)

  const [externalUrlDraft, setExternalUrlDraft] = useState(org.externalSiteUrl ?? '')

  const [savingProfile, setSavingProfile] = useState(false)

  const [savingExternal, setSavingExternal] = useState(false)



  useEffect(() => {

    setDisplayName(org.displayName)

  }, [org.displayName])



  useEffect(() => {

    setExternalUrlDraft(org.externalSiteUrl ?? '')

  }, [org.externalSiteUrl])



  const roleLabel = viewerRole ?? 'Member'

  const isOrganizer = variant === 'organizer'

  const show = (s: OrgAdminSection) => !isOrganizer || !section || section === s



  const featureFlags: [Extract<keyof OrgFlags, 'calendarEnabled' | 'forumsEnabled' | 'chatEnabled' | 'externalEmbedEnabled' | 'subgroupsEnabled'>, string][] =

    isOrganizer ?

      [

        ['calendarEnabled', 'Events & conventions (calendar tab)'],

        ['forumsEnabled', 'Forums'],

        ['chatEnabled', 'Chat'],

        ['externalEmbedEnabled', 'External site embed (About tab)'],

      ]

    : [

        ['calendarEnabled', 'Calendar'],

        ['forumsEnabled', 'Forums'],

        ['chatEnabled', 'Chat'],

        ['externalEmbedEnabled', 'External site embed (About tab)'],

        ['subgroupsEnabled', 'Subgroups'],

      ]



  return (

    <div className={`space-y-6 ${isOrganizer ? '' : 'max-w-3xl'}`}>

      {!isOrganizer ?

        <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)]">

          <h2 className="text-lg font-semibold text-dc-text mb-1">Admin &amp; moderation</h2>

          <p className="text-sm text-dc-muted">

            You are signed in with role <span className="text-dc-text-muted font-medium">{roleLabel}</span>.

            {isAdmin ?

              ' Owners and admins can change org settings, branding, and feature toggles.'

            : ' Moderators can manage forums, chat, and day-to-day community tools.'}

          </p>

        </div>

      : null}



      {canModerate && show('moderation') && !isOrganizer ?

        <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)] space-y-4">

          <h3 className="text-sm font-semibold text-dc-muted uppercase tracking-wide">Moderation &amp; community tools</h3>

          <p className="text-sm text-dc-text-muted">

            Use the tabs below for full tools: create forum categories, read threads, configure chat channels, set slow mode,

            and review member-facing content. In-app reporting on threads, posts, and chat is available to members from

            those surfaces.

          </p>

          <div className="flex flex-wrap gap-2">

            {org.featureFlags.forumsEnabled ?

              <button

                type="button"

                onClick={() => onGoToTab('Forums')}

                className="min-h-10 px-4 rounded-xl text-sm font-medium bg-dc-accent text-dc-text hover:bg-dc-accent-hover"

              >

                Open Forums

              </button>

            : null}

            {org.featureFlags.chatEnabled ?

              <button

                type="button"

                onClick={() => onGoToTab('Chat')}

                className="min-h-10 px-4 rounded-xl text-sm font-medium border border-dc-border text-dc-text-muted hover:text-dc-text"

              >

                Open Chat

              </button>

            : null}

            {org.featureFlags.calendarEnabled ?

              <button

                type="button"

                onClick={() => onGoToTab('Calendar')}

                className="min-h-10 px-4 rounded-xl text-sm font-medium border border-dc-border text-dc-text-muted hover:text-dc-text"

              >

                Open Calendar

              </button>

            : null}

            <button

              type="button"

              onClick={() => onGoToTab('Overview')}

              className="min-h-10 px-4 rounded-xl text-sm font-medium border border-dc-border text-dc-text-muted hover:text-dc-text"

            >

              Overview

            </button>

          </div>

        </div>

      : null}



      {isAdmin ?

        <>

          {show('profile') ?

            <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)] space-y-4">

              <h3 className="text-sm font-semibold text-dc-muted uppercase tracking-wide">Public profile</h3>

              <div className="space-y-2">

                <label className="block text-xs text-dc-muted">Display name</label>

                <div className="flex flex-wrap gap-2">

                  <input

                    value={displayName}

                    onChange={(e) => setDisplayName(e.target.value)}

                    className="flex-1 min-w-[200px] bg-dc-elevated-solid border border-dc-border rounded-xl px-3 py-2 text-sm text-dc-text"

                    maxLength={255}

                  />

                  <button

                    type="button"

                    disabled={savingProfile || !displayName.trim() || displayName.trim() === org.displayName}

                    onClick={async () => {

                      setSavingProfile(true)

                      try {

                        await onPatchOrganization({ displayName: displayName.trim() }, 'Display name saved.')

                      } finally {

                        setSavingProfile(false)

                      }

                    }}

                    className="min-h-10 px-4 rounded-xl text-sm bg-dc-accent text-dc-text disabled:opacity-40"

                  >

                    {savingProfile ? 'Saving…' : 'Save name'}

                  </button>

                </div>

              </div>

              <div className="space-y-2">

                <label className="block text-xs text-dc-muted">Who can see this organization</label>

                <select

                  value={org.visibility}

                  onChange={(e) => void onPatchOrganization({ visibility: e.target.value }, 'Visibility updated.')}

                  className="w-full max-w-md bg-dc-elevated-solid border border-dc-border rounded-xl px-3 py-2 text-sm text-dc-text"

                >

                  <option value="PUBLIC">Public. Anyone can view</option>

                  <option value="MEMBERS">Members only</option>

                  <option value="PRIVATE">Private. Invite only</option>

                </select>

              </div>

            </div>

          : null}



          {show('branding') ?

            <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)] space-y-4">

              <h3 className="text-sm font-semibold text-dc-muted uppercase tracking-wide">Branding</h3>

              <p className="text-xs text-dc-muted">

                {isOrganizer ?

                  'Logo and banner appear on the public org hub header and in ECKE listings.'

                : 'Banner also appears at the top of this page. Hover the banner strip (or use the empty state) to upload.'}

              </p>

              <div className="grid sm:grid-cols-2 gap-4">

                <div className="rounded-xl border border-dc-border bg-dc-elevated-solid p-4 space-y-2">

                  <p className="text-sm text-dc-text-muted">Banner</p>

                  {org.bannerUrl ?

                    <p className="text-[11px] text-dc-muted truncate" title={org.bannerUrl}>

                      Image set

                    </p>

                  : <p className="text-[11px] text-dc-muted">No banner yet</p>}

                  <div className="flex flex-wrap gap-2">

                    <button

                      type="button"

                      disabled={bannerUploading}

                      onClick={onUploadBanner}

                      className="text-xs px-3 py-1.5 rounded-lg bg-dc-accent text-dc-text disabled:opacity-50"

                    >

                      {bannerUploading ? 'Uploading…' : org.bannerUrl ? 'Replace' : 'Upload'}

                    </button>

                    {org.bannerUrl ?

                      <button

                        type="button"

                        disabled={bannerUploading}

                        onClick={onClearBanner}

                        className="text-xs px-3 py-1.5 rounded-lg border border-dc-border text-dc-text-muted"

                      >

                        Remove

                      </button>

                    : null}

                  </div>

                </div>

                <div className="rounded-xl border border-dc-border bg-dc-elevated-solid p-4 space-y-2">

                  <p className="text-sm text-dc-text-muted">Logo</p>

                  {org.logoUrl ?

                    <div className="flex items-center gap-2">

                      <img src={org.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover border border-dc-border" />

                      <p className="text-[11px] text-dc-muted truncate flex-1" title={org.logoUrl}>

                        Set

                      </p>

                    </div>

                  : <p className="text-[11px] text-dc-muted">No logo</p>}

                  <div className="flex flex-wrap gap-2">

                    <button

                      type="button"

                      disabled={logoUploading}

                      onClick={onUploadLogo}

                      className="text-xs px-3 py-1.5 rounded-lg bg-dc-accent text-dc-text disabled:opacity-50"

                    >

                      {logoUploading ? 'Uploading…' : org.logoUrl ? 'Replace logo' : 'Upload logo'}

                    </button>

                    {org.logoUrl ?

                      <button

                        type="button"

                        disabled={logoUploading}

                        onClick={onClearLogo}

                        className="text-xs px-3 py-1.5 rounded-lg border border-dc-border text-dc-text-muted"

                      >

                        Remove

                      </button>

                    : null}

                  </div>

                </div>

              </div>

            </div>

          : null}



          {show('features') ?

            <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)] space-y-3">

              <h3 className="text-sm font-semibold text-dc-muted uppercase tracking-wide">

                {isOrganizer ? 'Community features' : 'Features visible on this org'}

              </h3>

              <p className="text-xs text-dc-muted mb-2">

                Turning a feature off hides its tab and related UI on the public hub. Existing data stays in the database.

              </p>

              {featureFlags.map(([key, label]) => (

                <label key={key} className="flex items-center gap-2 text-sm text-dc-text-muted cursor-pointer">

                  <input

                    type="checkbox"

                    checked={Boolean(org.featureFlags[key])}

                    onChange={(e) => onPatchFlags({ [key]: e.target.checked })}

                  />

                  {label}

                </label>

              ))}

            </div>

          : null}



          {show('external') ?

            <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)] space-y-4">

              <h3 className="text-sm font-semibold text-dc-muted uppercase tracking-wide">External site (About)</h3>

              <p className="text-xs text-dc-muted">

                When embed is enabled, the URL must be allowlisted on the server. The About tab shows the iframe only when

                both the feature flag and a valid URL are set.

              </p>

              <div className="space-y-2">

                <label className="block text-xs text-dc-muted">Site URL (https)</label>

                <div className="flex flex-wrap gap-2">

                  <input

                    value={externalUrlDraft}

                    onChange={(e) => setExternalUrlDraft(e.target.value)}

                    placeholder="https://…"

                    className="flex-1 min-w-[200px] bg-dc-elevated-solid border border-dc-border rounded-xl px-3 py-2 text-sm text-dc-text"

                  />

                  <button

                    type="button"

                    disabled={savingExternal}

                    onClick={async () => {

                      setSavingExternal(true)

                      try {

                        const trimmed = externalUrlDraft.trim()

                        await onPatchOrganization(

                          {

                            externalSiteUrl: trimmed.length > 0 ? trimmed : null,

                          },

                          'External URL saved.'

                        )

                      } finally {

                        setSavingExternal(false)

                      }

                    }}

                    className="min-h-10 px-4 rounded-xl text-sm bg-dc-accent text-dc-text disabled:opacity-50"

                  >

                    {savingExternal ? 'Saving…' : 'Save URL'}

                  </button>

                </div>

              </div>

              <label className="flex items-center gap-2 text-sm text-dc-text-muted cursor-pointer">

                <input

                  type="checkbox"

                  checked={org.showExternalEmbed}

                  onChange={(e) => void onPatchOrganization({ showExternalEmbed: e.target.checked }, 'Embed preference saved.')}

                />

                Allow embedded site on About (when URL is allowed)

              </label>

            </div>

          : null}



          {show('gallery') && !isOrganizer ?

            <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)] space-y-3">

              <h3 className="text-sm font-semibold text-dc-muted uppercase tracking-wide">Gallery</h3>

              <label className="flex items-center gap-2 text-sm text-dc-text-muted cursor-pointer">

                <input

                  type="checkbox"

                  checked={org.galleryPublic ?? false}

                  onChange={(e) => onToggleGalleryPublic(e.target.checked)}

                />

                Gallery visible to non-members (when off, only members see photos on About)

              </label>

              <button

                type="button"

                onClick={() => onGoToTab('About')}

                className="text-sm text-dc-accent hover:underline"

              >

                Manage photos on About tab →

              </button>

            </div>

          : null}



          {show('content') && !isOrganizer ?

            <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)] space-y-3">

              <h3 className="text-sm font-semibold text-dc-muted uppercase tracking-wide">Page content</h3>

              <p className="text-sm text-dc-text-muted">

                Welcome message, FAQ, resource links, spotlight subgroup, recap links, and customizable overview modules

                (contacts, announcements, documents, volunteer block, etc.).

              </p>

              <div className="flex flex-wrap gap-2">

                <button

                  type="button"

                  onClick={onOpenCommunityEditor}

                  className="min-h-10 px-4 rounded-xl text-sm font-medium bg-dc-accent text-dc-text hover:bg-dc-accent-hover"

                >

                  Edit overview &amp; modules

                </button>

                <button

                  type="button"

                  onClick={() => onGoToTab('About')}

                  className="min-h-10 px-4 rounded-xl text-sm border border-dc-border text-dc-text-muted hover:text-dc-text"

                >

                  About &amp; bio

                </button>

              </div>

            </div>

          : null}



          {show('members') && !isOrganizer ?

            <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)] space-y-2">

              <h3 className="text-sm font-semibold text-dc-muted uppercase tracking-wide">Members &amp; volunteers</h3>

              <p className="text-sm text-dc-text-muted">

                Member directory, roles, and volunteer tags are managed from the Overview tab (sidebar and member list).

              </p>

              <button

                type="button"

                onClick={() => onGoToTab('Overview')}

                className="text-sm text-dc-accent hover:underline"

              >

                Go to Overview for member tools →

              </button>

            </div>

          : null}

        </>

      : null}

    </div>

  )

}

