/** Discord server widget + invite parsing for org chat embed channels. */

const DISCORD_HOSTS = new Set(['discord.com', 'www.discord.com', 'discord.gg', 'www.discord.gg'])

export type DiscordEmbedConfig = {
  /** iframe src when the server widget can be shown */
  widgetUrl: string | null
  /** Permanent invite link for “Open in Discord” */
  inviteUrl: string | null
  /** Value stored on the channel row */
  normalizedInput: string
}

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value)
}

export function buildDiscordWidgetUrl(serverId: string, theme: 'dark' | 'light' = 'dark'): string {
  const u = new URL('https://discord.com/widget')
  u.searchParams.set('id', serverId)
  u.searchParams.set('theme', theme)
  return u.toString()
}

function isDiscordHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return DISCORD_HOSTS.has(h) || h.endsWith('.discord.com')
}

export function isAllowedDiscordUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'https:') return false
    return isDiscordHostname(u.hostname)
  } catch {
    return false
  }
}

/**
 * Parse organizer Discord input: server ID, widget URL, invite URL, or channels link.
 * Returns a widget URL when the server ID is known. Otherwise returns an invite URL.
 */
export function parseDiscordEmbedInput(raw: string): DiscordEmbedConfig | { error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { error: 'Discord server ID or invite URL is required' }

  if (isSnowflake(trimmed)) {
    return {
      widgetUrl: buildDiscordWidgetUrl(trimmed),
      inviteUrl: null,
      normalizedInput: trimmed,
    }
  }

  if (!isAllowedDiscordUrl(trimmed)) {
    return { error: 'Use a https://discord.com or https://discord.gg link, or paste your server ID' }
  }

  const u = new URL(trimmed)

  if (u.hostname.includes('discord.com') && u.pathname.startsWith('/widget')) {
    const id = u.searchParams.get('id')
    if (!id || !isSnowflake(id)) return { error: 'Widget URL must include a valid server id' }
    return {
      widgetUrl: buildDiscordWidgetUrl(id),
      inviteUrl: null,
      normalizedInput: trimmed,
    }
  }

  const channelsMatch = u.pathname.match(/^\/channels\/(\d{17,20})(?:\/|$)/)
  if (channelsMatch) {
    const serverId = channelsMatch[1]!
    return {
      widgetUrl: buildDiscordWidgetUrl(serverId),
      inviteUrl: trimmed,
      normalizedInput: trimmed,
    }
  }

  const inviteMatch = u.pathname.match(/^\/invite\/([^/]+)$/i) || (u.hostname.includes('discord.gg') && u.pathname.slice(1))
  if (inviteMatch) {
    const code = typeof inviteMatch === 'string' ? inviteMatch : inviteMatch[1]
    if (!code) return { error: 'Invalid Discord invite link' }
    const inviteUrl = u.hostname.includes('discord.gg') ? trimmed : `https://discord.gg/${code}`
    return {
      widgetUrl: null,
      inviteUrl,
      normalizedInput: inviteUrl,
    }
  }

  if (u.hostname.includes('discord.gg') && u.pathname.length > 1) {
    const inviteUrl = `https://discord.gg${u.pathname}`
    return { widgetUrl: null, inviteUrl, normalizedInput: inviteUrl }
  }

  return { error: 'Unrecognized Discord URL. Use an invite link or server widget URL' }
}
