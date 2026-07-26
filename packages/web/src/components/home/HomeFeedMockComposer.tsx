import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { addMockLocalPost, demoMockImageUrl, getMockPersonByUsername } from '@/data/mock-data'
import PostComposerModeBar from '@/components/home/PostComposerModeBar'
import FeedComposerQuickActions from '@/components/home/FeedComposerQuickActions'

/** Short CC0 sample for mock-only audio attachment preview. */
const MOCK_AUDIO_SAMPLE_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3'

type Props = {
  viewerUsername: string | null
  onPosted: () => void
  showQuickActions?: boolean
  composerPlaceholder?: string
  compact?: boolean
  shellMode?: 'desktop' | 'mobile'
}

export default function HomeFeedMockComposer({
  viewerUsername,
  onPosted,
  showQuickActions,
  composerPlaceholder = "What's happening near you?",
  compact = false,
  shellMode,
}: Props) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [audioUrls, setAudioUrls] = useState<string[]>([])

  const addDemoImage = useCallback(() => {
    setImageUrls((u) => [...u, demoMockImageUrl(`mock-feed-${Date.now()}-${u.length}`, 720, 480)])
  }, [])

  const addDemoAudio = useCallback(() => {
    setAudioUrls((u) => [...u, MOCK_AUDIO_SAMPLE_URL])
  }, [])

  const hasDraft = text.trim().length > 0 || imageUrls.length > 0 || audioUrls.length > 0

  const canPost = Boolean(viewerUsername) && hasDraft

  const submit = useCallback(() => {
    if (!viewerUsername || !canPost) return
    const person = getMockPersonByUsername(viewerUsername)
    addMockLocalPost({
      authorUsername: viewerUsername,
      authorTrustScore: person?.trustScore ?? 80,
      text: text.trim(),
      kind: 'status',
      title: null,
      imageUrls: imageUrls.length ? imageUrls : undefined,
      audioUrls: audioUrls.length ? audioUrls : undefined,
    })
    setText('')
    setImageUrls([])
    setAudioUrls([])
    onPosted()
  }, [viewerUsername, canPost, text, imageUrls, audioUrls, onPosted])

  return (
    <div className="space-y-2">
      {!showQuickActions ? <PostComposerModeBar /> : null}
      <label className="sr-only" htmlFor="mock-composer-body">
        Post body
      </label>
      <textarea
        id="mock-composer-body"
        placeholder={composerPlaceholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={shellMode === 'desktop' && !focused ? 1 : compact ? 2 : 3}
        className={`w-full resize-none rounded-xl border border-dc-border/60 bg-white/[0.03] px-3 py-2.5 text-sm text-dc-text placeholder-dc-muted focus:border-[rgba(214,178,59,0.35)] focus:outline-none focus:ring-1 focus:ring-dc-accent/40 ${
          shellMode === 'desktop' && !focused ? 'min-h-11' : ''
        }`}
      />
      {showQuickActions ?
        <FeedComposerQuickActions
          onPhoto={addDemoImage}
          variant={
            shellMode === 'mobile' ? 'home-mobile'
            : shellMode === 'desktop' ? 'home-desktop'
            : 'full'
          }
        />
      : null}
      {(imageUrls.length > 0 || audioUrls.length > 0) && (
        <ul className="flex flex-wrap gap-2 text-[11px] text-dc-muted">
          {imageUrls.map((url, i) => (
            <li
              key={`img-${url.slice(-24)}-${i}`}
              className="inline-flex items-center gap-1 rounded-md border border-dc-border bg-dc-elevated-muted px-2 py-1"
            >
              Image {i + 1}
              <button
                type="button"
                className="text-dc-text-muted hover:text-dc-text"
                onClick={() => setImageUrls((xs) => xs.filter((_, j) => j !== i))}
                aria-label={`Remove image ${i + 1}`}
              >
                ×
              </button>
            </li>
          ))}
          {audioUrls.map((_url, i) => (
            <li
              key={`aud-${i}`}
              className="inline-flex items-center gap-1 rounded-md border border-dc-border bg-dc-elevated-muted px-2 py-1"
            >
              Audio {i + 1}
              <button
                type="button"
                className="text-dc-text-muted hover:text-dc-text"
                onClick={() => setAudioUrls((xs) => xs.filter((_, j) => j !== i))}
                aria-label={`Remove audio ${i + 1}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {(!shellMode || shellMode === 'mobile' || focused || hasDraft) && (
          <>
        {shellMode !== 'mobile' && (!shellMode || focused || hasDraft) ?
        <div className="mr-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addDemoImage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dc-border px-2.5 py-1.5 text-xs font-medium text-dc-text-muted transition-colors hover:bg-dc-elevated-muted hover:text-dc-text"
          >
            <svg className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>Image</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addDemoAudio}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dc-border px-2.5 py-1.5 text-xs font-medium text-dc-text-muted transition-colors hover:bg-dc-elevated-muted hover:text-dc-text"
          >
            <svg className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            <span>Audio</span>
          </button>
        </div>
        : null}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
          disabled={!canPost}
          className="min-h-10 shrink-0 rounded-lg bg-dc-accent px-4 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Post
        </button>
          </>
        )}
      </div>
      {!shellMode ?
      <p className="text-[11px] text-dc-muted">
        Mock mode: Image/Audio attach demo URLs. Full account uses rich text and uploads.{' '}
        <Link to="/education/write" className="text-dc-accent hover:underline">
          Long-form education article
        </Link>
        .
      </p>
      : null}
    </div>
  )
}
