import { z } from 'zod'

/** Per-event skin (migration 029 `theme_config` jsonb). */
export const dancecardThemeConfigSchema = z.object({
  accent: z.string().max(32).optional(),
  surface: z.string().max(32).optional(),
  elevated: z.string().max(32).optional(),
  slotPublished: z.string().max(32).optional(),
  hallwayModeDefault: z.boolean().optional(),
})

export type DancecardThemeConfig = z.infer<typeof dancecardThemeConfigSchema>

export type PublicThemeDto = {
  accent?: string
  surface?: string
  elevated?: string
  slotPublished?: string
}

export function parseThemeConfig(raw: unknown): DancecardThemeConfig {
  if (raw == null) return {}
  const result = dancecardThemeConfigSchema.safeParse(raw)
  return result.success ? result.data : {}
}

export function themeConfigToCssVars(config: DancecardThemeConfig): Record<string, string> {
  const vars: Record<string, string> = {}
  if (config.accent) {
    vars['--event-accent'] = config.accent
    vars['--dc-accent'] = config.accent
  }
  if (config.surface) {
    vars['--event-surface'] = config.surface
    vars['--dc-surface'] = config.surface
  }
  if (config.elevated) {
    vars['--event-elevated'] = config.elevated
    vars['--dc-elevated-solid'] = config.elevated
  }
  if (config.slotPublished) {
    vars['--event-slot-published'] = config.slotPublished
    vars['--dc-slot-published'] = config.slotPublished
  }
  return vars
}

export function themeConfigForPublicApi(config: DancecardThemeConfig): PublicThemeDto {
  const out: PublicThemeDto = {}
  if (config.accent) out.accent = config.accent
  if (config.surface) out.surface = config.surface
  if (config.elevated) out.elevated = config.elevated
  if (config.slotPublished) out.slotPublished = config.slotPublished
  return out
}

export function readThemeConfigFromEventRow(event: { theme_config?: unknown } | null | undefined): DancecardThemeConfig {
  if (!event) return {}
  return parseThemeConfig((event as { theme_config?: unknown }).theme_config)
}
