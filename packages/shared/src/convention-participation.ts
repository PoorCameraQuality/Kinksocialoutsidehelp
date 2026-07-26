/**
 * Convention participation apply windows, offer templates, and helpers.
 * Used by API routes and web apply/offer UI.
 */

export type ParticipationApplyWindow = {
  enabled: boolean
  opensAt?: string | null
  closesAt?: string | null
  introHtml?: string | null
}

export type OfferTemplateDefaults = {
  registrationCategoryId?: string | null
  letterHtml?: string | null
  feeInstructions?: string | null
  expectedHours?: number | null
}

export type ConventionParticipationSettings = {
  presenterApply?: ParticipationApplyWindow
  vendorApply?: ParticipationApplyWindow
  staffRoleId?: string | null
  volunteerRoleId?: string | null
  offerTemplates?: {
    presenter?: OfferTemplateDefaults
    vendor?: OfferTemplateDefaults
    staff?: OfferTemplateDefaults
    volunteer?: OfferTemplateDefaults
  }
  defaultOfferExpiresDays?: number | null
}

export const PARTICIPATION_OFFER_SOURCE_TYPES = [
  'presenter_request',
  'vetting_application',
  'vendor_application',
] as const

export type ParticipationOfferSourceType = (typeof PARTICIPATION_OFFER_SOURCE_TYPES)[number]

export const PARTICIPATION_OFFER_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
  'superseded',
] as const

export type ParticipationOfferStatus = (typeof PARTICIPATION_OFFER_STATUSES)[number]

export const TRUSTED_ROLE_KINDS = ['staff', 'volunteer', 'custom'] as const
export type TrustedRoleKind = (typeof TRUSTED_ROLE_KINDS)[number]

export function parseParticipationSettings(raw: unknown): ConventionParticipationSettings {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const win = (v: unknown): ParticipationApplyWindow | undefined => {
    if (!v || typeof v !== 'object') return undefined
    const w = v as Record<string, unknown>
    return {
      enabled: Boolean(w.enabled),
      opensAt: typeof w.opensAt === 'string' ? w.opensAt : null,
      closesAt: typeof w.closesAt === 'string' ? w.closesAt : null,
      introHtml: typeof w.introHtml === 'string' ? w.introHtml : null,
    }
  }
  const tmpl = (v: unknown): OfferTemplateDefaults | undefined => {
    if (!v || typeof v !== 'object') return undefined
    const t = v as Record<string, unknown>
    return {
      registrationCategoryId:
        typeof t.registrationCategoryId === 'string' ? t.registrationCategoryId : null,
      letterHtml: typeof t.letterHtml === 'string' ? t.letterHtml : null,
      feeInstructions: typeof t.feeInstructions === 'string' ? t.feeInstructions : null,
      expectedHours: typeof t.expectedHours === 'number' ? t.expectedHours : null,
    }
  }
  const templates = o.offerTemplates
  let offerTemplates: ConventionParticipationSettings['offerTemplates']
  if (templates && typeof templates === 'object') {
    const tt = templates as Record<string, unknown>
    offerTemplates = {
      presenter: tmpl(tt.presenter),
      vendor: tmpl(tt.vendor),
      staff: tmpl(tt.staff),
      volunteer: tmpl(tt.volunteer),
    }
  }
  return {
    presenterApply: win(o.presenterApply),
    vendorApply: win(o.vendorApply),
    staffRoleId: typeof o.staffRoleId === 'string' ? o.staffRoleId : null,
    volunteerRoleId: typeof o.volunteerRoleId === 'string' ? o.volunteerRoleId : null,
    offerTemplates,
    defaultOfferExpiresDays:
      typeof o.defaultOfferExpiresDays === 'number' ? o.defaultOfferExpiresDays : null,
  }
}

export function participationFromConventionSettings(
  settings: Record<string, unknown> | null | undefined,
): ConventionParticipationSettings {
  if (!settings) return {}
  return parseParticipationSettings(settings.participation)
}

export function isParticipationWindowOpen(
  window: ParticipationApplyWindow | undefined,
  now: Date = new Date(),
): boolean {
  if (!window?.enabled) return false
  if (window.opensAt) {
    const open = new Date(window.opensAt)
    if (Number.isFinite(open.getTime()) && now < open) return false
  }
  if (window.closesAt) {
    const close = new Date(window.closesAt)
    if (Number.isFinite(close.getTime()) && now > close) return false
  }
  return true
}

export type OfferMergeFields = {
  applicantName?: string
  conventionName?: string
  accessCode?: string
  boothLabel?: string
  feeAmount?: string
  expectedHours?: string
}

export function mergeOfferLetterTemplate(
  template: string,
  fields: OfferMergeFields,
): string {
  let out = template
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue
    out = out.replaceAll(`{{${key}}}`, value)
  }
  return out
}

export function formatFeeAmount(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return ''
  return `$${(cents / 100).toFixed(2)}`
}
