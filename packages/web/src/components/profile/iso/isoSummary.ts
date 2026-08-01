import {
  ISO_APPROACH,
  ISO_CAPACITY,
  ISO_MENU_TAGS,
  ISO_PLAY_INTENT,
  ISO_ROLE_TAGS,
  ISO_SEEKING_WHO,
  ISO_SOCIAL_OFFERS,
  ISO_VENUES,
  getIsoReadiness,
  type IsoStructured,
} from '@c2k/shared'

export { getIsoReadiness }

function labelOf(id: string, opts: readonly { id: string; label: string }[]) {
  return opts.find((o) => o.id === id)?.label ?? id
}

function labels(ids: string[], opts: readonly { id: string; label: string }[], max = 4) {
  return ids
    .slice(0, max)
    .map((id) => labelOf(id, opts))
    .join(' · ')
}

export function signalSummary(s: IsoStructured): string | null {
  const roles = labels(s.roles, ISO_ROLE_TAGS, 3)
  if (!roles && s.playIntent === 'open' && !s.visualSignal.trim()) return null
  const lines = [
    [roles, labelOf(s.playIntent, ISO_PLAY_INTENT), labelOf(s.capacity, ISO_CAPACITY)].filter(Boolean).join(' · '),
    s.approach === 'visual_signal' && s.visualSignal.trim()
      ? `Signal: ${s.visualSignal.trim()}`
      : labelOf(s.approach, ISO_APPROACH),
  ]
  return lines.filter(Boolean).join('\n')
}

export function seekingSummary(s: IsoStructured): string | null {
  if (!s.seekingWho.length) return null
  if (s.seekingWho.length === 1 && s.seekingWho[0] === 'anyone') return 'Open to anyone'
  return labels(s.seekingWho, ISO_SEEKING_WHO, 5)
}

export function menuTabSummary(ids: string[]): string | null {
  if (!ids.length) return null
  return `${labels(ids, ISO_MENU_TAGS, 4)}${ids.length > 4 ? ` · +${ids.length - 4}` : ''}`
}

export function logisticsSummary(s: IsoStructured): string | null {
  const parts: string[] = []
  if (s.venues.length) parts.push(labels(s.venues, ISO_VENUES, 3))
  if (s.socialOffers.length) parts.push(labels(s.socialOffers, ISO_SOCIAL_OFFERS, 3))
  if (s.riskNotes.trim()) parts.push('Risk notes added')
  if (s.gearBringing.trim()) parts.push('Gear notes added')
  return parts.length ? parts.join('\n') : null
}

export function voiceSummary(body: string, imageCount: number, visualSignal: string): string | null {
  const parts: string[] = []
  if (body.trim()) parts.push(body.trim().slice(0, 80) + (body.trim().length > 80 ? '…' : ''))
  if (visualSignal.trim()) parts.push(`Signal: ${visualSignal.trim()}`)
  if (imageCount) parts.push(`${imageCount} image${imageCount === 1 ? '' : 's'}`)
  return parts.length ? parts.join('\n') : null
}

export function postingSummary(visibility: string, acceptDms: boolean): string {
  const vis =
    visibility === 'PUBLIC' ? 'Public' : visibility === 'PRIVATE' ? 'Private' : 'Signed-in members'
  return `${vis} · ${acceptDms ? 'DMs accepted' : 'DMs closed'}`
}

export function completionPrompt(s: IsoStructured): string {
  if (!s.roles.length) return 'Choose a role so people know how you show up'
  if (!s.seekingWho.length) return 'Say who you hope to meet'
  if (!s.pitches.length && s.into.length < 2) return 'Add one scene idea or choose two interests'
  if (!s.pitches.length) return 'Add one scene idea to help people approach'
  return 'Your card is ready'
}

/** Editor “useful card” gate — aligned with getIsoReadiness.structuredReady. */
export function isPostable(s: IsoStructured, visibility: string): boolean {
  return getIsoReadiness(s, '', visibility).structuredReady
}
