import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import OrgCommunityModulesEditor from '@/components/org/OrgCommunityModulesEditor'
import OrganizerFormSection from '@/components/organizer/ui/OrganizerFormSection'
import OrganizerPanel from '@/components/organizer/ui/OrganizerPanel'
import { SettingsStickyFooter } from '@/components/organizer/settings/settings-ui'
import type { CommunityPageModule } from '@/types/org-community-modules'
import { formatOrgContentSaveError, normalizeHttpUrl } from '@/lib/organizer/normalizeHttpUrl'

export type OrgCommunityDraft = {
  welcomeHtml?: string | null
  faq?: { q: string; a: string }[]
  links?: { label: string; url: string }[]
  spotlightGroupId?: string | null
  recapThreadId?: string | null
  lastEventRecapUrl?: string | null
  communityModules?: CommunityPageModule[] | null
}

export type OrgContentEditorPanelProps = {
  orgSlug: string
  /** When provided, skips initial fetch and uses this draft. */
  initialDraft?: OrgCommunityDraft
  /** Start in edit mode immediately. */
  autoOpen?: boolean
  /** Sticky save bar for organizer settings content tab. */
  stickyFooter?: boolean
  publicHubHref?: string
  onSaved?: (draft: OrgCommunityDraft) => void
  onCancel?: () => void
}

function sanitizeCommunityModulesForSave(modules: CommunityPageModule[] | null | undefined): CommunityPageModule[] {
  return (modules ?? []).map((m) => {
    switch (m.type) {
      case 'checklist':
        return {
          ...m,
          items: m.items.map((it) => ({
            ...it,
            href: it.href ? normalizeHttpUrl(it.href) : null,
            note: it.note?.trim() || null,
          })),
        }
      case 'contacts':
        return {
          ...m,
          rows: m.rows.map((row) => ({
            ...row,
            href: row.href ? normalizeHttpUrl(row.href) : null,
          })),
        }
      case 'announcements':
        return {
          ...m,
          items: m.items.map((it) => ({
            ...it,
            dateLabel: it.dateLabel?.trim() || null,
            link: it.link ? normalizeHttpUrl(it.link) : null,
          })),
        }
      case 'documents':
        return {
          ...m,
          items: m.items.map((it) => ({
            ...it,
            url: normalizeHttpUrl(it.url) ?? it.url.trim(),
          })),
        }
      case 'volunteer':
        return {
          ...m,
          signupUrl: m.signupUrl ? normalizeHttpUrl(m.signupUrl) : null,
        }
      case 'reporting':
        return {
          ...m,
          reportUrl: m.reportUrl ? normalizeHttpUrl(m.reportUrl) : null,
        }
      default:
        return m
    }
  })
}

function buildCommunitySavePayload(draft: OrgCommunityDraft) {
  const faq = (draft.faq ?? []).filter((row) => row.q.trim() || row.a.trim())
  const links = (draft.links ?? [])
    .map((row) => {
      const label = row.label.trim()
      const url = normalizeHttpUrl(row.url)
      return label && url ? { label, url } : null
    })
    .filter(Boolean) as { label: string; url: string }[]

  for (const row of draft.links ?? []) {
    const label = row.label.trim()
    const rawUrl = row.url.trim()
    if (label && rawUrl && !normalizeHttpUrl(rawUrl)) {
      throw new Error(`Resource link “${label}” needs a valid URL (e.g. https://example.com or example.com).`)
    }
  }

  return {
    welcomeHtml: draft.welcomeHtml?.trim() ? draft.welcomeHtml : null,
    faq,
    links,
    communityModules: sanitizeCommunityModulesForSave(draft.communityModules),
    spotlightGroupId: null,
    recapThreadId: null,
    lastEventRecapUrl: null,
  }
}

function emptyDraft(): OrgCommunityDraft {
  return {
    welcomeHtml: '',
    faq: [],
    links: [],
    spotlightGroupId: null,
    recapThreadId: null,
    lastEventRecapUrl: null,
    communityModules: [],
  }
}

