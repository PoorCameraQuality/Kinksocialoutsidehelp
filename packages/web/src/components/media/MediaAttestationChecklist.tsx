import { useMemo } from 'react'
import {
  DEPICTED_PEOPLE,
  DEPICTED_PEOPLE_LABELS,
  explicitCannotBePublicPreview,
  MEDIA_CONTENT_RATING_LABELS,
  MEDIA_VISIBILITIES,
  MEDIA_VISIBILITY_LABELS,
  MEMBER_SELECTABLE_CONTENT_RATINGS,
  UPLOADER_ATTESTATION_FIELDS,
  UPLOADER_ATTESTATION_LABELS,
  type DepictedPeople,
  type MediaContentRating,
  type MediaUploadAttestation,
  type MediaVisibility,
  type UploaderAttestationField,
} from '@c2k/shared'
import { settingsCheckboxClass, settingsSelectClass } from '@/lib/settingsFormClasses'

type Props = {
  contentRating: MediaContentRating
  depictedPeople: DepictedPeople
  visibility: MediaVisibility
  attestations: Record<UploaderAttestationField, boolean>
  onContentRatingChange: (value: MediaContentRating) => void
  onDepictedPeopleChange: (value: DepictedPeople) => void
  onVisibilityChange: (value: MediaVisibility) => void
  onAttestationChange: (field: UploaderAttestationField, checked: boolean) => void
  disabled?: boolean
}

export default function MediaAttestationChecklist({
  contentRating,
  depictedPeople,
  visibility,
  attestations,
  onContentRatingChange,
  onDepictedPeopleChange,
  onVisibilityChange,
  onAttestationChange,
  disabled,
}: Props) {
  const visibilityOptions = useMemo(
    () =>
      MEMBER_SELECTABLE_CONTENT_RATINGS.includes(contentRating) ?
        Object.values(MEDIA_VISIBILITIES).filter(
          (option) =>
            option === MEDIA_VISIBILITIES.publicPreview ||
            option === MEDIA_VISIBILITIES.loggedIn ||
            option === MEDIA_VISIBILITIES.followers ||
            option === MEDIA_VISIBILITIES.privateProfile,
        ).filter((option) => !explicitCannotBePublicPreview(option, contentRating))
      : [MEDIA_VISIBILITIES.loggedIn, MEDIA_VISIBILITIES.followers, MEDIA_VISIBILITIES.privateProfile],
    [contentRating],
  )

  const allChecked = UPLOADER_ATTESTATION_FIELDS.every((field) => attestations[field])

  return (
    <div className="space-y-4 rounded-xl border border-dc-border bg-dc-elevated-muted/30 p-4">
      <div>
        <h3 className="text-sm font-semibold text-dc-text">Content attestation</h3>
        <p className="mt-1 text-xs text-dc-text-muted">
          Adult content is allowed. Attestations keep uploads consensual and visible only where you intend.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="upload-content-rating" className="mb-1 block text-xs font-medium text-dc-muted">
            Content rating
          </label>
          <select
            id="upload-content-rating"
            className={settingsSelectClass}
            value={contentRating}
            disabled={disabled}
            onChange={(e) => onContentRatingChange(e.target.value as MediaContentRating)}
          >
            {MEMBER_SELECTABLE_CONTENT_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {MEDIA_CONTENT_RATING_LABELS[rating]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="upload-depicted-people" className="mb-1 block text-xs font-medium text-dc-muted">
            Who is depicted
          </label>
          <select
            id="upload-depicted-people"
            className={settingsSelectClass}
            value={depictedPeople}
            disabled={disabled}
            onChange={(e) => onDepictedPeopleChange(e.target.value as DepictedPeople)}
          >
            {Object.values(DEPICTED_PEOPLE).map((people) => (
              <option key={people} value={people}>
                {DEPICTED_PEOPLE_LABELS[people]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="upload-attest-visibility" className="mb-1 block text-xs font-medium text-dc-muted">
          Attestation visibility
        </label>
        <select
          id="upload-attest-visibility"
          className={settingsSelectClass}
          value={
            (visibilityOptions as readonly MediaVisibility[]).includes(visibility) ?
              visibility
            : MEDIA_VISIBILITIES.loggedIn
          }
          disabled={disabled}
          onChange={(e) => onVisibilityChange(e.target.value as MediaVisibility)}
        >
          {visibilityOptions.map((option) => (
            <option key={option} value={option}>
              {MEDIA_VISIBILITY_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-dc-muted">Required confirmations</legend>
        {UPLOADER_ATTESTATION_FIELDS.map((field) => (
          <label key={field} className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className={`${settingsCheckboxClass} mt-0.5 shrink-0`}
              checked={attestations[field]}
              disabled={disabled}
              onChange={(e) => onAttestationChange(field, e.target.checked)}
            />
            <span className="text-sm text-dc-text-muted">{UPLOADER_ATTESTATION_LABELS[field]}</span>
          </label>
        ))}
      </fieldset>

      {!allChecked ?
        <p className="text-xs text-dc-muted">Check all confirmations to publish.</p>
      : null}
    </div>
  )
}

export function buildUploadAttestation(
  contentRating: MediaContentRating,
  depictedPeople: DepictedPeople,
  visibility: MediaVisibility,
  attestations: Record<UploaderAttestationField, boolean>,
): MediaUploadAttestation | null {
  if (!UPLOADER_ATTESTATION_FIELDS.every((field) => attestations[field])) return null
  return {
    contentRating,
    depictedPeople,
    visibility,
    uploaderConfirmed18: true,
    uploaderConfirmedDepictedAdults18: true,
    uploaderConfirmedConsent: true,
    uploaderConfirmedRightToUpload: true,
    uploaderConfirmedNoNcii: true,
    uploaderConfirmedNoMinors: true,
    uploaderConfirmedNoHiddenCamera: true,
    uploaderConfirmedNoAiDeepfakeWithoutConsent: true,
  }
}

export const DEFAULT_ATTESTATIONS = Object.fromEntries(
  UPLOADER_ATTESTATION_FIELDS.map((field) => [field, false]),
) as Record<UploaderAttestationField, boolean>
