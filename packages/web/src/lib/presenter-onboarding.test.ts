import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  profileKindFromFocuses,
  formatProfileFocusLabels,
  parseOnboardingTrack,
} from './presenter-focus.ts'
import {
  EDUCATOR_STEPS,
  SPEAKER_STEPS,
  AUTHOR_STEPS,
  PHOTOGRAPHER_STEPS,
  FORBIDDEN_ONBOARDING_COPY,
  initialPresenterOnboardingStep,
  stepsForTrack,
} from './presenter-onboarding.ts'

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const routerSrc = readFileSync(
  join(webRoot, 'components/presenters/onboarding/PresenterOnboardingRouter.tsx'),
  'utf8'
)
const visibilitySrc = readFileSync(
  join(webRoot, 'components/presenters/onboarding/shared/VisibilityStep.tsx'),
  'utf8'
)
const presenterPageSrc = readFileSync(join(webRoot, 'app/presenters/[username]/page.tsx'), 'utf8')
const scopeMetaSrc = readFileSync(join(webRoot, 'components/seo/ScopePageMeta.tsx'), 'utf8')
const chooserSrc = readFileSync(
  join(webRoot, 'components/presenters/onboarding/PresenterTrackChooser.tsx'),
  'utf8'
)

describe('presenter focus mapping', () => {
  it('educator maps to profileKind PRES', () => {
    assert.equal(profileKindFromFocuses(['EDUCATOR']), 'PRES')
  })

  it('speaker maps to profileKind PRES', () => {
    assert.equal(profileKindFromFocuses(['SPEAKER', 'PANELIST']), 'PRES')
  })

  it('author maps to profileKind AUTHOR', () => {
    assert.equal(profileKindFromFocuses(['AUTHOR']), 'AUTHOR')
  })

  it('photographer maps to profileKind PHOTO', () => {
    assert.equal(profileKindFromFocuses(['PHOTOGRAPHER']), 'PHOTO')
  })

  it('hybrid with author and educator maps to BOTH', () => {
    assert.equal(profileKindFromFocuses(['AUTHOR', 'EDUCATOR']), 'BOTH')
  })

  it('formats multi-focus labels', () => {
    assert.equal(formatProfileFocusLabels(['EDUCATOR', 'AUTHOR'], 'EDUCATOR'), 'Educator and author')
  })
})

describe('presenter onboarding tracks', () => {
  it('parseOnboardingTrack returns correct track', () => {
    assert.equal(parseOnboardingTrack('educator'), 'educator')
    assert.equal(parseOnboardingTrack('speaker'), 'speaker')
    assert.equal(parseOnboardingTrack('invalid'), null)
  })

  it('educator step config includes teaching modules', () => {
    assert.ok(EDUCATOR_STEPS.includes('teachingStyle'))
    assert.ok(EDUCATOR_STEPS.includes('catalog'))
  })

  it('author step config does not require catalog before review', () => {
    assert.ok(AUTHOR_STEPS.includes('optionalTalks'))
    assert.equal(
      initialPresenterOnboardingStep({
        track: 'author',
        profileFocuses: ['AUTHOR'],
        primaryProfileFocus: 'AUTHOR',
        profile: {
          headline: 'Writer',
          bio: 'Bio',
          directoryVisibility: 'UNLISTED',
          expertiseTags: [],
          links: { Website: 'https://example.com' },
        },
        offeringCount: 0,
        galleryCount: 0,
        skillClaimCount: 0,
        optionalTalksSkipped: true,
      }),
      'review'
    )
  })

  it('photographer resume requires gallery or portfolio', () => {
    assert.equal(
      initialPresenterOnboardingStep({
        track: 'photographer',
        profileFocuses: ['PHOTOGRAPHER'],
        primaryProfileFocus: 'PHOTOGRAPHER',
        profile: { headline: 'Lens', directoryVisibility: 'UNLISTED', expertiseTags: [] },
        offeringCount: 0,
        galleryCount: 0,
        skillClaimCount: 0,
      }),
      'portfolioGallery'
    )
  })

  it('speaker resume requires topics or offering', () => {
    assert.equal(
      initialPresenterOnboardingStep({
        track: 'speaker',
        profileFocuses: ['SPEAKER'],
        primaryProfileFocus: 'SPEAKER',
        profile: { headline: 'Talks', directoryVisibility: 'UNLISTED', expertiseTags: [] },
        offeringCount: 0,
        galleryCount: 0,
        skillClaimCount: 0,
      }),
      'topicsFormats'
    )
  })

  it('unlisted visibility is allowed in resume', () => {
    const step = initialPresenterOnboardingStep({
      track: 'educator',
      profileFocuses: ['EDUCATOR'],
      primaryProfileFocus: 'EDUCATOR',
      profile: { headline: 'Teach', directoryVisibility: 'UNLISTED', expertiseTags: [] },
      offeringCount: 1,
      galleryCount: 0,
      skillClaimCount: 0,
      catalogSkipped: false,
    })
    assert.notEqual(step, 'visibility')
  })

  it('hybrid steps combine modules without duplicate basics', () => {
    const steps = stepsForTrack('hybrid', ['EDUCATOR', 'AUTHOR'])
    assert.equal(steps.filter((s) => s === 'basics').length, 1)
    assert.ok(steps.includes('educatorModule'))
    assert.ok(steps.includes('authorModule'))
  })
})

