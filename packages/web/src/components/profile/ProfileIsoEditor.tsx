import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ISO_APPROACH,
  ISO_BODY_MAX,
  ISO_CAPACITY,
  ISO_MENU_TAGS,
  ISO_PITCH_MAX,
  ISO_PLAY_INTENT,
  ISO_ROLE_TAGS,
  ISO_SEEKING_WHO,
  ISO_SOCIAL_OFFERS,
  ISO_VENUES,
  emptyIsoStructured,
  isoStructuredHasContent,
  normalizeIsoStructured,
  type IsoScenePitch,
  type IsoStructured,
} from '@c2k/shared'
import PhotoUpload from '@/components/PhotoUpload'
import IsoShareActions from '@/components/profile/IsoShareActions'
import ChipGroup from '@/components/profile/iso/ChipGroup'
import IsoLivePreview from '@/components/profile/iso/IsoLivePreview'
import IsoSection from '@/components/profile/iso/IsoSection'
import IsoStickySaveBar from '@/components/profile/iso/IsoStickySaveBar'
import ScenePitchCard from '@/components/profile/iso/ScenePitchCard'
import ScenePitchComposer from '@/components/profile/iso/ScenePitchComposer'
import TagBrowserSheet from '@/components/profile/iso/TagBrowserSheet'
import {
  completionPrompt,
  isPostable,
  logisticsSummary,
  menuTabSummary,
  postingSummary,
  seekingSummary,
  signalSummary,
  voiceSummary,
} from '@/components/profile/iso/isoSummary'
import { useAuth } from '@/contexts/AuthContext'
import { uploadIsoImage } from '@/lib/iso-image-upload'

type MeIsoResponse = {
  post: {
    body: string
    visibility: string
    acceptDmsViaIso: boolean
    updatedAt: string
    structured?: unknown
  } | null
  images: { sortOrder: number; url: string }[]
}

type SectionId =
  | 'signal'
  | 'seeking'
  | 'scenes'
  | 'menu'
  | 'logistics'
  | 'voice'
  | 'posting'

type MenuTab = 'into' | 'curious' | 'hardNos'

const VIS_OPTIONS = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'MEMBERS', label: 'Event attendees / members' },
  { value: 'PRIVATE', label: 'Private' },
] as const

