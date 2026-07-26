import { useEffect, useId, useState } from 'react'

import { Link } from 'react-router-dom'

import {

  ageFromBirthDate,

  formatProfileBirthDateForInput,

  parsePronounTags,

  profileBirthDateInputBounds,

  PROFILE_PRONOUN_MAX,

  PROFILE_PHOTO_GUIDELINES,

  safeInternalPath,

} from '@c2k/shared'

import TagMultiSelect from '@/components/ui/TagMultiSelect'
import ProfileBirthDateField from '@/components/profile/ProfileBirthDateField'
import ZipLocationCandidatePicker from '@/components/profile/ZipLocationCandidatePicker'
import type { ZipPlaceCandidate } from '@/lib/profile-edit-location'
import { uploadProfilePhotoFile, attachUploadedProfilePhoto } from '@/lib/profile-photo-upload'
import { getProfileOnboardingGaps } from '@/lib/profile-onboarding'


const PRONOUN_PRESETS = ['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Any pronouns', 'Ask me']





type Props = {

  redirectAfter?: string | null

  onCompleted?: () => void

}



export default function ProfileFinishPanel({ redirectAfter, onCompleted }: Props) {

  const zipId = useId()

  const birthId = useId()

  const photoInputId = useId()

  const [homeZip, setHomeZip] = useState('')

  const [zipError, setZipError] = useState<string | null>(null)

  const [locationDisplay, setLocationDisplay] = useState('')

  const [zipCandidates, setZipCandidates] = useState<ZipPlaceCandidate[]>([])

  const [zipLocality, setZipLocality] = useState<string | null>(null)

  const [placeId, setPlaceId] = useState<string | null>(null)

  const [stateId, setStateId] = useState<string | null>(null)

  const [birthDate, setBirthDate] = useState('')

  const [pronounTags, setPronounTags] = useState<string[]>([])

  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [hasPhoto, setHasPhoto] = useState(false)

  const [isDragging, setIsDragging] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  const [finished, setFinished] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const bounds = profileBirthDateInputBounds()



  const afterPath = safeInternalPath(redirectAfter ?? undefined) ?? '/home'



  useEffect(() => {

    let cancelled = false

    void (async () => {

      try {

        const r = await fetch('/api/profile/me', { credentials: 'include' })

        if (!r.ok || cancelled) return

        const raw = (await r.json()) as {

          profile?: {

            homeZip?: string | null

            location?: string | null

            birthDate?: string | null

            pronounTags?: string[]

            pronouns?: string | null

          }

        }

        const p = raw.profile

        if (!p || cancelled) return

        if (p.homeZip) setHomeZip(p.homeZip)

        if (p.location) setLocationDisplay(p.location)

        setBirthDate(formatProfileBirthDateForInput(p.birthDate))

        setPronounTags(parsePronounTags(p.pronounTags ?? p.pronouns))

        const photos = await fetch('/api/profile/me/photos', { credentials: 'include' })

        if (photos.ok) {

          const pd = (await photos.json()) as { items?: unknown[] }

          if ((pd.items?.length ?? 0) > 0) setHasPhoto(true)

        }

      } catch {

        /* optional */

      }

    })()

    return () => {

      cancelled = true

    }

  }, [])



  const canComplete = getProfileOnboardingGaps({
    homeZip,
    birthDate,
    photoCount: hasPhoto ? 1 : 0,
  }).length === 0



  const applyFile = (file: File | undefined) => {

    if (!file || !file.type.startsWith('image/')) return

    setPhotoFile(file)

    setHasPhoto(true)

    setError(null)

  }



  function selectZipCandidate(candidatePlaceId: string) {

    const hit = zipCandidates.find((c) => c.placeId === candidatePlaceId)

    if (!hit) return

    setPlaceId(candidatePlaceId)

    setLocationDisplay(hit.display)

  }



  async function lookupZip() {

    const zip = homeZip.replace(/\D/g, '').slice(0, 5)

    if (zip.length < 5) {

      setZipError('Enter a 5-digit ZIP.')

      return

    }

    setZipError(null)

    setZipCandidates([])

    setZipLocality(null)

    setPlaceId(null)

    setLocationDisplay('')

    const r = await fetch(`/api/locations/by-zip?zip=${encodeURIComponent(zip)}`, { credentials: 'include' })

    const data = (await r.json().catch(() => ({}))) as {
      error?: string
      stateId?: string
      zipLocality?: string
      candidates?: ZipPlaceCandidate[]
    }

    if (!r.ok) {
      setZipError(data.error ?? 'ZIP not found.')
      return
    }

    setZipCandidates(data.candidates ?? [])

    setZipLocality(data.zipLocality ?? null)

    setStateId(data.stateId ?? null)

    setHomeZip(zip)

  }



  async function handleComplete() {

    if (!canComplete) return

    setError(null)

    if (birthDate.trim()) {

      const age = ageFromBirthDate(birthDate)

      if (age == null || age < 18) {

        setError('Birth date must indicate you are at least 18.')

        return

      }

    }

    setSubmitting(true)

    try {

      if (photoFile) {

        const uploaded = await uploadProfilePhotoFile(photoFile)

        if (!uploaded.url && !uploaded.quarantineKey) {

          setError('Could not upload photo. Try a smaller image or check your connection.')

          return

        }

        const attached = await attachUploadedProfilePhoto(uploaded, 0)

        if (!attached.ok) {

          setError(attached.error)

          return

        }

      }

      const patchBody: Record<string, unknown> = {

        homeZip: homeZip.replace(/\D/g, '').slice(0, 5),

        birthDate: birthDate.trim(),

        pronounTags,

        placeId,

        stateId,

      }

      const profileRes = await fetch('/api/profile/me', {

        method: 'PATCH',

        credentials: 'include',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(patchBody),

      })

      if (!profileRes.ok) {

        const j = (await profileRes.json().catch(() => ({}))) as { error?: string }

        setError(j.error ?? 'Could not save profile.')

        return

      }

      onCompleted?.()

      setFinished(true)

    } catch {

      setError('Network error. Try again.')

    } finally {

      setSubmitting(false)

    }

  }



  if (finished) {
    return (
      <section className="mb-10 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 shadow-[var(--dc-shadow-soft)]">
        <h2 className="text-xl font-bold text-dc-text mb-1">You&apos;re all set</h2>
        <p className="text-sm text-dc-text-muted mb-5">
          Your profile has the essentials. Here&apos;s what to do next:
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <Link
            to="/events"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
          >
            Find events near you
          </Link>
          <Link
            to={afterPath}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-5 text-sm font-medium text-dc-text hover:bg-dc-elevated-muted"
          >
            Go to home
          </Link>
          <Link
            to="/profile/edit"
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-medium text-dc-accent hover:underline"
          >
            Add more profile details
          </Link>
        </div>
      </section>
    )
  }

  return (

    <section className="mb-10 rounded-2xl border border-dc-accent-border/40 bg-dc-elevated/95 p-6 shadow-[var(--dc-shadow-soft)]">

      <h2 className="text-xl font-bold text-dc-text mb-1">Finish your profile</h2>

      <p className="text-sm text-dc-text-muted mb-6">

        Set your ZIP, date of birth, pronouns, and profile photo so people can find you.

      </p>

      <div className="space-y-6">

        <div>

          <label htmlFor={zipId} className="block text-sm font-medium text-dc-text mb-2">

            ZIP code

          </label>

          <div className="flex flex-wrap gap-2">

            <input

              id={zipId}

              type="text"

              inputMode="numeric"

              maxLength={10}

              placeholder="12345"

              value={homeZip}

              onChange={(e) => {
                setHomeZip(e.target.value)
                setZipCandidates([])
                setZipLocality(null)
                setPlaceId(null)
                setLocationDisplay('')
                setZipError(null)
              }}

              onBlur={() => {
                if (homeZip.replace(/\D/g, '').length >= 5) void lookupZip()
              }}

              className="w-32 min-h-11 px-4 py-2 bg-dc-surface-muted border border-dc-border rounded-lg text-dc-text"

            />

            <button

              type="button"

              onClick={() => void lookupZip()}

              className="min-h-11 px-4 rounded-lg border border-dc-border text-sm hover:bg-dc-elevated-muted"

            >

              Look up city

            </button>

          </div>

          {zipError ?

            <p className="mt-1 text-xs text-red-400">{zipError}</p>

          : null}

          {zipCandidates.length > 0 ?

            <ZipLocationCandidatePicker

              candidates={zipCandidates}

              selectedPlaceId={placeId}

              onSelect={selectZipCandidate}

              zipLocality={zipLocality}

            />

          : locationDisplay ?

            <p className="mt-2 text-sm text-dc-text-muted rounded-lg border border-dc-border px-3 py-2">{locationDisplay}</p>

          : null}

        </div>



        <div>

          <label htmlFor={birthId} className="block text-sm font-medium text-dc-text mb-2">

            Date of birth

          </label>

          <ProfileBirthDateField
            id={birthId}
            value={birthDate}
            bounds={bounds}
            onChange={setBirthDate}
            className="max-w-md"
          />

        </div>



        <TagMultiSelect

          label="Pronouns"

          values={pronounTags}

          onChange={setPronounTags}

          suggestions={PRONOUN_PRESETS}

          maxCount={PROFILE_PRONOUN_MAX}

        />



        <div>

          <span className="block text-sm font-medium text-dc-text mb-2" id={`${photoInputId}-label`}>

            Main profile photo

          </span>

          <input id={photoInputId} type="file" accept="image/*" className="sr-only" onChange={(e) => applyFile(e.target.files?.[0])} />

          <label

            htmlFor={photoInputId}

            onDragOver={(e) => {

              e.preventDefault()

              setIsDragging(true)

            }}

            onDragLeave={() => setIsDragging(false)}

            onDrop={(e) => {

              e.preventDefault()

              setIsDragging(false)

              applyFile(e.dataTransfer.files?.[0])

            }}

            className={`aspect-video max-w-xs block rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer p-4 text-center text-sm ${

              isDragging ? 'border-dc-accent bg-dc-accent/10' : 'border-dc-border bg-dc-elevated-solid'

            }`}

          >

            {hasPhoto ? 'Photo ready. Tap to change' : 'Tap or drop an image'}

          </label>

          <ul className="mt-3 space-y-1 text-xs text-dc-muted">

            {PROFILE_PHOTO_GUIDELINES.map((g, i) => (

              <li key={i}>{g.bold ? <strong className="text-dc-text">{g.bold}</strong> : null} {g.text}</li>

            ))}

          </ul>

        </div>

        {error ?

          <p className="text-sm text-red-200 rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2" role="alert">

            {error}

          </p>

        : null}

        <button

          type="button"

          disabled={!canComplete || submitting}

          onClick={() => void handleComplete()}

          className="w-full sm:w-auto min-h-11 px-6 py-2 font-semibold rounded-lg bg-dc-accent text-dc-accent-foreground disabled:opacity-50"

        >

          {submitting ? 'Saving…' : 'Save and continue'}

        </button>

      </div>

    </section>

  )

}