describe('presenter onboarding UI copy', () => {
  it('track chooser renders all five cards', () => {
    assert.match(chooserSrc, /Educator or instructor/)
    assert.match(chooserSrc, /Presenter, speaker, or panelist/)
    assert.match(chooserSrc, /Author or writer/)
    assert.match(chooserSrc, /Photographer or media creator/)
    assert.match(chooserSrc, /Hybrid profile/)
  })

  it('router uses track-specific copy', () => {
    assert.match(routerSrc, /Teaching style and audience/)
    assert.match(routerSrc, /Topics and formats/)
    assert.match(routerSrc, /Writing focus/)
    assert.match(routerSrc, /Consent, privacy, and delivery/)
  })

  it('no user-facing coming soon copy in onboarding sources', () => {
    const userFacingPatterns = [
      /coming soon/i,
      /not yet available/i,
      /future feature/i,
      /upload coming soon/i,
      /disabled for now/i,
      /under construction/i,
    ]
    for (const pattern of userFacingPatterns) {
      assert.doesNotMatch(routerSrc, pattern)
      assert.doesNotMatch(chooserSrc, pattern)
    }
  })

  it('photographer upload UI is URL-based only', () => {
    assert.match(routerSrc, /Gallery image URL/)
    assert.doesNotMatch(routerSrc, /type="file"/)
  })

  it('speaker and educator steps exist in configs', () => {
    assert.ok(SPEAKER_STEPS.includes('sessionCatalog'))
    assert.ok(PHOTOGRAPHER_STEPS.includes('services'))
  })

  it('onboarding does not force PUBLIC visibility or BOTH profileKind', () => {
    assert.doesNotMatch(routerSrc, /directoryVisibility:\s*'PUBLIC'/)
    assert.doesNotMatch(routerSrc, /profileKind:\s*'BOTH'/)
    assert.match(routerSrc, /useState<'PUBLIC' \| 'UNLISTED'>\('UNLISTED'\)/)
  })

  it('author track allows finishing without offering when skipped', () => {
    const step = initialPresenterOnboardingStep({
      track: 'author',
      profileFocuses: ['AUTHOR'],
      primaryProfileFocus: 'AUTHOR',
      profile: {
        headline: 'Writer',
        bio: 'Essays',
        directoryVisibility: 'UNLISTED',
        expertiseTags: [],
        links: { Website: 'https://example.com' },
      },
      offeringCount: 0,
      galleryCount: 0,
      skillClaimCount: 0,
      optionalTalksSkipped: true,
    })
    assert.equal(step, 'review')
  })

  it('photographer track requires portfolio or gallery before services', () => {
    assert.equal(
      initialPresenterOnboardingStep({
        track: 'photographer',
        profileFocuses: ['PHOTOGRAPHER'],
        primaryProfileFocus: 'PHOTOGRAPHER',
        profile: { headline: 'Lens', directoryVisibility: 'UNLISTED', expertiseTags: [] },
        offeringCount: 0,
        galleryCount: 0,
        skillClaimCount: 0,
      }),
      'portfolioGallery'
    )
  })

  it('unlisted visibility copy explains direct-link behavior', () => {
    assert.match(visibilitySrc, /do not appear in the presenter directory or people search/)
    assert.match(visibilitySrc, /anyone with the direct[\s\S]*link/)
  })

  it('unlisted presenter profiles emit noindex meta', () => {
    assert.match(presenterPageSrc, /noIndex=\{p\.directoryVisibility === 'UNLISTED'\}/)
    assert.match(scopeMetaSrc, /KINK_SOCIAL_ROBOTS_META/)
  })
})
