import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import TextInput from '@/components/ui/TextInput'
import StatusBanner from '@/components/ui/StatusBanner'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import type { MediaFormat } from '@/hooks/useApiMediaShows'

const WARNING_OPTIONS = [
  'Explicit sexual content',
  'BDSM / kink themes',
  'Strong language',
  'Violence (fantasy or discussed)',
  'Mental health topics',
]

export default function MediaSubmitPage() {
  const { isAuthenticated, status: authStatus } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mediaFormat, setMediaFormat] = useState<MediaFormat>('podcast')
  const [rssFeedUrl, setRssFeedUrl] = useState('')
  const [youtubeChannelUrl, setYoutubeChannelUrl] = useState('')
  const [spotifyShowUrl, setSpotifyShowUrl] = useState('')
  const [applePodcastsUrl, setApplePodcastsUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (authStatus === 'loading') {
    return <div className="mx-auto max-w-xl px-4 py-24 text-center text-dc-muted">Loading…</div>
  }

  if (!isAuthenticated) {
    return <Navigate to={buildLoginHref('/media/submit')} replace />
  }

  const toggleWarning = (w: string) => {
    setWarnings((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]))
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const createRes = await fetch('/api/v1/me/media/shows', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          mediaFormat,
          rssFeedUrl: rssFeedUrl.trim() || null,
          youtubeChannelUrl: youtubeChannelUrl.trim() || null,
          spotifyShowUrl: spotifyShowUrl.trim() || null,
          applePodcastsUrl: applePodcastsUrl.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
          contentWarnings: warnings,
        }),
      })
      if (!createRes.ok) {
        const j = (await createRes.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? 'Could not create channel.')
        return
      }
      const created = (await createRes.json()) as { show?: { id: string; slug: string } }
      const id = created.show?.id
      if (!id) {
        setError('Unexpected response from server.')
        return
      }
      const submitRes = await fetch(`/api/v1/me/media/shows/${encodeURIComponent(id)}/submit`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!submitRes.ok) {
        const j = (await submitRes.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? 'Created draft but submit failed.')
        return
      }
      setNotice(
        created.show?.slug ?
          `Submitted for review. You can view the draft at /media/${created.show.slug} once approved.`
        : 'Submitted for moderator review.',
      )
      setTitle('')
      setDescription('')
      setRssFeedUrl('')
      setYoutubeChannelUrl('')
      setWarnings([])
    } catch {
      setError('Network error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link to="/media" className="text-sm text-dc-accent hover:underline">
        ← Media
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-dc-text">Submit a channel</h1>
      <p className="mt-2 text-sm text-dc-muted">
        List a podcast or video channel for the community directory. Kink Social links out to your existing feeds -
        we do not host audio or video.
      </p>

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
      {notice ? <StatusBanner tone="success">{notice}</StatusBanner> : null}

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-dc-text-muted">Title</label>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-dc-text-muted">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-dc-text-muted">Format</label>
          <select
            value={mediaFormat}
            onChange={(e) => setMediaFormat(e.target.value as MediaFormat)}
            className="w-full rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm"
          >
            <option value="podcast">Podcast</option>
            <option value="video">Video / YouTube</option>
            <option value="hybrid">Hybrid (podcast and video)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-dc-text-muted">RSS feed URL (podcasts)</label>
          <TextInput value={rssFeedUrl} onChange={(e) => setRssFeedUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-dc-text-muted">YouTube channel URL</label>
          <TextInput
            value={youtubeChannelUrl}
            onChange={(e) => setYoutubeChannelUrl(e.target.value)}
            placeholder="https://youtube.com/…"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-dc-text-muted">Spotify show URL</label>
          <TextInput value={spotifyShowUrl} onChange={(e) => setSpotifyShowUrl(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-dc-text-muted">Apple Podcasts URL</label>
          <TextInput value={applePodcastsUrl} onChange={(e) => setApplePodcastsUrl(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-dc-text-muted">Website</label>
          <TextInput value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-dc-text-muted">Content warnings (required)</legend>
          <ul className="mt-2 space-y-2">
            {WARNING_OPTIONS.map((w) => (
              <li key={w}>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-dc-text-muted">
                  <input
                    type="checkbox"
                    checked={warnings.includes(w)}
                    onChange={() => toggleWarning(w)}
                  />
                  {w}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <Button type="button" disabled={busy || !title.trim() || warnings.length === 0} onClick={() => void submit()}>
          Submit for review
        </Button>
      </div>
    </div>
  )
}
