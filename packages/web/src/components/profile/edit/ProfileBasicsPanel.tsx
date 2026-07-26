import { Link } from 'react-router-dom'
import { useId, useMemo } from 'react'
import {
  MAX_IMAGE_UPLOAD_BYTES,
  PROFILE_PHOTO_PENDING_REVIEW_DETAIL,
  PROFILE_PHOTO_PENDING_REVIEW_MESSAGE,
  PROFILE_PHOTO_PENDING_REVIEW_SHORT,
  PROFILE_PRONOUN_MAX,
  PROFILE_HERO_PHOTO_FRAME_CLASS,
  ageFromBirthDate,
  profileBirthDateInputBounds,
} from '@c2k/shared'
import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import ProfileBirthDateField from '@/components/profile/ProfileBirthDateField'
import ProfilePhotoCredit from '@/components/profile/ProfilePhotoCredit'
import TagMultiSelect from '@/components/ui/TagMultiSelect'
import { FormStatusMessage } from '@/components/ui/primitives/layout'
import {
  MediaUploadProgressOverlay,
  MediaUploadStatusRow,
  type MediaUploadStage,
} from '@/components/media/MediaUploadProgress'
import ProfileStudioInsetCard from '@/components/profile/studio/ProfileStudioInsetCard'
import ProfileStudioSectionCard from '@/components/profile/studio/ProfileStudioSectionCard'
import { IconUser } from '@/components/profile/story/ProfileStoryIcons'
import { useProfileEdit } from '@/contexts/ProfileEditContext'
import ZipLocationCandidatePicker from '@/components/profile/ZipLocationCandidatePicker'
import { PLACE_CUSTOM, PLACE_STATE_ONLY } from '@/lib/profile-edit-location'

const PRONOUN_PRESETS = ['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Any pronouns', 'Ask me']