const ONBOARDING_KEY = 'dc-iso-onboarding-v1'

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export default function ProfileIsoEditor({
  compact = false,
  variant = 'profile',
  hideChrome = false,
  onSaved,
  onDraftChange,
}: {
  compact?: boolean
  /** Play Space shell supplies page chrome; editor focuses on sections + sticky save. */
  variant?: 'profile' | 'play-space'
  hideChrome?: boolean
  onSaved?: (info: { ready: boolean; visibility: string }) => void
  onDraftChange?: (draft: {
    body: string
    visibility: string
    structured: IsoStructured
    ready: boolean
    hasPublished: boolean
  }) => void
} = {}) {
  const { viewerUsername } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [structured, setStructured] = useState<IsoStructured>(() => emptyIsoStructured())
  const [visibility, setVisibility] = useState('MEMBERS')
  const [acceptDmsViaIso, setAcceptDmsViaIso] = useState(false)
  const [images, setImages] = useState<string[]>(['', '', ''])
  const [uploadSlot, setUploadSlot] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [openSection, setOpenSection] = useState<SectionId | null>('signal')
  const [menuTab, setMenuTab] = useState<MenuTab>('into')
  const [tagSheet, setTagSheet] = useState<MenuTab | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingPitch, setEditingPitch] = useState<IsoScenePitch | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState<0 | 1 | 2 | 3 | null>(null)
  const [showExtraPitches, setShowExtraPitches] = useState(false)

  const patch = useCallback((fn: (prev: IsoStructured) => IsoStructured) => {
    setStructured((prev) => fn(prev))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch('/api/v1/me/iso', { credentials: 'include' })
      if (r.status === 401) {
        setErr('Sign in to edit your ISO.')
        setLoading(false)
        return
      }
      if (!r.ok) {
        setErr('Could not load ISO.')
        setLoading(false)
        return
      }
      const data = (await r.json()) as MeIsoResponse
      if (data.post) {
        setBody(data.post.body)
        setVisibility(data.post.visibility)
        setAcceptDmsViaIso(data.post.acceptDmsViaIso)
        const s = normalizeIsoStructured(data.post.structured)
        setStructured(s)
        setSavedAt(data.post.updatedAt)
        const done = localStorage.getItem(ONBOARDING_KEY) === '1'
        if (!done && !isoStructuredHasContent(s) && !data.post.body.trim()) {
          setOnboardingStep(1)
        } else {
          setOnboardingStep(null)
          setOpenSection(s.pitches.length ? null : 'scenes')
        }
      } else {
        setBody('')
        setVisibility('MEMBERS')
        setAcceptDmsViaIso(false)
        setStructured(emptyIsoStructured())
        if (localStorage.getItem(ONBOARDING_KEY) !== '1') setOnboardingStep(1)
      }
      const urls = ['', '', '']
      for (const im of data.images ?? []) {
        if (im.sortOrder >= 0 && im.sortOrder < 3) urls[im.sortOrder] = im.url
      }
      setImages(urls)
    } catch {
      setErr('Network error loading ISO.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!ok) return
    const t = window.setTimeout(() => setOk(null), 4000)
    return () => window.clearTimeout(t)
  }, [ok])

  const imageCount = images.filter((u) => u.trim()).length
  const prompt = completionPrompt(structured)
  const ready = isPostable(structured, visibility)
  const hasPublished = Boolean(savedAt)
  const playSpace = variant === 'play-space'

  useEffect(() => {
    onDraftChange?.({
      body,
      visibility,
      structured,
      ready,
      hasPublished,
    })
    // Parent callbacks are often inline; sync on draft fields only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-render loops from unstable onDraftChange
  }, [body, visibility, structured, ready, hasPublished])

  const save = async (fromOnboarding = false) => {
    setSaving(true)
    setErr(null)
    setOk(null)
    const cleaned = images.map((u) => u.trim()).filter(Boolean)
    const normalized = normalizeIsoStructured(structured)
    try {
      const r = await fetch('/api/v1/me/iso', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body,
          visibility,
          acceptDmsViaIso,
          images: cleaned,
          structured: normalized,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(typeof j.error === 'string' ? j.error : 'Save failed')
        return
      }
      setOk('Saved just now')
      setSavedAt(new Date().toISOString())
      if (fromOnboarding) {
        localStorage.setItem(ONBOARDING_KEY, '1')
        setOnboardingStep(null)
      }
      await load()
      onSaved?.({ ready: isPostable(normalized, visibility), visibility })
    } catch {
      setErr('Network error while saving.')
    } finally {
      setSaving(false)
    }
  }

  const onPhotoPick = async (slot: number, file: File) => {
    setUploading(true)
    setErr(null)
    try {
      const result = await uploadIsoImage(file)
      setUploadSlot(null)
      if (!result.ok) {
        setErr(result.error)
        return
      }
      setImages((prev) => {
        const next = [...prev]
        next[slot] = result.url
        return next
      })
      setOk('Image uploaded — remember to save.')
    } finally {
      setUploading(false)
    }
  }

  const toggleSection = (id: SectionId) => {
    setOpenSection((cur) => (cur === id ? null : id))
  }

  const visiblePitches = useMemo(() => {
    if (showExtraPitches || structured.pitches.length <= 5) return structured.pitches
    return structured.pitches.slice(0, 5)
  }, [structured.pitches, showExtraPitches])

  if (loading) return <p className="text-sm text-dc-muted">Loading your ISO…</p>

  if (onboardingStep) {
    return (
      <div className="mx-auto max-w-xl space-y-6 pb-[calc(var(--c2k-mobile-action-clearance)+1rem)] lg:pb-28">
        <div>
          <p className="text-[13px] text-dc-muted">Step {onboardingStep} of 3</p>
          <h2 className="mt-1 text-[26px] font-semibold text-dc-text">
            {onboardingStep === 1
              ? 'How are you showing up?'
              : onboardingStep === 2
                ? 'Build your menu'
                : 'What could someone invite you into?'}
          </h2>
          <p className="mt-1 text-[15px] text-dc-text-muted">
            {onboardingStep === 1
              ? 'Choose the signals people should understand before they approach.'
              : onboardingStep === 2
                ? 'Pick a few things you would genuinely enjoy discussing.'
                : 'A good scene pitch gives someone a comfortable way to start a conversation.'}
          </p>
        </div>

        {onboardingStep === 1 ? (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">Roles</p>
              <ChipGroup
                options={ISO_ROLE_TAGS}
                selected={structured.roles}
                tone="role"
                onToggle={(id) => patch((p) => ({ ...p, roles: toggleId(p.roles, id) }))}
              />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">Play intent</p>
              <ChipGroup
                options={ISO_PLAY_INTENT}
                selected={structured.playIntent}
                exclusive
                onToggle={(id) => patch((p) => ({ ...p, playIntent: id as IsoStructured['playIntent'] }))}
              />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">How available are you?</p>
              <ChipGroup
                options={ISO_CAPACITY}
                selected={structured.capacity}
                exclusive
                onToggle={(id) => patch((p) => ({ ...p, capacity: id as IsoStructured['capacity'] }))}
              />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">How should someone approach?</p>
              <ChipGroup
                options={ISO_APPROACH}
                selected={structured.approach}
                exclusive
                onToggle={(id) => patch((p) => ({ ...p, approach: id as IsoStructured['approach'] }))}
              />
              {structured.approach === 'visual_signal' ? (
                <input
                  className="mt-3 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
                  value={structured.visualSignal}
                  onChange={(e) => patch((p) => ({ ...p, visualSignal: e.target.value.slice(0, 120) }))}
                  placeholder="Silver wrist cuff, red bandana, ask about the rope bag…"
                />
              ) : null}
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">Discord (optional)</p>
              <p className="mb-2 text-[12px] text-dc-muted">
                Shown on your shareable ISO card when people see it outside kink.social.
              </p>
              <input
                className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated px-3 text-[15px] text-dc-text"
                value={structured.discordHandle}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    discordHandle: e.target.value.replace(/^@+/, '').slice(0, 64),
                  }))
                }
                placeholder="yourhandle"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button
              type="button"
              disabled={!structured.roles.length}
              onClick={() => setOnboardingStep(2)}
              className="min-h-11 w-full rounded-full bg-dc-accent text-sm font-semibold text-dc-accent-foreground disabled:opacity-40"
            >
              Choose what sounds good
            </button>
          </div>
        ) : null}

        {onboardingStep === 2 ? (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">Into</p>
              <ChipGroup
                options={ISO_MENU_TAGS.slice(0, 12)}
                selected={structured.into}
                tone="interest"
                onToggle={(id) => patch((p) => ({ ...p, into: toggleId(p.into, id) }))}
              />
              <button type="button" className="mt-2 text-sm font-medium text-dc-accent" onClick={() => setTagSheet('into')}>
                View all / search
              </button>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">Curious</p>
              <ChipGroup
                options={ISO_MENU_TAGS.slice(0, 10)}
                selected={structured.curious}
                tone="interest"
                onToggle={(id) => patch((p) => ({ ...p, curious: toggleId(p.curious, id) }))}
              />
              <button type="button" className="mt-2 text-sm font-medium text-dc-accent" onClick={() => setTagSheet('curious')}>
                View all / search
              </button>
            </div>
            <button type="button" className="text-sm font-medium text-dc-text-muted underline-offset-2 hover:underline" onClick={() => setTagSheet('hardNos')}>
              Add boundaries
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOnboardingStep(1)} className="min-h-11 flex-1 rounded-full border border-dc-border text-sm text-dc-text">
                Back
              </button>
              <button
                type="button"
                onClick={() => setOnboardingStep(3)}
                className="min-h-11 flex-[2] rounded-full bg-dc-accent text-sm font-semibold text-dc-accent-foreground"
              >
                Offer a scene
              </button>
            </div>
          </div>
        ) : null}

        {onboardingStep === 3 ? (
          <div className="space-y-5">
            {structured.pitches[0] ? (
              <ScenePitchCard
                pitch={structured.pitches[0]}
                index={0}
                mode="editor"
                onEdit={() => {
                  setEditingPitch(structured.pitches[0])
                  setComposerOpen(true)
                }}
                onRemove={() => patch((p) => ({ ...p, pitches: [] }))}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-dc-border px-4 py-8 text-center">
                <p className="text-[17px] font-semibold text-dc-text">Give them an opening line</p>
                <p className="mt-1 text-[14px] text-dc-muted">A scene pitch turns “What are you into?” into a real conversation.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPitch(null)
                    setComposerOpen(true)
                  }}
                  className="mt-4 min-h-11 rounded-full bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground"
                >
                  Add my first scene
                </button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(true)}
                className="min-h-11 rounded-full bg-dc-accent text-sm font-semibold text-dc-accent-foreground disabled:opacity-50"
              >
                {saving ? 'Saving…' : playSpace ? 'Save my card' : 'Save my card'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(true)}
                className="min-h-11 text-sm font-medium text-dc-muted"
              >
                Skip for now — you can add a scene later
              </button>
            </div>
          </div>
        ) : null}

        <TagBrowserSheet
          open={tagSheet !== null}
          title={tagSheet === 'hardNos' ? 'Hard nos' : tagSheet === 'curious' ? 'Curious' : 'Into'}
          hint={
            tagSheet === 'hardNos'
              ? 'Clear boundaries that are not open for negotiation.'
              : tagSheet === 'curious'
                ? 'Things you may explore with the right person and negotiation.'
                : 'Things you would be happy to discuss or plan.'
          }
          options={ISO_MENU_TAGS}
          selected={tagSheet ? structured[tagSheet] : []}
          tone={tagSheet === 'hardNos' ? 'hardNo' : 'interest'}
          onToggle={(id) => {
            if (!tagSheet) return
            patch((p) => ({ ...p, [tagSheet]: toggleId(p[tagSheet], id) }))
          }}
          onClose={() => setTagSheet(null)}
        />
        <ScenePitchComposer
          open={composerOpen}
          initial={editingPitch}
          onCancel={() => setComposerOpen(false)}
          onDone={(pitch) => {
            patch((p) => {
              const exists = p.pitches.some((x) => x.id === pitch.id)
              return {
                ...p,
                pitches: exists
                  ? p.pitches.map((x) => (x.id === pitch.id ? pitch : x))
                  : [...p.pitches, pitch].slice(0, ISO_PITCH_MAX),
              }
            })
            setComposerOpen(false)
          }}
        />
      </div>
    )
  }

  const statusLine = ok ?? (savedAt ? 'Saved just now' : prompt)
  const primaryLabel = hasPublished ? 'Save changes' : ready ? 'Save my card' : 'Save card'

  return (
    <div className="pb-[calc(var(--c2k-mobile-action-clearance)+1rem)] lg:pb-28">
      {!hideChrome ? (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[26px] font-semibold text-dc-text">
              {playSpace ? 'Your card' : 'Build your scene card'}
            </h2>
            <p className="mt-1 max-w-xl text-[15px] text-dc-text-muted">
              Give people a clear, comfortable way to approach you and suggest a scene.
            </p>
          </div>
          {!playSpace ? (
            <button
              type="button"
              className="min-h-11 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-accent lg:hidden"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? 'Hide preview' : 'Preview'}
            </button>
          ) : null}
        </div>
      ) : null}

      {!ready ? (
        <div className="mb-4 rounded-2xl border border-dc-border bg-dc-elevated-muted/60 px-4 py-3">
          <p className="text-[14px] font-medium text-dc-text">Your card is almost ready</p>
          <p className="mt-0.5 text-[13px] text-dc-muted">{prompt}</p>
          <p className="mt-1 text-[12px] text-dc-muted">You can save now and add more later.</p>
        </div>
      ) : null}

      {err ? (
        <div className="mb-4 rounded-xl border border-[var(--dc-danger-border)] bg-[var(--dc-danger-muted)] px-3 py-2 text-sm text-dc-text" role="alert">
          {err}
        </div>
      ) : null}

      <div className="lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)] lg:gap-6 lg:items-start">
        <div className="space-y-4">
          <IsoSection
            id="signal"
            title="How you are showing up"
            hint="Roles, availability, and how people should approach you."
            summary={signalSummary(structured)}
            open={openSection === 'signal'}
            onToggle={() => toggleSection('signal')}
          >
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">Roles</p>
              <ChipGroup
                options={ISO_ROLE_TAGS}
                selected={structured.roles}
                tone="role"
                onToggle={(id) => patch((p) => ({ ...p, roles: toggleId(p.roles, id) }))}
              />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">Play intent</p>
              <ChipGroup
                options={ISO_PLAY_INTENT}
                selected={structured.playIntent}
                exclusive
                onToggle={(id) => patch((p) => ({ ...p, playIntent: id as IsoStructured['playIntent'] }))}
              />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">How available are you?</p>
              <ChipGroup
                options={ISO_CAPACITY}
                selected={structured.capacity}
                exclusive
                onToggle={(id) => patch((p) => ({ ...p, capacity: id as IsoStructured['capacity'] }))}
              />
              <p className="mt-2 text-[12px] text-dc-muted">
                {ISO_CAPACITY.find((c) => c.id === structured.capacity)?.hint}
              </p>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">How should someone approach?</p>
              <ChipGroup
                options={ISO_APPROACH}
                selected={structured.approach}
                exclusive
                onToggle={(id) => patch((p) => ({ ...p, approach: id as IsoStructured['approach'] }))}
              />
              {structured.approach === 'visual_signal' ? (
                <div className="mt-3">
                  <label className="block text-[13px] font-medium text-dc-text mb-1">How will they recognize your signal?</label>
                  <input
                    className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-[15px] text-dc-text"
                    value={structured.visualSignal}
                    onChange={(e) => patch((p) => ({ ...p, visualSignal: e.target.value.slice(0, 120) }))}
                    placeholder="Silver wrist cuff, red bandana, ask about the rope bag…"
                  />
                </div>
              ) : null}
              <div className="mt-4">
                <label className="block text-[13px] font-medium text-dc-text mb-1">Discord (optional)</label>
                <p className="mb-2 text-[12px] text-dc-muted">
                  Shown on your shareable ISO card when it is shared outside kink.social.
                </p>
                <input
                  className="w-full min-h-11 rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-[15px] text-dc-text"
                  value={structured.discordHandle}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      discordHandle: e.target.value.replace(/^@+/, '').slice(0, 64),
                    }))
                  }
                  placeholder="yourhandle"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </IsoSection>

          <IsoSection
            id="seeking"
            title="Who you hope to meet"
            hint="Choose the people and connection styles that feel relevant."
            summary={seekingSummary(structured)}
            open={openSection === 'seeking'}
            onToggle={() => toggleSection('seeking')}
          >
            <ChipGroup
              options={ISO_SEEKING_WHO}
              selected={structured.seekingWho}
              tone="role"
              onToggle={(id) => patch((p) => ({ ...p, seekingWho: toggleId(p.seekingWho, id) }))}
            />
          </IsoSection>

          <IsoSection
            id="scenes"
            title="Your scene menu"
            hint="Offer a few ideas people can comfortably ask you about."
            summary={
              structured.pitches.length
                ? structured.pitches
                    .slice(0, 3)
                    .map((p) => p.title.trim() || 'Untitled scene')
                    .join('\n')
                : null
            }
            open={openSection === 'scenes'}
            onToggle={() => toggleSection('scenes')}
            actionLabel={structured.pitches.length ? 'Edit' : 'Add'}
          >
            {structured.pitches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-dc-border px-4 py-6 text-center">
                <p className="text-[17px] font-semibold text-dc-text">Give them an opening line</p>
                <p className="mt-1 text-[14px] text-dc-muted">
                  A scene pitch turns “What are you into?” into a real conversation.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPitch(null)
                    setComposerOpen(true)
                  }}
                  className="mt-4 min-h-11 rounded-full bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground"
                >
                  Add my first scene
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {visiblePitches.map((pitch, idx) => (
                  <ScenePitchCard
                    key={pitch.id}
                    pitch={pitch}
                    index={idx}
                    mode="editor"
                    onEdit={() => {
                      setEditingPitch(pitch)
                      setComposerOpen(true)
                    }}
                    onRemove={() => {
                      if (!window.confirm('Remove this scene?')) return
                      patch((p) => ({ ...p, pitches: p.pitches.filter((x) => x.id !== pitch.id) }))
                    }}
                  />
                ))}
                {!showExtraPitches && structured.pitches.length > 5 ? (
                  <button
                    type="button"
                    onClick={() => setShowExtraPitches(true)}
                    className="text-sm font-medium text-dc-accent"
                  >
                    Show {structured.pitches.length - 5} more scenes
                  </button>
                ) : null}
                {structured.pitches.length < ISO_PITCH_MAX ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPitch(null)
                      setComposerOpen(true)
                    }}
                    className="min-h-11 rounded-full border border-dc-border px-4 text-sm font-medium text-dc-accent"
                  >
                    Offer another scene
                  </button>
                ) : null}
              </div>
            )}
          </IsoSection>

          <IsoSection
            id="menu"
            title="What sounds good"
            hint="Things you enjoy, might explore, and clear boundaries."
            summary={
              [
                menuTabSummary(structured.into) && `Into: ${menuTabSummary(structured.into)}`,
                menuTabSummary(structured.curious) && `Curious: ${menuTabSummary(structured.curious)}`,
                menuTabSummary(structured.hardNos) && `Hard nos: ${menuTabSummary(structured.hardNos)}`,
              ]
                .filter(Boolean)
                .join('\n') || null
            }
            open={openSection === 'menu'}
            onToggle={() => toggleSection('menu')}
          >
            <div className="flex gap-1 rounded-xl border border-dc-border bg-dc-surface-muted p-1">
              {(
                [
                  ['into', 'Into'],
                  ['curious', 'Curious'],
                  ['hardNos', 'Hard nos'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMenuTab(id)}
                  className={`min-h-10 flex-1 rounded-lg text-sm font-medium ${
                    menuTab === id ? 'bg-dc-elevated text-dc-text shadow-sm' : 'text-dc-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[13px] text-dc-muted">
              {menuTab === 'into'
                ? 'Things you would be happy to discuss or plan.'
                : menuTab === 'curious'
                  ? 'Things you may explore with the right person and negotiation.'
                  : 'Clear boundaries that are not open for negotiation.'}
            </p>
            <ChipGroup
              options={ISO_MENU_TAGS.slice(0, 12)}
              selected={structured[menuTab]}
              tone={menuTab === 'hardNos' ? 'hardNo' : 'interest'}
              onToggle={(id) => patch((p) => ({ ...p, [menuTab]: toggleId(p[menuTab], id) }))}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setTagSheet(menuTab)} className="text-sm font-medium text-dc-accent">
                View all / search
              </button>
              <span className="text-[13px] text-dc-muted">{structured[menuTab].length} selected</span>
            </div>
          </IsoSection>

          <IsoSection
            id="logistics"
            title="Risk, gear, and setting"
            hint="Share what someone should know before proposing a scene."
            summary={logisticsSummary(structured)}
            open={openSection === 'logistics'}
            onToggle={() => toggleSection('logistics')}
            actionLabel={logisticsSummary(structured) ? 'Edit' : 'Add details'}
          >
            <div>
              <label className="block text-[13px] font-medium text-dc-text mb-1">Risk or access notes</label>
              <textarea
                value={structured.riskNotes}
                onChange={(e) => patch((p) => ({ ...p, riskNotes: e.target.value.slice(0, 2000) }))}
                rows={3}
                placeholder="Allergies, mobility needs, marks, aftercare needs, health considerations…"
                className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-[15px] text-dc-text"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-dc-text mb-1">Gear and supplies</label>
              <textarea
                value={structured.gearBringing}
                onChange={(e) => patch((p) => ({ ...p, gearBringing: e.target.value.slice(0, 2000) }))}
                rows={2}
                placeholder="What you have, what you need, and what should stay home."
                className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-[15px] text-dc-text"
              />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">Venues</p>
              <ChipGroup
                options={ISO_VENUES}
                selected={structured.venues}
                tone="interest"
                onToggle={(id) => patch((p) => ({ ...p, venues: toggleId(p.venues, id) }))}
              />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">Also happy to</p>
              <ChipGroup
                options={ISO_SOCIAL_OFFERS}
                selected={structured.socialOffers}
                tone="interest"
                onToggle={(id) => patch((p) => ({ ...p, socialOffers: toggleId(p.socialOffers, id) }))}
              />
            </div>
          </IsoSection>

          <IsoSection
            id="voice"
            title="In your own words"
            hint="A short note, signal, or photos that make this feel more like you."
            summary={voiceSummary(body, imageCount, structured.approach === 'visual_signal' ? structured.visualSignal : '')}
            open={openSection === 'voice'}
            onToggle={() => toggleSection('voice')}
            actionLabel={voiceSummary(body, imageCount, '') ? 'Edit' : 'Add details'}
          >
            <div>
              <label className="block text-[13px] font-medium text-dc-text mb-1">Personal note</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={compact ? 4 : 6}
                maxLength={ISO_BODY_MAX}
                placeholder="What kind of energy, communication, or connection helps you feel comfortable?"
                className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-[15px] text-dc-text"
              />
              <p className="mt-1 text-[12px] text-dc-muted">
                {body.length} / {ISO_BODY_MAX}
              </p>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-dc-text">Add a little visual context</p>
              <p className="mb-2 text-[13px] text-dc-muted">Up to three images. Keep them useful and appropriate for the event.</p>
              <div className="flex gap-1">
                {[0, 1, 2].map((slot) => (
                  <div key={slot} className="min-w-0 flex-1 space-y-1">
                    {images[slot] ? (
                      <button
                        type="button"
                        onClick={() => setLightbox(images[slot])}
                        className="relative block aspect-square w-full overflow-hidden rounded-lg border border-dc-border bg-zinc-900"
                      >
                        <img src={images[slot]} alt="" className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-dc-border text-[10px] text-dc-muted">
                        Empty
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setUploadSlot(uploadSlot === slot ? null : slot)}
                      className="w-full rounded bg-dc-elevated-muted py-1 text-[11px] text-dc-text-muted"
                    >
                      Upload
                    </button>
                    {uploadSlot === slot ? (
                      <PhotoUpload
                        compact
                        uploading={uploading}
                        onSelect={(res) => void onPhotoPick(slot, res.file)}
                        guidelines={[{ text: 'After upload, save your ISO.' }]}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </IsoSection>

          <IsoSection
            id="posting"
            title="Who can see this"
            hint="Visibility and whether people can message you from your ISO."
            summary={postingSummary(visibility, acceptDmsViaIso)}
            open={openSection === 'posting'}
            onToggle={() => toggleSection('posting')}
          >
            <div className="flex flex-wrap gap-2">
              {VIS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setVisibility(o.value)}
                  className={`min-h-11 rounded-full border px-4 text-sm font-medium ${
                    visibility === o.value
                      ? 'border-[var(--dc-accent-border)] bg-[color-mix(in_srgb,var(--dc-accent)_13%,var(--dc-elevated))] text-dc-text'
                      : 'border-dc-border text-dc-text-muted'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptDmsViaIso}
                onChange={(e) => setAcceptDmsViaIso(e.target.checked)}
                className="rounded border-dc-border-strong"
              />
              <span className="text-[15px] text-dc-text-muted">Accept DMs through my ISO</span>
            </label>
            {viewerUsername ? (
              <IsoShareActions username={viewerUsername} canSharePublicly={visibility === 'PUBLIC'} />
            ) : null}
          </IsoSection>
        </div>

        <aside className={`mt-6 lg:mt-0 lg:sticky lg:top-20 ${showPreview ? 'block' : 'hidden lg:block'}`}>
          <IsoLivePreview structured={structured} body={body} />
        </aside>
      </div>

      <IsoStickySaveBar
        status={statusLine}
        primaryLabel={primaryLabel}
        busy={saving}
        onPrimary={() => void save(false)}
        onPreview={() => setShowPreview((v) => !v)}
        previewOpen={showPreview}
      />

      <TagBrowserSheet
        open={tagSheet !== null}
        title={tagSheet === 'hardNos' ? 'Hard nos' : tagSheet === 'curious' ? 'Curious' : 'Into'}
        options={ISO_MENU_TAGS}
        selected={tagSheet ? structured[tagSheet] : []}
        tone={tagSheet === 'hardNos' ? 'hardNo' : 'interest'}
        onToggle={(id) => {
          if (!tagSheet) return
          patch((p) => ({ ...p, [tagSheet]: toggleId(p[tagSheet], id) }))
        }}
        onClose={() => setTagSheet(null)}
      />

      <ScenePitchComposer
        open={composerOpen}
        initial={editingPitch}
        onCancel={() => setComposerOpen(false)}
        onDone={(pitch) => {
          patch((p) => {
            const exists = p.pitches.some((x) => x.id === pitch.id)
            return {
              ...p,
              pitches: exists
                ? p.pitches.map((x) => (x.id === pitch.id ? pitch : x))
                : [...p.pitches, pitch].slice(0, ISO_PITCH_MAX),
            }
          })
          setComposerOpen(false)
          setOpenSection('scenes')
        }}
      />

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-dc-modal flex cursor-zoom-out items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
          aria-label="Close image"
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full object-contain" />
        </button>
      ) : null}
    </div>
  )
}
