import { useEffect, useMemo, useState } from 'react'
import {
  DEPICTED_PEOPLE,
  DEPICTED_PEOPLE_LABELS,
  explicitCannotBePublicPreview,
  MEDIA_CONTENT_RATINGS,
  MEDIA_CONTENT_RATING_LABELS,
  MEDIA_PUBLISH_LANE_MESSAGES,
  MEDIA_VISIBILITIES,
  MEDIA_VISIBILITY_LABELS,
  MEDIA_VISIBILITY_VALUES,
  MEMBER_SELECTABLE_CONTENT_RATINGS,
  PROFILE_PHOTO_ALLOWED_CONTENT_RATINGS,
  UPLOADER_ATTESTATION_FIELDS,
  UPLOADER_ATTESTATION_LABELS,
  type DepictedPeople,
  type MediaContentRating,
  type MediaPublishLane,
  type MediaVisibility,
  type UploaderAttestationField,
} from '@c2k/shared'
import Dialog from '@/components/ui/Dialog'

export type MediaAttestationTarget = {
  mediaAssetId: string
  label?: string
}

type AttestationResponse = {
  lane?: MediaPublishLane
  uploadStatus?: string
  error?: string
}

type Props = {
  open: MediaAttestationTarget | null
  onClose: () => void
  onSubmitted?: (result: { lane: MediaPublishLane }) => void
  /** Profile gallery uploads — no explicit ratings. */
  profilePhotoOnly?: boolean
}

const EMPTY_ATTESTATIONS = Object.fromEntries(
  UPLOADER_ATTESTATION_FIELDS.map((field) => [field, false])
) as Record<UploaderAttestationField, boolean>