export default function ProfileBasicsPanel() {
  const ctx = useProfileEdit()
  const photoInputId = useId()
  const displayName =
    (ctx.profileMe.data?.profile.displayName as string | null)?.trim() ||
    ctx.profileMe.data?.user.username ||
    ctx.viewerUsername ||
    ''
  const birthDateBounds = useMemo(() => profileBirthDateInputBounds(), [])
  const maxPhotoMb = Math.round(MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      e.target.value = ''
      return
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      e.target.value = ''
      return
    }
    ctx.handleFileChange(e)
  }

  return (
    <ProfileStudioSectionCard
      title="Profile Story"
      description="These are the first things visitors use to understand who you are."
      icon={<IconUser />}
    >
      <div className="space-y-5">
        <ProfileStudioInsetCard className="space-y-5">
        <div>
          <label htmlFor="profile-display-name" className="block text-sm font-medium text-dc-text mb-1">
            Display name
          </label>
          <p className="text-xs text-dc-text-muted mb-2">Shown on your public profile header (not your login username).</p>
          <input
            id="profile-display-name"
            type="text"
            value={ctx.displayName}
            onChange={(e) => ctx.setDisplayName(e.target.value)}
            placeholder={displayName}
            className="w-full max-w-md px-4 py-3 bg-dc-surface-muted border border-dc-border rounded-lg text-dc-text"
          />
        </div>

        <TagMultiSelect
          label="Pronouns"
          values={ctx.pronounTags}
          onChange={ctx.setPronounTags}
          suggestions={PRONOUN_PRESETS}
          maxCount={PROFILE_PRONOUN_MAX}
        />

        <div>
          <label htmlFor="profile-birth-date" className="block text-sm font-medium text-dc-text mb-1">
            Date of birth
          </label>
          <p className="text-xs text-dc-text-muted mb-2">
            Required for age verification. Never shown on your public profile — only your age may appear when visibility allows.
          </p>
          <ProfileBirthDateField
            id="profile-birth-date"
            value={ctx.birthDate}
            bounds={birthDateBounds}
            onChange={ctx.setBirthDate}
            className="max-w-md"
          />
          {ctx.birthDate.trim() && ageFromBirthDate(ctx.birthDate) != null && ageFromBirthDate(ctx.birthDate)! < 18 ?
            <p className="mt-2 text-sm text-red-400" role="alert">
              Birth date must indicate you are at least 18 years old.
            </p>
          : null}
        </div>

        <div className="rounded-lg border border-dc-border/60 bg-dc-surface-muted/30 px-4 py-3">
          <p className="text-sm text-dc-text-muted leading-relaxed">
            Your profile story lives in one place — the{' '}
            <Link to="/profile/edit/about" className="font-medium text-dc-accent hover:underline">
              About
            </Link>{' '}
            section (rich text). The opening lines also feed your hero tagline. Your role headline comes from{' '}
            <Link to="/profile/edit/identity" className="text-dc-accent hover:underline">
              Identity & Community
            </Link>
            .
          </p>
          {ctx.bio.trim() ?
            <p className="mt-2 line-clamp-2 text-xs text-dc-muted">{ctx.bio.replace(/\s+/g, ' ').trim()}</p>
          : null}
        </div>
        </ProfileStudioInsetCard>

        <ProfileStudioInsetCard id="profile-location" className="space-y-3">
          <h3 className="text-sm font-semibold text-dc-text">Location</h3>
          <p className="text-xs text-dc-muted mt-1">
            Enter your ZIP to set city and state. Control who sees this under{' '}
            <Link to="/profile/edit/privacy" className="text-dc-accent hover:underline">
              Privacy & visibility
            </Link>
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="ZIP code"
              value={ctx.homeZip}
              onChange={(e) => ctx.setHomeZip(e.target.value)}
              onBlur={() => {
                if (ctx.homeZip.replace(/\D/g, '').length >= 5) void ctx.lookupZip()
              }}
              className="w-32 px-4 py-3 bg-dc-surface-muted border border-dc-border rounded-lg text-dc-text"
            />
            <button
              type="button"
              onClick={() => void ctx.lookupZip()}
              className="min-h-11 px-4 rounded-lg border border-dc-border text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Look up
            </button>
          </div>
          {ctx.zipLookupError ?
            <p className="mt-2 text-sm text-red-400" role="alert">{ctx.zipLookupError}</p>
          : null}
          {ctx.zipCandidates.length > 0 ?
            <ZipLocationCandidatePicker
              candidates={ctx.zipCandidates}
              selectedPlaceId={
                ctx.placeSelect && ctx.placeSelect !== PLACE_CUSTOM && ctx.placeSelect !== PLACE_STATE_ONLY
                  ? ctx.placeSelect
                  : null
              }
              onSelect={ctx.selectZipCandidate}
              zipLocality={ctx.zipLocality}
            />
          : ctx.locationLabel ?
            <p className="mt-2 text-sm text-dc-text-muted rounded-lg border border-dc-border px-3 py-2">
              {ctx.locationLabel}
            </p>
          : null}
          {ctx.stateId ?
            <details className="mt-2 text-sm" open={ctx.zipCandidates.length > 0}>
              <summary className="cursor-pointer text-dc-accent">City not right? Pick manually</summary>
              <div className="mt-3 space-y-2">
                <select
                  value={ctx.placeSelect}
                  onChange={(e) => {
                    const v = e.target.value
                    ctx.setPlaceSelect(v)
                    if (v !== PLACE_CUSTOM) ctx.setCustomLocation('')
                  }}
                  className="w-full px-4 py-3 bg-dc-surface-muted border border-dc-border rounded-lg text-dc-text"
                >
                  <option value="">Choose…</option>
                  <option value={PLACE_STATE_ONLY}>State only (no city)</option>
                  {ctx.places.map((pl) => (
                    <option key={pl.id} value={pl.id}>{pl.name}</option>
                  ))}
                  <option value={PLACE_CUSTOM}>Other (type below)</option>
                </select>
                {ctx.placeSelect === PLACE_CUSTOM ?
                  <input
                    type="text"
                    placeholder="Custom town or area"
                    value={ctx.customLocation}
                    onChange={(e) => ctx.setCustomLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-dc-surface-muted border border-dc-border rounded-lg text-dc-text"
                  />
                : null}
              </div>
            </details>
          : null}
        </ProfileStudioInsetCard>

        <ProfileStudioInsetCard className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-dc-text">Profile photo</h3>
            <p className="text-xs text-dc-muted mt-1">
              Your avatar on cards, search, and your public profile hero. JPG, PNG, or WebP up to {maxPhotoMb}MB.
            </p>
          </div>
        {ctx.photoUploadStage ?
          <MediaUploadStatusRow
            stage={ctx.photoUploadStage as MediaUploadStage}
            onCancel={ctx.cancelPhotoUpload}
          />
        : null}
        {ctx.photoUploadError ?
          <FormStatusMessage tone="warning">
            {ctx.photoUploadError}
          </FormStatusMessage>
        : null}
        <input
          id={photoInputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handlePhotoChange}
          disabled={ctx.photoUploading}
        />
        <label
          htmlFor={photoInputId}
          aria-busy={ctx.photoUploading}
          className={`relative ${PROFILE_HERO_PHOTO_FRAME_CLASS} flex border-2 border-dashed flex-col items-center justify-center ${
            ctx.photoUploading ? 'cursor-wait opacity-80' : 'cursor-pointer'
          } ${ctx.hasPhoto ? 'border-dc-accent bg-dc-accent/10' : 'border-dc-border bg-dc-elevated/95'}`}
        >
          {ctx.photoPreviewUrl ?
            <ProfilePhotoImage
              src={ctx.photoPreviewUrl}
              displaySettings={ctx.photoDisplaySettings}
              className="h-full w-full rounded-2xl"
            />
          : <span className="text-dc-text-muted text-sm px-4 text-center">Tap to add photo</span>}
          {ctx.photoUploadStage ?
            <MediaUploadProgressOverlay stage={ctx.photoUploadStage as MediaUploadStage} />
          : null}
          {ctx.photoPendingReview && !ctx.photoUploadStage ?
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-dc-surface-muted/90 p-3 text-center">
              <p className="text-xs font-medium text-amber-100">{PROFILE_PHOTO_PENDING_REVIEW_SHORT}</p>
              <p className="text-[10px] text-dc-muted">{PROFILE_PHOTO_PENDING_REVIEW_DETAIL}</p>
            </div>
          : null}
        </label>
        {ctx.photoPendingReview ?
          <FormStatusMessage tone="info">{PROFILE_PHOTO_PENDING_REVIEW_MESSAGE}</FormStatusMessage>
        : null}
        {ctx.hasPhoto ?
          <div className="space-y-3 max-w-md">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-dc-text">Photo framing</legend>
              <p className="text-xs text-dc-muted">
                Match your public profile hero. Choose &ldquo;Show full photo&rdquo; to keep watermarks and photographer marks visible.
              </p>
              <div className="flex flex-wrap gap-2">
                {(['cover', 'contain'] as const).map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    onClick={() => ctx.setPhotoDisplaySettings({ ...ctx.photoDisplaySettings, displayFit: fit })}
                    className={`min-h-10 rounded-lg border px-3 text-sm ${
                      ctx.photoDisplaySettings.displayFit === fit
                        ? 'border-dc-accent bg-dc-accent/15 text-dc-text'
                        : 'border-dc-border text-dc-text-muted hover:text-dc-text'
                    }`}
                  >
                    {fit === 'cover' ? 'Fill frame' : 'Show full photo'}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="profile-photo-credit" className="block text-sm font-medium text-dc-text mb-1">
                Credit photographer (optional)
              </label>
              <input
                id="profile-photo-credit"
                type="text"
                value={ctx.photoCaption}
                onChange={(e) => ctx.setPhotoCaption(e.target.value)}
                placeholder="Name, studio, or @username"
                className="w-full px-4 py-3 bg-dc-surface-muted border border-dc-border rounded-lg text-dc-text text-sm"
              />
              {ctx.photoCaption.trim() ?
                <ProfilePhotoCredit caption={ctx.photoCaption} className="mt-2" />
              : null}
              {ctx.photoMetaSaving ?
                <p className="mt-1 text-xs text-dc-muted">Saving photo options…</p>
              : null}
            </div>
          </div>
        : null}
        </ProfileStudioInsetCard>
      </div>
    </ProfileStudioSectionCard>
  )
}
