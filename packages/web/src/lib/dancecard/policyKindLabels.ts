export const POLICY_KIND_LABELS: Record<string, string> = {
  coc: 'Code of conduct',
  waiver: 'Liability waiver',
  photo: 'Photo / media policy',
  marketing: 'Marketing opt-in',
}

export function policyKindLabel(kind: string): string {
  return POLICY_KIND_LABELS[kind] ?? kind
}
