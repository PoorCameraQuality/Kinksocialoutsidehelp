import { z } from 'zod'

const policyKindSchema = z.enum(['coc', 'waiver', 'photo', 'marketing'])

export const agreementsConfigSchema = z.object({
  mode: z.enum(['ecke', 'rabbitsign', 'hybrid']).optional().default('ecke'),
  requiredPolicyKinds: z.array(policyKindSchema).max(8).optional().default(['coc', 'waiver']),
  deadlineAt: z.string().datetime().nullable().optional(),
  rabbitsignApiKeyRef: z.string().max(120).nullable().optional(),
  webhookSecret: z.string().max(200).nullable().optional(),
})

export type AgreementsConfig = z.infer<typeof agreementsConfigSchema>
export type PolicyKind = z.infer<typeof policyKindSchema>

export function parseAgreementsConfig(raw: unknown): AgreementsConfig {
  const parsed = agreementsConfigSchema.safeParse(raw ?? {})
  if (parsed.success) return parsed.data
  return { mode: 'ecke', requiredPolicyKinds: ['coc', 'waiver'] }
}

export type RegistrantAgreementState = {
  registrantId: string
  acceptedPolicyDocumentIds: string[]
  rabbitsignStatus?: string | null
}

export type PublishedPolicyDoc = {
  id: string
  kind: PolicyKind
  version: number
  title: string
}

/** Latest published doc per kind for an event. */
export function latestPoliciesByKind(docs: PublishedPolicyDoc[]): Map<PolicyKind, PublishedPolicyDoc> {
  const map = new Map<PolicyKind, PublishedPolicyDoc>()
  for (const d of docs) {
    const prev = map.get(d.kind)
    if (!prev || d.version > prev.version) map.set(d.kind, d)
  }
  return map
}

export function requiredPolicyDocumentIds(
  config: AgreementsConfig,
  docs: PublishedPolicyDoc[],
): string[] {
  const byKind = latestPoliciesByKind(docs)
  const kinds = config.requiredPolicyKinds ?? []
  const ids: string[] = []
  for (const k of kinds) {
    const doc = byKind.get(k)
    if (doc) ids.push(doc.id)
  }
  return ids
}

export function isAgreementsComplete(
  config: AgreementsConfig,
  state: RegistrantAgreementState,
  docs: PublishedPolicyDoc[],
): boolean {
  const mode = config.mode ?? 'ecke'
  const required = requiredPolicyDocumentIds(config, docs)
  const accepted = new Set(state.acceptedPolicyDocumentIds)

  if (mode === 'rabbitsign') {
    return state.rabbitsignStatus === 'signed'
  }

  const eckeRequired =
    mode === 'ecke' || mode === 'hybrid'
      ? required.every((id) => accepted.has(id))
      : true

  if (mode === 'hybrid') {
    const rsOk = state.rabbitsignStatus === 'signed'
    return eckeRequired && rsOk
  }

  return eckeRequired
}

export function countIncompleteRegistrants(
  registrants: RegistrantAgreementState[],
  config: AgreementsConfig,
  docs: PublishedPolicyDoc[],
): number {
  return registrants.filter((r) => !isAgreementsComplete(config, r, docs)).length
}
