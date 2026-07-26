import { parseDiscordEmbedInput } from '@c2k/shared'

type Props = {
  channelName: string
  embedUrl?: string | null
}

export default function OrgDiscordEmbedPanel({ channelName, embedUrl }: Props) {
  const parsed = embedUrl ? parseDiscordEmbedInput(embedUrl) : null
  const config = parsed && !('error' in parsed) ? parsed : null
  const parseError = parsed && 'error' in parsed ? parsed.error : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {config?.widgetUrl ?
          <div className="mx-auto max-w-3xl">
            <iframe
              title={`${channelName} on Discord`}
              src={config.widgetUrl}
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              className="h-[min(520px,70vh)] w-full rounded-xl border border-black/30 bg-[#2f3136]"
              loading="lazy"
            />
          </div>
        : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-lg font-semibold text-zinc-200">{channelName}</p>
            <p className="mt-2 max-w-md text-sm text-zinc-400">
              {parseError ?
                'This Discord channel is misconfigured. Ask an organizer to update the server link.'
              : 'Join this organization&apos;s Discord server to participate in this channel.'}
            </p>
            {config?.inviteUrl ?
              <a
                href={config.inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#5865F2] px-5 text-sm font-semibold text-white hover:brightness-110"
              >
                Open in Discord
              </a>
            : null}
            {!config?.widgetUrl ?
              <p className="mt-4 max-w-sm text-xs leading-relaxed text-zinc-500">
                Organizers: enable the server widget in Discord (Server Settings → Widget) and add your
                server ID for an embedded view here.
              </p>
            : null}
          </div>
        )}
      </div>

      {(config?.inviteUrl || config?.widgetUrl) && (
        <div className="shrink-0 border-t border-black/30 px-4 py-3">
          {config.inviteUrl ?
            <a
              href={config.inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[#949cf7] hover:underline"
            >
              Open in Discord app →
            </a>
          : null}
          <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
            Discord chat runs on Discord&apos;s servers. Kink Social shows an embed when your organizers configure the
            server widget.
          </p>
        </div>
      )}
    </div>
  )
}
