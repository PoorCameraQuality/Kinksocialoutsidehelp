import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ageFromBirthDate,
  PROFILE_PRONOUN_MAX,
  profileBirthDateInputBounds,
} from '@c2k/shared'
import MarkdownContent from '@/components/ui/MarkdownContent'
import MarkdownRichEditor from '@/components/editor/MarkdownRichEditor'
import ProfileBirthDateField from '@/components/profile/ProfileBirthDateField'
import ProfilePhotoImage from '@/components/profile/ProfilePhotoImage'
import TagMultiSelect from '@/components/ui/TagMultiSelect'
import ProfileStudioInsetCard from '@/components/profile/studio/ProfileStudioInsetCard'
import ZipLocationCandidatePicker from '@/components/profile/ZipLocationCandidatePicker'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import { useProfileEdit } from '@/contexts/ProfileEditContext'
import { PLACE_CUSTOM, PLACE_STATE_ONLY } from '@/lib/profile-edit-location'

const PRONOUN_PRESETS = ['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Any pronouns', 'Ask me']

const ABOUT_TEMPLATE = `**Vanilla Me:**



---

**Kink Me:**



`

export default function OverviewPanel() {
  const ctx = useProfileEdit()
  const [previewBio, setPreviewBio] = useState(false)
  const birthDateBounds = useMemo(() => profileBirthDateInputBounds(), [])
  const displayNameFallback =
    (ctx.profileMe.data?.profile.displayName as string | null)?.trim() ||
    ctx.profileMe.data?.user.username ||
    ctx.viewerUsername ||
    ''

  return (
    <div className="space-y-6">
      <ProfileStudioInsetCard className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-dc-text">First impression</h3>
          <p className="mt-1 text-xs text-dc-muted">
            Name, location, and pronouns appear in your profile header. The opening line of About becomes your headline.
          </p>
        </div>

        <div>
          <label htmlFor="overview-display-name" className="mb-1 block text-sm font-medium text-dc-text">
            Display name
          </label>
          <input
            id="overview-display-name"
            type="text"
            value={ctx.displayName}
            onChange={(e) => ctx.setDisplayName(e.target.value)}
            placeholder={displayNameFallback}
            className="w-full max-w-md rounded-lg border border-dc-border bg-dc-surface-muted px-4 py-3 text-dc-text"
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
          <label htmlFor="overview-birth-date" className="mb-1 block text-sm font-medium text-dc-text">
            Date of birth
          </label>
          <p className="mb-2 text-xs text-dc-muted">
            Required for age verification. Never shown on your public profile — only your age may appear when visibility allows.
          </p>
          <ProfileBirthDateField
            id="overview-birth-date"
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

        <div id="overview-location" className="space-y-3">
          <h4 className="text-sm font-medium text-dc-text">Location</h4>
          <p className="text-xs text-dc-muted">
            Enter your ZIP to set city and state. Control who sees this under{' '}
            <Link to="/profile/edit/presence?section=visibility" className="text-dc-accent hover:underline">
              Presence → Visibility
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-2">
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
              className="w-32 rounded-lg border border-dc-border bg-dc-surface-muted px-4 py-3 text-dc-text"
            />
            <button
              type="button"
              onClick={() => void ctx.lookupZip()}
              className="min-h-11 rounded-lg border border-dc-border px-4 text-sm text-dc-text hover:bg-dc-elevated-muted"
            >
              Look up
            </button>
          </div>
          {ctx.zipLookupError ?
            <p className="text-sm text-red-400" role="alert">
              {ctx.zipLookupError}
            </p>
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
            <p className="rounded-lg border border-dc-border px-3 py-2 text-sm text-dc-text-muted">
              {ctx.locationLabel}
            </p>
          : null}
          {ctx.stateId ?
            <details className="text-sm" open={ctx.zipCandidates.length > 0}>
              <summary className="cursor-pointer text-dc-accent">City not right? Pick manually</summary>
              <div className="mt-3 space-y-2">
                <select
                  value={ctx.placeSelect}
                  onChange={(e) => {
                    const value = e.target.value
                    ctx.setPlaceSelect(value)
                    if (value !== PLACE_CUSTOM) ctx.setCustomLocation('')
                  }}
                  className="w-full rounded-lg border border-dc-border bg-dc-surface-muted px-4 py-3 text-dc-text"
                >
                  <option value="">Choose…</option>
                  <option value={PLACE_STATE_ONLY}>State only (no city)</option>
                  {ctx.places.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                    </option>
                  ))}
                  <option value={PLACE_CUSTOM}>Other (type below)</option>
                </select>
                {ctx.placeSelect === PLACE_CUSTOM ?
                  <input
                    type="text"
                    placeholder="Custom town or area"
                    value={ctx.customLocation}
                    onChange={(e) => ctx.setCustomLocation(e.target.value)}
                    className="w-full rounded-lg border border-dc-border bg-dc-surface-muted px-4 py-3 text-dc-text"
                  />
                : null}
              </div>
            </details>
          : null}
        </div>
      </ProfileStudioInsetCard>

      <ProfileStudioInsetCard className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-dc-text">About me</h3>
          <p className="mt-1 text-xs text-dc-muted">
            Your full story. The first sentence appears in your profile hero; the rest shows in About.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-dc-border/60 pb-2">
          <button
            type="button"
            onClick={() => setPreviewBio(false)}
            className={`min-h-10 rounded px-3 py-1.5 text-sm ${!previewBio ? 'bg-dc-elevated-muted text-dc-text' : 'text-dc-muted'}`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setPreviewBio(true)}
            className={`min-h-10 rounded px-3 py-1.5 text-sm ${previewBio ? 'bg-dc-elevated-muted text-dc-text' : 'text-dc-muted'}`}
          >
            Preview
          </button>
          {!ctx.bio.trim() ?
            <button
              type="button"
              onClick={() => ctx.setBio(ABOUT_TEMPLATE)}
              className="ml-auto min-h-10 text-xs text-dc-accent hover:underline"
            >
              Insert Vanilla / Kink template
            </button>
          : null}
        </div>

        {previewBio ?
          <MarkdownContent
            markdown={ctx.bio}
            className="min-h-[200px] px-1"
            emptyFallback={<span className="italic text-dc-muted">Nothing written yet.</span>}
          />
        : <MarkdownRichEditor value={ctx.bio} onChange={ctx.setBio} />}
      </ProfileStudioInsetCard>

      <ProfileStudioInsetCard className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-dc-text">Profile picture</h3>
            <p className="mt-1 text-xs text-dc-muted">
              Upload, frame, and manage photos in the Photos section.
            </p>
          </div>
          <Link
            to="/profile/edit/photos"
            className="inline-flex min-h-10 items-center rounded-lg border border-dc-border px-3 text-sm font-medium text-dc-accent hover:bg-dc-accent-muted/20"
          >
            Manage photos
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-dc-border bg-dc-surface-muted">
            {ctx.photoPreviewUrl ?
              <ProfilePhotoImage
                src={ctx.photoPreviewUrl}
                displaySettings={ctx.photoDisplaySettings}
                className="h-full w-full"
              />
            : (
              <div className="flex h-full items-center justify-center">
                <PlaceholderAvatar size="md" className="!rounded-xl" />
              </div>
            )}
          </div>
          <p className="text-sm text-dc-text-muted">
            {ctx.hasPhoto ?
              'You have a profile picture set.'
            : 'No profile picture yet — add one in Photos.'}
          </p>
        </div>
      </ProfileStudioInsetCard>
    </div>
  )
}