export default function MediaAttestationModal({
  open,
  onClose,
  onSubmitted,
  profilePhotoOnly = false,
}: Props) {
  const [contentRating, setContentRating] = useState<MediaContentRating>(
    MEDIA_CONTENT_RATINGS.adultNonExplicit
  )
  const [depictedPeople, setDepictedPeople] = useState<DepictedPeople>(DEPICTED_PEOPLE.onlyMe)
  const [visibility, setVisibility] = useState<MediaVisibility>(MEDIA_VISIBILITIES.loggedIn)
  const [attestations, setAttestations] =
    useState<Record<UploaderAttestationField, boolean>>(EMPTY_ATTESTATIONS)
  const [msg, setMsg] = useState<string | null>(null)
  const [submittedLane, setSubmittedLane] = useState<MediaPublishLane | null>(null)
  const [busy, setBusy] = useState(false)

  const ratingOptions = profilePhotoOnly
    ? PROFILE_PHOTO_ALLOWED_CONTENT_RATINGS
    : MEMBER_SELECTABLE_CONTENT_RATINGS

  const visibilityOptions = useMemo(
    () =>
      MEDIA_VISIBILITY_VALUES.filter(
        (option) => !explicitCannotBePublicPreview(option, contentRating)
      ),
    [contentRating]
  )

  useEffect(() => {
    if (!open) return
    setContentRating(MEDIA_CONTENT_RATINGS.adultNonExplicit)
    setDepictedPeople(DEPICTED_PEOPLE.onlyMe)
    setVisibility(MEDIA_VISIBILITIES.loggedIn)
    setAttestations({ ...EMPTY_ATTESTATIONS })
    setMsg(null)
    setSubmittedLane(null)
  }, [open])

  useEffect(() => {
    if (explicitCannotBePublicPreview(visibility, contentRating)) {
      setVisibility(MEDIA_VISIBILITIES.loggedIn)
    }
  }, [contentRating, visibility])

  const allAttestationsChecked = UPLOADER_ATTESTATION_FIELDS.every((field) => attestations[field])
  const canSubmit = !busy && allAttestationsChecked && Boolean(open)

  function setAttestation(field: UploaderAttestationField, checked: boolean) {
    setAttestations((prev) => ({ ...prev, [field]: checked }))
  }

  async function submit() {
    const target = open
    if (!target || !canSubmit) return
    setMsg(null)
    setBusy(true)
    try {
      const r = await fetch(
        `/api/v1/media/assets/${encodeURIComponent(target.mediaAssetId)}/attestation`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentRating,
            depictedPeople,
            visibility,
            ...attestations,
          }),
        }
      )
      const j = (await r.json().catch(() => ({}))) as AttestationResponse
      if (!r.ok) {
        setMsg(j.error ?? 'Could not save attestation')
        return
      }
      const lane = j.lane ?? 'YELLOW'
      if (lane === 'RED') {
        setMsg('This upload cannot be published. Contact support if you believe this is an error.')
        return
      }
      setSubmittedLane(lane)
    } catch {
      setMsg('Network error')
    } finally {
      setBusy(false)
    }
  }

  function finish() {
    if (submittedLane) {
      onSubmitted?.({ lane: submittedLane })
    }
    onClose()
  }

  const title = open ? `Content attestation${open.label ? ` · ${open.label}` : ''}` : 'Content attestation'

  return (
    <Dialog
      open={Boolean(open)}
      onClose={onClose}
      title={title}
      description={
        profilePhotoOnly
          ? 'Profile photos must be portrait-style pictures of you. Genitals and graphic sex are not allowed.'
          : 'Adult content is allowed on Kink Social. Attestations help keep uploads consensual, age-appropriate, and visible only where you intend.'
      }
      maxWidthClass="max-w-lg"
      footer={
        submittedLane ?
          <button
            type="button"
            onClick={finish}
            className="min-h-10 px-4 rounded-xl text-sm font-medium bg-dc-accent text-dc-accent-foreground"
          >
            Done
          </button>
        : <>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 px-4 rounded-xl text-sm border border-dc-border text-dc-text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit()}
              className="min-h-10 px-4 rounded-xl text-sm font-medium bg-dc-accent text-dc-accent-foreground disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Submit attestation'}
            </button>
          </>
      }
    >
      {submittedLane ?
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            submittedLane === 'GREEN' ?
              'border-dc-success/40 bg-dc-success/10 text-dc-text'
            : 'border-dc-warning/40 bg-dc-warning/10 text-dc-text'
          }`}
          role="status"
        >
          <p className="font-medium">
            {submittedLane === 'GREEN' ?
              'Published'
            : submittedLane === 'RED' ?
              'Cannot publish'
            : 'Pending review'}
          </p>
          <p className="mt-1 text-dc-text-muted">
            {submittedLane === 'RED' ?
              'This upload cannot be published under platform policy. Contact support if you believe this is an error.'
            : submittedLane === 'GREEN' ?
              MEDIA_PUBLISH_LANE_MESSAGES.GREEN
            : MEDIA_PUBLISH_LANE_MESSAGES.YELLOW}
          </p>
        </div>
      : <>
          <label htmlFor="media-attest-rating" className="block text-xs text-dc-muted mb-1">
            Is this explicit adult content?
          </label>
          <select
            id="media-attest-rating"
            value={contentRating}
            onChange={(e) => setContentRating(e.target.value as MediaContentRating)}
            className="w-full bg-dc-elevated-solid border border-dc-border rounded-lg px-2 py-2 text-sm text-dc-text mb-3"
          >
            {ratingOptions.map((rating) => (
              <option key={rating} value={rating}>
                {MEDIA_CONTENT_RATING_LABELS[rating]}
              </option>
            ))}
          </select>

          <label htmlFor="media-attest-depicted" className="block text-xs text-dc-muted mb-1">
            Who is depicted?
          </label>
          <select
            id="media-attest-depicted"
            value={depictedPeople}
            onChange={(e) => setDepictedPeople(e.target.value as DepictedPeople)}
            className="w-full bg-dc-elevated-solid border border-dc-border rounded-lg px-2 py-2 text-sm text-dc-text mb-3"
          >
            {Object.values(DEPICTED_PEOPLE).map((people) => (
              <option key={people} value={people}>
                {DEPICTED_PEOPLE_LABELS[people]}
              </option>
            ))}
          </select>

          <label htmlFor="media-attest-visibility" className="block text-xs text-dc-muted mb-1">
            Visibility
          </label>
          <select
            id="media-attest-visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as MediaVisibility)}
            className="w-full bg-dc-elevated-solid border border-dc-border rounded-lg px-2 py-2 text-sm text-dc-text mb-3"
          >
            {visibilityOptions.map((option) => (
              <option key={option} value={option}>
                {MEDIA_VISIBILITY_LABELS[option]}
              </option>
            ))}
          </select>
          {contentRating === MEDIA_CONTENT_RATINGS.explicitAdult ?
            <p className="text-xs text-dc-muted mb-3">
              Explicit adult media cannot use public preview visibility.
            </p>
          : null}

          <fieldset className="space-y-2">
            <legend className="text-xs text-dc-muted mb-2">Required attestations</legend>
            {UPLOADER_ATTESTATION_FIELDS.map((field) => (
              <label key={field} className="flex items-start gap-3 text-sm text-dc-text-muted">
                <input
                  type="checkbox"
                  checked={attestations[field]}
                  onChange={(e) => setAttestation(field, e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-dc-border-strong"
                />
                <span>{UPLOADER_ATTESTATION_LABELS[field]}</span>
              </label>
            ))}
          </fieldset>

          {!allAttestationsChecked ?
            <p className="text-xs text-dc-muted mt-2">All attestations are required before publishing.</p>
          : null}
          {msg ? <p className="text-sm text-dc-danger mt-2">{msg}</p> : null}
        </>
      }
    </Dialog>
  )
}
