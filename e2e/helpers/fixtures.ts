/** Seeded slugs from db:seed - override via env for staging. */
export const SEED = {
  orgSlug: process.env.E2E_ORG_SLUG ?? 'demo-east-collective',
  convSlug: process.env.E2E_CONV_SLUG ?? 'preview-c2k-weekend',
  convProgramSlug: process.env.E2E_CONV_PROGRAM_SLUG ?? 'seed-demo-con-program',
  demoPassword: process.env.E2E_DEMO_PASSWORD ?? 'demo',
  demoUser: process.env.E2E_DEMO_USER ?? 'RopeDreamer',
} as const

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`
}

export function organizerConventionPath(orgSlug = SEED.orgSlug, convSlug = SEED.convSlug): string {
  return `/organizer/orgs/${orgSlug}/conventions/${convSlug}`
}

export function doorPath(orgSlug = SEED.orgSlug, convSlug = SEED.convSlug): string {
  return `${organizerConventionPath(orgSlug, convSlug)}/door`
}
