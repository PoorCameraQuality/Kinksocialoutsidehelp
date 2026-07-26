import { useCallback, useEffect, useState } from 'react'
import OrganizerGroupEckePanel from '@/components/organizer/OrganizerGroupEckePanel'
import GroupSettingsPanel from '@/components/organizer/admin/GroupSettingsPanel'
import ScopeBrandingPanel from '@/components/organizer/ScopeBrandingPanel'
import PaymentsPlaceholder from '@/components/organizer/PaymentsPlaceholder'
import ScopeEmailBroadcastPanel from '@/components/email/ScopeEmailBroadcastPanel'
import {
  BrandingTipsCard,
  SettingsSection,
  SettingsStatusMessage,
  SettingsSubsectionHeader,
} from '@/components/organizer/settings/settings-ui'
import {
  GroupPublicHubPreviewCard,
  GroupSettingsPageHeader,
} from '@/components/organizer/settings/group-settings-ui'
import { useGroupBrandingSettings } from '@/hooks/useGroupBrandingSettings'
import { mediaDisplayUrl } from '@/lib/media-display-url'

type GroupRecord = {
  id: string
  slug: string
  name: string
  visibility: string
  description?: string | null
  bannerUrl?: string | null
  logoUrl?: string | null
  shareImageUrl?: string | null
}

type Props = {
  groupId: string
  groupName: string
  onGroupChange?: (patch: Partial<GroupRecord>) => void
}

export default function OrganizerGroupSettingsPanel({ groupId, groupName, onGroupChange }: Props) {
  const [group, setGroup] = useState<GroupRecord | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempted, setLoadAttempted] = useState(false)

  const reloadGroup = useCallback(async () => {
    setLoadError(null)
    try {
      const r = await fetch(`/api/v1/groups/${encodeURIComponent(groupId)}`, { credentials: 'include' })
      if (!r.ok) {
        setLoadError('Could not load group settings.')
        return
      }
      const j = (await r.json()) as { group?: GroupRecord }
      if (j.group) {
        setGroup(j.group)
        onGroupChange?.({ name: j.group.name, visibility: j.group.visibility })
      } else setLoadError('Group settings unavailable.')
    } catch {
      setLoadError('Network error loading group settings.')
    } finally {
      setLoadAttempted(true)
    }
  }, [groupId, onGroupChange])

  useEffect(() => {
    void reloadGroup()
  }, [reloadGroup])

  const { msg, setMsg, uploading, uploadAsset, clearAsset } = useGroupBrandingSettings(groupId, reloadGroup)

  useEffect(() => {
    if (!msg || /fail|error|could not|network|upload/i.test(msg)) return
    const timer = window.setTimeout(() => setMsg(null), 5000)
    return () => window.clearTimeout(timer)
  }, [msg, setMsg])

  const displayName = group?.name ?? groupName
  const brandingMsgIsSuccess = Boolean(msg && !/fail|error|could not|network|upload/i.test(msg))

  return (
    <div className="space-y-5">
      <GroupSettingsPageHeader />

      {loadError ?
        <SettingsStatusMessage message={loadError} isSuccess={false} onDismiss={() => setLoadError(null)} />
      : null}

      {msg ?
        <SettingsStatusMessage message={msg} isSuccess={brandingMsgIsSuccess} onDismiss={() => setMsg(null)} />
      : null}

      {!loadAttempted ?
        <div className="space-y-5" aria-busy="true">
          <div className="h-40 animate-pulse rounded-2xl bg-dc-elevated-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-dc-elevated-muted" />
        </div>
      : loadError ? null
      : <>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
            <SettingsSection className="border-dc-border-strong/80 bg-[var(--organizer-panel-bg)]">
              <SettingsSubsectionHeader
                title="Branding"
                subtitle="Banner, logo, and link preview image for the public group page and shared links."
              />
              <ScopeBrandingPanel
                scopeLabel={displayName}
                title={displayName}
                description={group?.description ?? undefined}
                bannerUrl={group?.bannerUrl ?? null}
                logoUrl={group?.logoUrl ?? null}
                shareImageUrl={group?.shareImageUrl ?? null}
                onUpload={(k) => void uploadAsset(k)}
                onClear={(k) => void clearAsset(k)}
                uploading={uploading}
              />

              <div className="mt-6 rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 sm:p-5">
                <h4 className="text-sm font-semibold text-dc-text">Header mockup</h4>
                <p className="mt-1 text-xs text-dc-muted">How banner and logo compose on the group hub.</p>
                <div className="mt-4 overflow-hidden rounded-xl border border-dc-border">
                  <div className="aspect-[3/1] bg-dc-surface-muted">
                    {mediaDisplayUrl(group?.bannerUrl) ?
                      <img
                        src={mediaDisplayUrl(group?.bannerUrl)!}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    : (
                      <div className="flex h-full items-center justify-center text-xs text-dc-muted">
                        Upload a banner
                      </div>
                    )}
                  </div>
                  <div className="flex items-end gap-3 border-t border-dc-border p-4">
                    {mediaDisplayUrl(group?.logoUrl) ?
                      <img
                        src={mediaDisplayUrl(group?.logoUrl)!}
                        alt=""
                        className="-mt-8 h-16 w-16 shrink-0 rounded-2xl border-4 border-dc-border bg-dc-elevated-solid object-cover"
                      />
                    : (
                      <div className="-mt-8 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-4 border-dc-border bg-dc-elevated-solid text-[10px] text-dc-muted">
                        Logo
                      </div>
                    )}
                    <div className="min-w-0 pb-0.5">
                      <p className="font-semibold text-dc-text">{displayName}</p>
                      <p className="text-xs text-dc-muted">Public group hub</p>
                    </div>
                  </div>
                </div>
              </div>
            </SettingsSection>

            <aside className="space-y-5">
              {group ?
                <GroupPublicHubPreviewCard
                  groupId={group.id}
                  name={group.name}
                  visibility={group.visibility}
                  bannerUrl={group.bannerUrl ?? null}
                  logoUrl={group.logoUrl ?? null}
                />
              : null}
              <BrandingTipsCard />
            </aside>
          </div>

          <SettingsSection className="border-dc-border-strong/80 bg-[var(--organizer-panel-bg)]">
            <GroupSettingsPanel
              embedded
              groupId={groupId}
              onGroupUpdated={(g) => {
                setGroup((prev) => (prev ? { ...prev, ...g } : prev))
                onGroupChange?.({ name: g.name, visibility: g.visibility })
              }}
            />
          </SettingsSection>

          <SettingsSection className="border-dc-border-strong/80 bg-[var(--organizer-panel-bg)]">
            <SettingsSubsectionHeader
              title="Email broadcasts"
              subtitle="Send updates to members who opted in to group email."
            />
            <ScopeEmailBroadcastPanel scopeType="group" scopeKey={groupId} canManage />
          </SettingsSection>

          <OrganizerGroupEckePanel groupId={groupId} />

          <PaymentsPlaceholder />
        </>
      }
    </div>
  )
}