export default function OrgContentEditorPanel({
  orgSlug,
  initialDraft,
  autoOpen = true,
  stickyFooter = false,
  publicHubHref,
  onSaved,
  onCancel,
}: OrgContentEditorPanelProps) {
  const orgKey = encodeURIComponent(orgSlug)
  const [editing, setEditing] = useState(autoOpen)
  const [communityDraft, setCommunityDraft] = useState<OrgCommunityDraft>(initialDraft ?? emptyDraft())
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(initialDraft === undefined)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const loadFromOrg = useCallback(async () => {
    setLoadErr(null)
    setLoading(true)
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}`, { credentials: 'include' })
      if (!r.ok) {
        setLoadErr('Could not load organization content.')
        return
      }
      const data = (await r.json()) as {
        organization: { community?: OrgCommunityDraft | null }
      }
      const c = data.organization.community
      setCommunityDraft({
        welcomeHtml: c?.welcomeHtml ?? '',
        faq: c?.faq ?? [],
        links: c?.links ?? [],
        spotlightGroupId: c?.spotlightGroupId ?? null,
        recapThreadId: c?.recapThreadId ?? null,
        lastEventRecapUrl: c?.lastEventRecapUrl ?? null,
        communityModules: Array.isArray(c?.communityModules) ? c!.communityModules! : [],
      })
    } catch {
      setLoadErr('Network error')
    } finally {
      setLoading(false)
    }
  }, [orgKey])

  useEffect(() => {
    if (initialDraft !== undefined) return
    void loadFromOrg()
  }, [initialDraft, loadFromOrg])

  async function saveCommunityFromDraft() {
    setSaveErr(null)
    let payload
    try {
      payload = buildCommunitySavePayload(communityDraft)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Could not save')
      return
    }
    try {
      const r = await fetch(`/api/v1/organizations/${orgKey}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ community: payload }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string; details?: unknown }
      if (!r.ok) {
        setSaveErr(formatOrgContentSaveError(j.error, j.details))
        return
      }
      setEditing(false)
      onSaved?.(payload)
    } catch {
      setSaveErr('Network error')
    }
  }

  if (loading) {
    return (
      <OrganizerPanel title="Overview & modules">
        <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" />
      </OrganizerPanel>
    )
  }

  if (loadErr) {
    return (
      <OrganizerPanel title="Overview & modules">
        <p className="text-sm text-red-400">{loadErr}</p>
        <button
          type="button"
          onClick={() => void loadFromOrg()}
          className="mt-2 min-h-10 rounded-xl border border-dc-border px-3 text-sm text-dc-text hover:bg-dc-elevated-muted"
        >
          Retry
        </button>
      </OrganizerPanel>
    )
  }

  const moduleCount = communityDraft.communityModules?.length ?? 0
  const faqCount = communityDraft.faq?.length ?? 0
  const linkCount = communityDraft.links?.length ?? 0
  const welcomeLen = communityDraft.welcomeHtml?.trim()?.length ?? 0

  const editorBody = editing ? (
        <div className="space-y-5">
          <OrganizerFormSection
            title="Welcome message"
            description="Shown near the top of the public Overview tab."
          >
            <textarea
              value={communityDraft.welcomeHtml ?? ''}
              onChange={(e) => setCommunityDraft((d) => ({ ...d, welcomeHtml: e.target.value }))}
              rows={5}
              placeholder="Welcome to our community…"
              className="w-full rounded-xl border border-dc-border bg-dc-elevated-solid p-3 text-sm text-dc-text"
            />
            <p className="mt-1 text-xs text-dc-muted">{welcomeLen} characters</p>
          </OrganizerFormSection>

          <OrganizerFormSection title="FAQ" description="Question and answer pairs on the public FAQ tab.">
            <div className="space-y-2">
              {(communityDraft.faq ?? []).length === 0 ?
                <p className="text-sm text-dc-text-muted">
                  No FAQ items yet. Add common questions about membership, events, accessibility, rules, or contact info.
                </p>
              : null}
              {(communityDraft.faq ?? []).map((row, i) => (
                <div key={i} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={row.q}
                    onChange={(e) => {
                      const faq = [...(communityDraft.faq ?? [])]
                      faq[i] = { ...faq[i]!, q: e.target.value }
                      setCommunityDraft((d) => ({ ...d, faq }))
                    }}
                    placeholder="Question"
                    className="flex-1 rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1 text-sm text-dc-text"
                  />
                  <input
                    value={row.a}
                    onChange={(e) => {
                      const faq = [...(communityDraft.faq ?? [])]
                      faq[i] = { ...faq[i]!, a: e.target.value }
                      setCommunityDraft((d) => ({ ...d, faq }))
                    }}
                    placeholder="Answer"
                    className="flex-1 rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1 text-sm text-dc-text"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const faq = [...(communityDraft.faq ?? [])]
                      faq.splice(i, 1)
                      setCommunityDraft((d) => ({ ...d, faq }))
                    }}
                    className="text-xs text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCommunityDraft((d) => ({ ...d, faq: [...(d.faq ?? []), { q: '', a: '' }] }))}
                className="text-xs font-medium text-dc-accent"
              >
                + Add FAQ item
              </button>
            </div>
          </OrganizerFormSection>

          <OrganizerFormSection title="Resource links" description="Quick links on Overview and FAQ tabs.">
            <div className="space-y-2">
              {(communityDraft.links ?? []).length === 0 ?
                <p className="text-sm text-dc-text-muted">
                  No resource links yet. Add helpful links for members and visitors.
                </p>
              : null}
              {(communityDraft.links ?? []).map((row, i) => (
                <div key={i} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={row.label}
                    onChange={(e) => {
                      const links = [...(communityDraft.links ?? [])]
                      links[i] = { ...links[i]!, label: e.target.value }
                      setCommunityDraft((d) => ({ ...d, links }))
                    }}
                    placeholder="Label"
                    className="flex-1 rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1 text-sm text-dc-text"
                  />
                  <input
                    value={row.url}
                    onChange={(e) => {
                      const links = [...(communityDraft.links ?? [])]
                      links[i] = { ...links[i]!, url: e.target.value }
                      setCommunityDraft((d) => ({ ...d, links }))
                    }}
                    placeholder="https://…"
                    className="flex-1 rounded-lg border border-dc-border bg-dc-elevated-solid px-2 py-1 text-sm text-dc-text"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const links = [...(communityDraft.links ?? [])]
                      links.splice(i, 1)
                      setCommunityDraft((d) => ({ ...d, links }))
                    }}
                    className="text-xs text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setCommunityDraft((d) => ({ ...d, links: [...(d.links ?? []), { label: '', url: '' }] }))
                }
                className="text-xs font-medium text-dc-accent"
              >
                + Add link
              </button>
            </div>
          </OrganizerFormSection>

          <OrganizerFormSection
            title="Overview modules"
            description="Contacts, announcements, documents, volunteer blocks, and other org-wide widgets."
          >
            {moduleCount === 0 ?
              <p className="mb-3 text-sm text-dc-text-muted">
                No extra modules. The public hub will show default sections only.
              </p>
            : null}
            <OrgCommunityModulesEditor
              modules={communityDraft.communityModules ?? []}
              onChange={(next) => setCommunityDraft((d) => ({ ...d, communityModules: next }))}
            />
          </OrganizerFormSection>

          {saveErr && <p className="text-sm text-red-400" role="alert">{saveErr}</p>}

          {!stickyFooter ?
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveCommunityFromDraft()}
                className="min-h-11 rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
              >
                Save content
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setSaveErr(null)
                  void loadFromOrg()
                  onCancel?.()
                }}
                className="min-h-11 rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
              >
                Cancel
              </button>
            </div>
          : null}
        </div>
      ) : null

  const actionBar = (
    <>
      <button
        type="button"
        onClick={() => void saveCommunityFromDraft()}
        className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
      >
        Save content
      </button>
      <button
        type="button"
        onClick={() => {
          setSaveErr(null)
          void loadFromOrg()
          onCancel?.()
        }}
        className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
      >
        Reset changes
      </button>
      {publicHubHref ?
        <Link
          to={publicHubHref}
          className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
        >
          Preview public hub
        </Link>
      : null}
    </>
  )

  if (stickyFooter) {
    return (
      <div className="pb-[calc(var(--c2k-bottom-nav-total-h)+4.5rem)] md:pb-24">
        {editorBody}
        <SettingsStickyFooter>{actionBar}</SettingsStickyFooter>
      </div>
    )
  }

  return (
    <OrganizerPanel
      title="Overview & modules"
      description="Welcome message, FAQ, resource links, and customizable Overview modules."
      actions={
        !editing ?
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-9 rounded-xl bg-dc-accent px-3 text-sm font-medium text-dc-text hover:opacity-90"
          >
            Edit
          </button>
        : null
      }
    >
      {!editing ?
        <div className="flex flex-wrap gap-3 text-sm text-dc-text-muted">
          <span>{moduleCount} module{moduleCount === 1 ? '' : 's'}</span>
          <span>·</span>
          <span>{faqCount} FAQ item{faqCount === 1 ? '' : 's'}</span>
          <span>·</span>
          <span>{linkCount} link{linkCount === 1 ? '' : 's'}</span>
          {welcomeLen > 0 ?
            <>
              <span>·</span>
              <span>Welcome message set</span>
            </>
          : null}
        </div>
      : (
        editorBody
      )}
    </OrganizerPanel>
  )
}
