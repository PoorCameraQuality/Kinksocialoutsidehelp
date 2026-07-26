'use client'

import type { ConventionCommandPermissions } from '@c2k/shared'
import DancecardAppearancePicker from '@/components/dancecard/DancecardAppearancePicker'

type Props = {
  eventSlug: string
  readOnly: boolean
  wideCanvas: boolean
  permissions?: ConventionCommandPermissions
  onOpenMenu: () => void
  onToggleWideCanvas: () => void
  onPreviewRole?: (role: 'attendee' | 'staff' | 'safety' | 'public') => void
}

export function OrganizerEventHeader({
  readOnly,
  wideCanvas,
  permissions,
  onOpenMenu,
  onToggleWideCanvas,
  onPreviewRole,
}: Props) {
  const canPreviewStaffRoles = permissions?.staffOps || permissions?.isFullAdmin
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-dc-border bg-dc-surface/95 px-3 py-2.5 backdrop-blur sm:px-6">
      <button
        type="button"
        className="shrink-0 rounded-lg border border-dc-border px-3 py-1.5 text-sm font-medium text-dc-text md:hidden"
        onClick={onOpenMenu}
      >
        Menu
      </button>

      {readOnly ? (
        <span className="rounded-lg border border-dc-warning/35 bg-dc-warning-muted px-2.5 py-1 text-xs font-medium text-dc-warning">
          Read-only
        </span>
      ) : null}

      <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:flex-none sm:basis-auto">
        <DancecardAppearancePicker compact className="hidden sm:flex" />
        <button
          type="button"
          className="hidden rounded-lg border border-dc-border px-3 py-1.5 text-xs font-medium text-dc-muted hover:text-dc-text sm:inline-flex"
          onClick={onToggleWideCanvas}
        >
          {wideCanvas ? 'Standard width' : 'Wide layout'}
        </button>
        {onPreviewRole ? (
          <select
            className="min-w-0 max-w-full flex-1 rounded-lg border border-dc-border bg-dc-elevated px-2 py-1.5 text-xs text-dc-text sm:max-w-none sm:flex-none sm:text-sm"
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value
              if (v) onPreviewRole(v as 'attendee' | 'staff' | 'safety' | 'public')
              e.target.value = ''
            }}
            aria-label="Preview public site as"
          >
            <option value="">Preview as…</option>
            <option value="attendee">Attendee</option>
            {canPreviewStaffRoles ? <option value="staff">Staff</option> : null}
            {canPreviewStaffRoles ? <option value="safety">Safety</option> : null}
            <option value="public">Public</option>
          </select>
        ) : null}
        <kbd className="hidden rounded border border-dc-border px-2 py-0.5 text-[10px] text-dc-muted lg:inline">
          ⌘K search
        </kbd>
      </div>
    </header>
  )
}
