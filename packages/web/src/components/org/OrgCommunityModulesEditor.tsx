import { useState } from 'react'
import { COMMUNITY_MODULE_TYPE_LABELS, type CommunityPageModule } from '@/types/org-community-modules'

function newBlockId(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function blankModule(type: CommunityPageModule['type']): CommunityPageModule {
  const id = newBlockId()
  switch (type) {
    case 'richtext':
      return { id, type: 'richtext', html: '<p>Edit this section. Links and basic formatting are allowed.</p>' }
    case 'checklist':
      return { id, type: 'checklist', title: 'New member checklist', items: [{ label: 'Read community guidelines', href: null, note: null }] }
    case 'contacts':
      return {
        id,
        type: 'contacts',
        title: 'Contacts',
        rows: [{ role: 'Safety / consent concerns', detail: 'safety@example.com', href: 'mailto:safety@example.com' }],
      }
    case 'announcements':
      return {
        id,
        type: 'announcements',
        title: 'Announcements',
        items: [{ title: 'Welcome', body: 'Replace with your org news.', dateLabel: null, link: null }],
      }
    case 'documents':
      return {
        id,
        type: 'documents',
        title: 'Documents',
        items: [{ label: 'Example PDF', url: 'https://example.com/doc.pdf', kind: 'pdf' }],
      }
    case 'volunteer':
      return {
        id,
        type: 'volunteer',
        title: 'Volunteer',
        bodyHtml: '<p>We need door, setup, and teardown help.</p>',
        signupUrl: null,
      }
    case 'featured_vendors':
      return { id, type: 'featured_vendors', title: 'Featured partners', maxItems: 6, emptyMessage: 'Partners coming soon.' }
    case 'featured_articles':
      return {
        id,
        type: 'featured_articles',
        title: 'Featured reading',
        maxItems: 6,
        emptyMessage: 'No featured articles yet. Org admins manage this list.',
      }
    case 'event_picks':
      return {
        id,
        type: 'event_picks',
        title: 'Upcoming highlights',
        maxItems: 4,
        filter: 'upcoming',
        noteHtml: '<p>Curated from the org calendar.</p>',
      }
    case 'reporting':
      return {
        id,
        type: 'reporting',
        title: 'Safety & reporting',
        introHtml:
          '<p>Use the button below for in-app reports to moderators. For emergencies, follow your local protocols.</p>',
        reportUrl: null,
        policyHtml:
          '<p>Reports are reviewed by org moderators. You may not receive a personal reply, but reports affect safety planning.</p>',
      }
    default:
      return { id, type: 'richtext', html: '<p></p>' }
  }
}

function PayloadFields({
  m,
  onChange,
}: {
  m: CommunityPageModule
  onChange: (next: CommunityPageModule) => void
}) {
  switch (m.type) {
    case 'richtext':
      return (
        <div className="space-y-2">
          <label className="text-xs text-dc-muted">HTML</label>
          <textarea
            value={m.html}
            onChange={(e) => onChange({ ...m, html: e.target.value })}
            rows={5}
            className="w-full bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text font-mono"
          />
          <label className="text-xs text-dc-muted">Variant</label>
          <select
            value={m.variant ?? 'default'}
            onChange={(e) => onChange({ ...m, variant: e.target.value as 'default' | 'callout' | 'muted' })}
            className="w-full max-w-xs bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text"
          >
            <option value="default">Default card</option>
            <option value="callout">Callout (amber)</option>
            <option value="muted">Muted</option>
          </select>
        </div>
      )
    case 'checklist':
      return (
        <div className="space-y-2">
          {m.items.map((it, i) => (
            <div key={i} className="flex flex-col gap-1 border border-dc-border rounded-lg p-2">
              <input
                value={it.label}
                onChange={(e) => {
                  const items = [...m.items]
                  items[i] = { ...items[i]!, label: e.target.value }
                  onChange({ ...m, items })
                }}
                placeholder="Label"
                className="bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
              />
              <input
                value={it.href ?? ''}
                onChange={(e) => {
                  const items = [...m.items]
                  items[i] = { ...items[i]!, href: e.target.value.trim() || null }
                  onChange({ ...m, items })
                }}
                placeholder="https://… (optional)"
                className="bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
              />
              <input
                value={it.note ?? ''}
                onChange={(e) => {
                  const items = [...m.items]
                  items[i] = { ...items[i]!, note: e.target.value.trim() || null }
                  onChange({ ...m, items })
                }}
                placeholder="Note (optional)"
                className="bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
              />
              <button type="button" className="text-xs text-red-400 self-start" onClick={() => onChange({ ...m, items: m.items.filter((_, j) => j !== i) })}>
                Remove step
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs text-dc-accent"
            onClick={() => onChange({ ...m, items: [...m.items, { label: '', href: null, note: null }] })}
          >
            + Step
          </button>
        </div>
      )
    case 'contacts':
      return (
        <div className="space-y-2">
          {m.rows.map((row, i) => (
            <div key={i} className="grid sm:grid-cols-3 gap-2 border border-dc-border rounded-lg p-2">
              <input
                value={row.role}
                onChange={(e) => {
                  const rows = [...m.rows]
                  rows[i] = { ...rows[i]!, role: e.target.value }
                  onChange({ ...m, rows })
                }}
                placeholder="Role"
                className="bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
              />
              <input
                value={row.detail}
                onChange={(e) => {
                  const rows = [...m.rows]
                  rows[i] = { ...rows[i]!, detail: e.target.value }
                  onChange({ ...m, rows })
                }}
                placeholder="Email / detail"
                className="bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
              />
              <input
                value={row.href ?? ''}
                onChange={(e) => {
                  const rows = [...m.rows]
                  rows[i] = { ...rows[i]!, href: e.target.value.trim() || null }
                  onChange({ ...m, rows })
                }}
                placeholder="https:// or mailto: (optional)"
                className="bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
              />
              <button type="button" className="text-xs text-red-400 sm:col-span-3" onClick={() => onChange({ ...m, rows: m.rows.filter((_, j) => j !== i) })}>
                Remove row
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs text-dc-accent"
            onClick={() => onChange({ ...m, rows: [...m.rows, { role: '', detail: '', href: null }] })}
          >
            + Contact row
          </button>
        </div>
      )
    case 'announcements':
      return (
        <div className="space-y-3">
          {m.items.map((it, i) => (
            <div key={i} className="border border-dc-border rounded-lg p-2 space-y-1">
              <input
                value={it.title}
                onChange={(e) => {
                  const items = [...m.items]
                  items[i] = { ...items[i]!, title: e.target.value }
                  onChange({ ...m, items })
                }}
                className="w-full bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
                placeholder="Title"
              />
              <textarea
                value={it.body}
                onChange={(e) => {
                  const items = [...m.items]
                  items[i] = { ...items[i]!, body: e.target.value }
                  onChange({ ...m, items })
                }}
                rows={2}
                className="w-full bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
                placeholder="Body"
              />
              <input
                value={it.dateLabel ?? ''}
                onChange={(e) => {
                  const items = [...m.items]
                  items[i] = { ...items[i]!, dateLabel: e.target.value.trim() || null }
                  onChange({ ...m, items })
                }}
                className="w-full bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
                placeholder="Date label (optional)"
              />
              <input
                value={it.link ?? ''}
                onChange={(e) => {
                  const items = [...m.items]
                  items[i] = { ...items[i]!, link: e.target.value.trim() || null }
                  onChange({ ...m, items })
                }}
                className="w-full bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
                placeholder="Link (optional)"
              />
              <button type="button" className="text-xs text-red-400" onClick={() => onChange({ ...m, items: m.items.filter((_, j) => j !== i) })}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="text-xs text-dc-accent" onClick={() => onChange({ ...m, items: [...m.items, { title: '', body: '', dateLabel: null, link: null }] })}>
            + Announcement
          </button>
        </div>
      )
    case 'documents':
      return (
        <div className="space-y-2">
          {m.items.map((it, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-center border border-dc-border rounded-lg p-2">
              <input
                value={it.label}
                onChange={(e) => {
                  const items = [...m.items]
                  items[i] = { ...items[i]!, label: e.target.value }
                  onChange({ ...m, items })
                }}
                className="flex-1 min-w-[120px] bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
                placeholder="Label"
              />
              <input
                value={it.url}
                onChange={(e) => {
                  const items = [...m.items]
                  items[i] = { ...items[i]!, url: e.target.value }
                  onChange({ ...m, items })
                }}
                className="flex-1 min-w-[160px] bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
                placeholder="https://…"
              />
              <select
                value={it.kind ?? 'link'}
                onChange={(e) => {
                  const items = [...m.items]
                  items[i] = { ...items[i]!, kind: e.target.value as 'pdf' | 'doc' | 'sheet' | 'link' | 'other' }
                  onChange({ ...m, items })
                }}
                className="bg-dc-surface-muted border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
              >
                <option value="pdf">pdf</option>
                <option value="doc">doc</option>
                <option value="sheet">sheet</option>
                <option value="link">link</option>
                <option value="other">other</option>
              </select>
              <button type="button" className="text-xs text-red-400" onClick={() => onChange({ ...m, items: m.items.filter((_, j) => j !== i) })}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="text-xs text-dc-accent" onClick={() => onChange({ ...m, items: [...m.items, { label: '', url: 'https://example.com', kind: 'link' }] })}>
            + Document
          </button>
        </div>
      )
    case 'volunteer':
      return (
        <div className="space-y-2">
          <label className="text-xs text-dc-muted">Body HTML</label>
          <textarea
            value={m.bodyHtml ?? ''}
            onChange={(e) => onChange({ ...m, bodyHtml: e.target.value || null })}
            rows={4}
            className="w-full bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text font-mono"
          />
          <label className="text-xs text-dc-muted">Signup URL</label>
          <input
            value={m.signupUrl ?? ''}
            onChange={(e) => onChange({ ...m, signupUrl: e.target.value.trim() || null })}
            className="w-full bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text"
            placeholder="https://…"
          />
        </div>
      )
    case 'featured_vendors':
      return (
        <div className="space-y-2">
          <label className="text-xs text-dc-muted">Max items</label>
          <input
            type="number"
            min={1}
            max={24}
            value={m.maxItems ?? 6}
            onChange={(e) => onChange({ ...m, maxItems: Math.min(24, Math.max(1, Number(e.target.value) || 6)) })}
            className="w-24 bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text"
          />
          <label className="text-xs text-dc-muted">Empty message</label>
          <input
            value={m.emptyMessage ?? ''}
            onChange={(e) => onChange({ ...m, emptyMessage: e.target.value })}
            className="w-full bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text"
          />
          <p className="text-[11px] text-dc-muted">Vendor list is managed via featured-vendors API (seed adds a demo row).</p>
        </div>
      )
    case 'featured_articles':
      return (
        <div className="space-y-2">
          <label className="text-xs text-dc-muted">Max items</label>
          <input
            type="number"
            min={1}
            max={24}
            value={m.maxItems ?? 6}
            onChange={(e) => onChange({ ...m, maxItems: Math.min(24, Math.max(1, Number(e.target.value) || 6)) })}
            className="w-24 bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text"
          />
          <label className="text-xs text-dc-muted">Empty message</label>
          <input
            value={m.emptyMessage ?? ''}
            onChange={(e) => onChange({ ...m, emptyMessage: e.target.value })}
            className="w-full bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text"
          />
          <p className="text-[11px] text-dc-muted">Article IDs are pinned via PUT /organizations/:orgKey/featured-articles.</p>
        </div>
      )
    case 'event_picks':
      return (
        <div className="space-y-2">
          <label className="text-xs text-dc-muted">Max events</label>
          <input
            type="number"
            min={1}
            max={12}
            value={m.maxItems ?? 4}
            onChange={(e) => onChange({ ...m, maxItems: Math.min(12, Math.max(1, Number(e.target.value) || 4)) })}
            className="w-24 bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text"
          />
          <label className="text-xs text-dc-muted">Filter</label>
          <select
            value={m.filter ?? 'upcoming'}
            onChange={(e) => onChange({ ...m, filter: e.target.value as 'upcoming' | 'beginner_friendly' })}
            className="w-full max-w-xs bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text"
          >
            <option value="upcoming">Upcoming</option>
            <option value="beginner_friendly">Beginner-friendly (title heuristics)</option>
          </select>
          <label className="text-xs text-dc-muted">Note HTML</label>
          <textarea
            value={m.noteHtml ?? ''}
            onChange={(e) => onChange({ ...m, noteHtml: e.target.value || null })}
            rows={3}
            className="w-full bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text font-mono"
          />
        </div>
      )
    case 'reporting':
      return (
        <div className="space-y-2">
          <label className="text-xs text-dc-muted">Intro HTML</label>
          <textarea
            value={m.introHtml}
            onChange={(e) => onChange({ ...m, introHtml: e.target.value })}
            rows={4}
            className="w-full bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text font-mono"
          />
          <label className="text-xs text-dc-muted">External report URL (optional)</label>
          <input
            value={m.reportUrl ?? ''}
            onChange={(e) => onChange({ ...m, reportUrl: e.target.value.trim() || null })}
            className="w-full bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text"
          />
          <label className="text-xs text-dc-muted">Policy HTML (optional, collapsible)</label>
          <textarea
            value={m.policyHtml ?? ''}
            onChange={(e) => onChange({ ...m, policyHtml: e.target.value || null })}
            rows={4}
            className="w-full bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text font-mono"
          />
        </div>
      )
    default:
      return null
  }
}

export default function OrgCommunityModulesEditor({
  modules,
  onChange,
}: {
  modules: CommunityPageModule[]
  onChange: (next: CommunityPageModule[]) => void
}) {
  const [addType, setAddType] = useState<CommunityPageModule['type']>('richtext')

  function updateAt(i: number, next: CommunityPageModule) {
    const copy = [...modules]
    copy[i] = next
    onChange(copy)
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= modules.length) return
    const copy = [...modules]
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
    onChange(copy)
  }

  return (
    <div className="border border-dc-border rounded-xl p-4 space-y-4 bg-dc-elevated-solid/30">
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div>
          <h4 className="text-sm font-semibold text-dc-text">Community page modules</h4>
          <p className="text-xs text-dc-muted mt-1 max-w-xl">
            Stack and reorder sections on Overview (below “Start here”). Each block can be toggled off without deleting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <select
            value={addType}
            onChange={(e) => setAddType(e.target.value as CommunityPageModule['type'])}
            className="bg-dc-surface-muted border border-dc-border rounded-lg px-2 py-1.5 text-sm text-dc-text"
          >
            {(Object.keys(COMMUNITY_MODULE_TYPE_LABELS) as CommunityPageModule['type'][]).map((t) => (
              <option key={t} value={t}>
                {COMMUNITY_MODULE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange([...modules, blankModule(addType)])}
            className="px-3 py-1.5 rounded-lg bg-dc-accent text-dc-text text-sm"
          >
            Add module
          </button>
        </div>
      </div>

      {modules.length === 0 ?
        <p className="text-sm text-dc-muted">No extra modules · Overview shows only Start here, This week, FAQ, etc.</p>
      : <ul className="space-y-3">
          {modules.map((m, i) => (
            <li key={m.id} className="rounded-xl border border-dc-border p-3 space-y-2 bg-dc-surface-muted">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase text-dc-muted">{COMMUNITY_MODULE_TYPE_LABELS[m.type]}</span>
                <label className="flex items-center gap-1 text-xs text-dc-text-muted">
                  <input
                    type="checkbox"
                    checked={m.enabled !== false}
                    onChange={(e) => updateAt(i, { ...m, enabled: e.target.checked })}
                  />
                  Visible
                </label>
                <input
                  value={m.title ?? ''}
                  onChange={(e) => updateAt(i, { ...m, title: e.target.value.trim() || null })}
                  placeholder="Section title override"
                  className="flex-1 min-w-[140px] bg-dc-elevated-solid border border-dc-border rounded px-2 py-1 text-sm text-dc-text"
                />
                <button type="button" className="text-xs text-dc-muted hover:text-dc-text" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button type="button" className="text-xs text-dc-muted hover:text-dc-text" onClick={() => move(i, 1)} disabled={i === modules.length - 1}>
                  ↓
                </button>
                <button type="button" className="text-xs text-red-400" onClick={() => onChange(modules.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
              <PayloadFields m={m} onChange={(next) => updateAt(i, next)} />
            </li>
          ))}
        </ul>
      }
    </div>
  )
}
