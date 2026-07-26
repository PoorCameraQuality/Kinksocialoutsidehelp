import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Rules documented as known non-blocking in docs/UI_TESTING_CONTRACT.md */
export const AXE_KNOWN_NON_BLOCKING_RULES = [
  'color-contrast',
  'color-contrast-enhanced',
] as const

export type AxeScanOptions = {
  /** Additional rules to ignore for this scan (beyond the global non-blocking list). */
  disableRules?: string[]
  /** When true, also fail on moderate violations (default: serious + critical only). */
  includeModerate?: boolean
}

/**
 * Fail on serious/critical axe violations. Minor contrast issues are non-blocking by default.
 */
export async function expectNoSeriousAxeViolations(page: Page, opts?: AxeScanOptions): Promise<void> {
  const disabled = [...AXE_KNOWN_NON_BLOCKING_RULES, ...(opts?.disableRules ?? [])]
  const results = await new AxeBuilder({ page }).disableRules(disabled).analyze()

  const blocking = results.violations.filter((v) => {
    if (v.impact === 'critical' || v.impact === 'serious') return true
    return opts?.includeModerate === true && v.impact === 'moderate'
  })

  if (blocking.length > 0) {
    const summary = blocking
      .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`)
      .join('\n')
    expect(blocking, `axe violations on ${page.url()}:\n${summary}`).toEqual([])
  }
}
