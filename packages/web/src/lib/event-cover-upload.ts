import { uploadMediaFile } from '@/lib/upload-media'

export type EventCoverUploadResult = {
  url: string
  quarantineKey?: string
}

/** Promote a staged upload and persist it as the event cover image. */
export async function attachEventCover(eventId: string, quarantineKey: string): Promise<string> {
  const r = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/cover/attach`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quarantineKey }),
  })
  const data = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!r.ok || !data.url) {
    throw new Error(data.error ?? 'Could not attach event cover')
  }
  return data.url
}

/**
 * Upload an event cover image. When `eventId` is set, promotes and attaches immediately.
 * Otherwise returns a quarantine key for attach after the event row exists.
 */
export async function uploadEventCoverFile(
  file: File,
  eventId?: string,
): Promise<EventCoverUploadResult> {
  const uploaded = await uploadMediaFile(file, 'event_cover')
  if (uploaded.status === 'url' && uploaded.url) {
    return { url: uploaded.url }
  }
  if (!uploaded.quarantineKey) {
    throw new Error('Upload did not return a quarantine key.')
  }
  if (eventId) {
    const url = await attachEventCover(eventId, uploaded.quarantineKey)
    return { url }
  }
  return { url: '', quarantineKey: uploaded.quarantineKey }
}
