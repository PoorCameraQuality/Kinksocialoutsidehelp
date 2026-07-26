import { parseDiscordEmbedInput } from '@c2k/shared'

export {
  buildDiscordWidgetUrl,
  isAllowedDiscordUrl,
  parseDiscordEmbedInput,
  type DiscordEmbedConfig,
} from '@c2k/shared'

/** Validate and normalize embed input for org DISCORD channels. */
export function normalizeDiscordChannelEmbed(raw: string): { embedUrl: string } | { error: string } {
  const parsed = parseDiscordEmbedInput(raw)
  if ('error' in parsed) return parsed
  return { embedUrl: parsed.normalizedInput }
}
