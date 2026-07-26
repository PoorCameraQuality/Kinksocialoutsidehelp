import {
  VENDOR_TAG_MAX,
  normalizeVendorTags,
  normalizeVendorWebsite,
  vendorCategoriesFromRow,
  type VendorCategory,
} from '@c2k/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import VendorExternalStorePanel from '@/components/VendorExternalStorePanel'
import VendorCatalogPanel from '@/components/vendors/VendorCatalogPanel'
import VendorCategoryPicker from '@/components/vendors/VendorCategoryPicker'
import VendorIntegrationGuide from '@/components/vendors/VendorIntegrationGuide'
import VendorShopAppearancePanel from '@/components/vendors/VendorShopAppearancePanel'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { useApiVendorMe } from '@/hooks/useApiVendorMe'
import { usePersistFormDraft, useSessionFormDraft } from '@/hooks/useSessionFormDraft'
import type { ApiVendorRow } from '@/lib/api-vendor-mapper'
import {
  fieldErrorClass,
  focusFirstInvalidField,
  formatVendorProfileSaveError,
  type ApiErrorBody,
} from '@/lib/api-errors'
import {
  FormStatusMessage,
  WizardField,
  WizardFooter,
  WizardSelect,
  WizardShell,
  WizardStepHeader,
  WizardTextarea,
  type WizardStepMeta,
} from '@/components/ui/primitives'
import {
  initialOnboardingStep,
  VENDOR_BASICS_CONTINUE_LABEL,
  VENDOR_BASICS_HEADING,
  VENDOR_BASICS_INTRO,
  VENDOR_CONNECTOR_PREVIEW,
  VENDOR_INVENTORY_HEADING,
  VENDOR_INVENTORY_INTRO,
  VENDOR_ONBOARDING_STEP_LABELS,
  VENDOR_ONBOARDING_STEPS,
  type VendorOnboardingStep,
  vendorHasInventoryReady,
  vendorHasStoreConnector,
  vendorIsPublished,
} from '@/lib/vendor-onboarding'

const VENDOR_ONBOARDING_DRAFT_KEY = 'c2k:vendor-onboarding-draft'

type VendorOnboardingDraft = {
  step: VendorOnboardingStep
  displayName: string
  slug: string
  bio: string
  makerStory: string
  website: string
  shipsTo: 'US' | 'Canada' | 'International'
  categories: VendorCategory[]
  tags: string[]
}

const ONBOARDING_FIELD_IDS: Record<string, string> = {
  displayName: 'wf-von-name',
  bio: 'wf-von-bio',
  makerStory: 'wf-von-maker',
  website: 'wf-von-web',
  shipsTo: 'wf-von-ships',
  categories: 'vendor-categories',
  tags: 'von-tags',
}

const vicon = (path: string) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={path} />
  </svg>
)

const STEP_ICONS: Record<VendorOnboardingStep, string> = {
  welcome: 'M5 3v4M3 5h4m6-2l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z',
  basics: 'M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8l1 11a2 2 0 002 2h8a2 2 0 002-2l1-11',
  inventory: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  appearance: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  publish: 'M5 13l4 4L19 7',
}

const STEPS: WizardStepMeta[] = VENDOR_ONBOARDING_STEPS.map((id) => ({
  id,
  label: VENDOR_ONBOARDING_STEP_LABELS[id],
  icon: vicon(STEP_ICONS[id]),
}))

export default function VendorOnboardingWizard() {
  const { isAuthenticated } = useAuth()
  const { status, vendor, reload } = useApiVendorMe(isAuthenticated)
  const { restore, clear, markRestored, hasRestored } = useSessionFormDraft<VendorOnboardingDraft>(
    VENDOR_ONBOARDING_DRAFT_KEY,
  )
  const [step, setStep] = useState<VendorOnboardingStep>('welcome')
  const [resumeApplied, setResumeApplied] = useState(false)
  const [inventorySkipped, setInventorySkipped] = useState(false)
  const [curatedCount, setCuratedCount] = useState(0)
  const [advancedSyncOpen, setAdvancedSyncOpen] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [slug, setSlug] = useState('')
  const [bio, setBio] = useState('')
  const [makerStory, setMakerStory] = useState('')
  const [website, setWebsite] = useState('')
  const [shipsTo, setShipsTo] = useState<'US' | 'Canada' | 'International'>('US')
  const [categories, setCategories] = useState<VendorCategory[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [basicsErr, setBasicsErr] = useState<string | null>(null)
  const [basicsFieldErrors, setBasicsFieldErrors] = useState<Record<string, string>>({})
  const [basicsBusy, setBasicsBusy] = useState(false)

  const [publishBusy, setPublishBusy] = useState(false)
  const [publishErr, setPublishErr] = useState<string | null>(null)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)

  const draftSnapshot = useMemo(
    (): VendorOnboardingDraft => ({
      step,
      displayName,
      slug,
      bio,
      makerStory,
      website,
      shipsTo,
      categories,
      tags,
    }),
    [bio, categories, displayName, makerStory, shipsTo, slug, step, tags, website],
  )

  usePersistFormDraft(VENDOR_ONBOARDING_DRAFT_KEY, draftSnapshot, isAuthenticated && step !== 'welcome')

  useEffect(() => {
    if (hasRestored()) return
    const draft = restore()
    if (draft) {
      setStep(draft.step)
      setDisplayName(draft.displayName)
      setSlug(draft.slug)
      setBio(draft.bio)
      setMakerStory(draft.makerStory)
      setWebsite(draft.website)
      setShipsTo(draft.shipsTo)
      setCategories(draft.categories)
      setTags(draft.tags)
      markRestored()
      setResumeApplied(true)
    }
  }, [hasRestored, markRestored, restore])

  useEffect(() => {
    if (status !== 'ready' || resumeApplied || !vendor) return
    if (hasRestored()) {
      setResumeApplied(true)
      return
    }
    setDisplayName(vendor.displayName ?? '')
    setSlug(vendor.slug ?? '')
    setBio(vendor.bio ?? '')
    setMakerStory(vendor.makerStory ?? '')
    setWebsite(vendor.website ?? '')
    setShipsTo((vendor.shipsTo as typeof shipsTo) ?? 'US')
    setCategories(vendorCategoriesFromRow({ category: vendor.category, categories: vendor.categories }))
    setTags(vendor.tags ?? [])
    setTagInput('')
    setStep(initialOnboardingStep(vendor))
    setResumeApplied(true)
  }, [status, vendor, resumeApplied, hasRestored])

  const activeVendor = vendor
  const inventoryReady = vendorHasInventoryReady(activeVendor, {
    curatedCount,
    skipped: inventorySkipped,
  })

  const externalStoreType = activeVendor?.externalStoreType ?? (activeVendor?.usesEtsy ? 'etsy' : 'none')
  const etsyShopUrl = activeVendor?.etsyShopUrl ?? ''
  const wooPub = activeVendor?.externalStorePublic as {
    wooSiteUrl?: string
    shopifyShop?: string
  } | undefined
  const syncedAt = activeVendor?.externalListingsSyncedAt ?? activeVendor?.etsyListingsSyncedAt ?? null
  const syncError = activeVendor?.externalSyncError ?? activeVendor?.etsySyncError ?? null

  const addTagsFromInput = () => {
    const parts = tagInput.split(/[,]+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length === 0) return
    setTags((prev) => normalizeVendorTags([...prev, ...parts]))
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  const applyBasicsError = useCallback((body: ApiErrorBody) => {
    const parsed = formatVendorProfileSaveError(body)
    setBasicsErr(parsed.message)
    setBasicsFieldErrors(parsed.fieldErrors)
    focusFirstInvalidField(parsed.fieldErrors, ONBOARDING_FIELD_IDS)
  }, [])

  const createShop = useCallback(async () => {
    setBasicsErr(null)
    setBasicsFieldErrors({})
    setBasicsBusy(true)
    try {
      const body: Record<string, unknown> = {
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        makerStory: makerStory.trim() || undefined,
        shipsTo,
        categories: categories.length ? categories : undefined,
        tags: tags.length ? tags : undefined,
      }
      const s = slug.trim()
      if (s) body.slug = s
      const w = website.trim()
      if (w) {
        const normalized = normalizeVendorWebsite(w)
        if (normalized) body.website = normalized
      }
      const r = await fetch('/api/v1/vendors', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = (await r.json().catch(() => ({}))) as ApiErrorBody & { vendor?: ApiVendorRow }
      if (r.status === 409 && j.vendor?.slug) {
        clear()
        reload()
        setStep('inventory')
        return
      }
      if (!r.ok) {
        applyBasicsError(j)
        return
      }
      clear()
      reload()
      setStep('inventory')
    } catch {
      setBasicsErr('Network error')
    } finally {
      setBasicsBusy(false)
    }
  }, [applyBasicsError, bio, categories, clear, displayName, makerStory, reload, shipsTo, slug, tags, website])

  const submitBasics = useCallback(async () => {
    if (!displayName.trim()) {
      setBasicsErr('Add a shop name to continue.')
      setBasicsFieldErrors({ displayName: 'Required' })
      focusFirstInvalidField({ displayName: 'Required' }, ONBOARDING_FIELD_IDS)
      return
    }
    if (activeVendor) {
      setBasicsBusy(true)
      setBasicsErr(null)
      setBasicsFieldErrors({})
      try {
        const r = await fetch('/api/v1/me/vendor-profile', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: displayName.trim(),
            bio: bio.trim() || null,
            makerStory: makerStory.trim() || null,
            website: website.trim() ? normalizeVendorWebsite(website) : null,
            shipsTo,
            categories,
            tags,
          }),
        })
        const j = (await r.json().catch(() => ({}))) as ApiErrorBody
        if (!r.ok) {
          applyBasicsError(j)
          return
        }
        clear()
        reload()
        setStep('inventory')
      } catch {
        setBasicsErr('Network error')
      } finally {
        setBasicsBusy(false)
      }
      return
    }
    await createShop()
  }, [activeVendor, applyBasicsError, bio, categories, clear, createShop, displayName, makerStory, reload, shipsTo, tags, website])

  async function publishShop() {
    if (!activeVendor) return
    setPublishBusy(true)
    setPublishErr(null)
    setPublishMsg(null)
    try {
      const r = await fetch('/api/v1/me/vendor-profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: activeVendor.displayName, visibility: 'PUBLIC' }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setPublishErr(j.error ?? 'Could not publish shop')
        return
      }
      clear()
      setPublishMsg('Your shop is live in the vendor directory.')
      reload()
    } catch {
      setPublishErr('Network error')
    } finally {
      setPublishBusy(false)
    }
  }

  const published = vendorIsPublished(activeVendor)
  const finishHref = activeVendor?.slug ? `/vendors/${encodeURIComponent(activeVendor.slug)}` : '/vendors'
  const tagsAtCap = tags.length >= VENDOR_TAG_MAX

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="mb-2 text-xl font-bold text-dc-text">Sign in to set up your shop</h1>
        <p className="mb-6 text-sm text-dc-text-muted">
          Vendor shops are tied to your Kink Social profile. One shop per account.
        </p>
        <Link
          to={buildLoginHref('/vendors/onboarding')}
          className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Sign in
        </Link>
      </div>
    )
  }

  if (status === 'loading' || status === 'idle') {
    return <div className="mx-auto h-48 max-w-5xl animate-pulse rounded-2xl bg-dc-elevated-muted px-4 py-12" />
  }

  const footer = (() => {
    switch (step) {
      case 'welcome':
        return (
          <WizardFooter
            next={{
              label: activeVendor ? 'Continue setup' : 'Get started',
              onClick: () => setStep(activeVendor ? initialOnboardingStep(activeVendor) : 'basics'),
            }}
          />
        )
      case 'basics':
        return (
          <WizardFooter
            back={{ label: 'Back', onClick: () => setStep('welcome') }}
            next={{
              label: VENDOR_BASICS_CONTINUE_LABEL,
              loading: basicsBusy,
              disabled: !displayName.trim(),
              onClick: () => void submitBasics(),
            }}
          />
        )
      case 'inventory':
        if (!activeVendor) {
          return <WizardFooter next={{ label: 'Shop basics', onClick: () => setStep('basics') }} />
        }
        return (
          <WizardFooter
            back={{ label: 'Back', onClick: () => setStep('basics') }}
            skip={
              !inventoryReady ?
                {
                  label: 'Skip for now',
                  onClick: () => {
                    setInventorySkipped(true)
                    setStep('appearance')
                  },
                }
              : undefined
            }
            next={{ label: 'Continue', disabled: !inventoryReady, onClick: () => setStep('appearance') }}
          />
        )
      case 'appearance':
        return (
          <WizardFooter
            back={{ label: 'Back', onClick: () => setStep('inventory') }}
            skip={{ label: 'Skip', onClick: () => setStep('publish') }}
            next={{ label: 'Continue', onClick: () => setStep('publish') }}
          />
        )
      case 'publish':
        if (!activeVendor) {
          return <WizardFooter next={{ label: 'Shop basics', onClick: () => setStep('basics') }} />
        }
        return (
          <WizardFooter
            back={{ label: 'Back', onClick: () => setStep('appearance') }}
            next={{ label: 'View shop', href: finishHref }}
          />
        )
      default:
        return null
    }
  })()

  return (
    <WizardShell
      brand="Vendor setup"
      title="Set up your vendor shop"
      description="Showcase your catalog on kink.social. Checkout always happens on your own store — we never take payments here."
      steps={STEPS}
      currentStepId={step}
      onStepSelect={(id) => setStep(id as VendorOnboardingStep)}
      footer={footer}
    >
      {step === 'welcome' ? (
        <div>
          <WizardStepHeader
            icon={vicon(STEP_ICONS.welcome)}
            eyebrow="Welcome"
            title="Set up your vendor shop"
            description="Feature curated products, import a CSV, or link your storefront. Checkout always happens on your store; we never take payments here."
          />
          <ul className="list-disc space-y-2 pl-5 text-sm text-dc-text-muted">
            <li>One shop per account, linked to your profile</li>
            <li>Showcase products for home and discovery (curated, CSV, or optional API sync)</li>
            <li>Get listed on events and conventions when organizers add you</li>
          </ul>
        </div>
      ) : null}

      {step === 'basics' ? (
        <div>
          <WizardStepHeader icon={vicon(STEP_ICONS.basics)} eyebrow="Vendor page" title={VENDOR_BASICS_HEADING} description={VENDOR_BASICS_INTRO} />

          <div className="mb-6 rounded-xl border border-dc-border bg-dc-elevated-muted/60 p-4" role="note" aria-label="Next step preview">
            <h3 className="text-sm font-semibold text-dc-text">Next step: add inventory</h3>
            <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
              After your vendor page is created, feature curated products, import a CSV, or link your storefront. Buyers
              browse on kink.social, then purchase through your external shop.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Inventory options on the next step">
              {VENDOR_CONNECTOR_PREVIEW.map((name) => (
                <li key={name} className="rounded-full border border-dc-border bg-dc-surface/50 px-3 py-1 text-xs text-dc-text-muted">
                  {name}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-5">
            <WizardField
              name="von-name"
              label="Shop / display name"
              hint="The public name buyers will see."
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={basicsFieldErrors.displayName ? true : undefined}
              className={fieldErrorClass(Boolean(basicsFieldErrors.displayName))}
            />
            {!activeVendor ? (
              <WizardField
                name="von-slug"
                label="Slug"
                optional
                hint="Used in your kink.social shop URL. Leave blank to generate one from your shop name."
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-leather-studio"
              />
            ) : null}
            <WizardTextarea
              name="von-bio"
              label="Bio"
              hint="A short summary of what you make, sell, or offer."
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <WizardTextarea
              name="von-maker"
              label="Maker story"
              hint="One or two sentences about who you make for, what you specialize in, and what makes your work different."
              rows={2}
              value={makerStory}
              onChange={(e) => setMakerStory(e.target.value)}
              placeholder="One sentence: who you make for (rope, leather, art prints...)"
            />
            <WizardField
              name="von-web"
              label="Main shop or website"
              optional
              type="text"
              hint="We'll add https:// if you paste a link without it. Your main storefront, portfolio, or business website."
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="etsy.com/shop/your-shop"
              aria-invalid={basicsFieldErrors.website ? true : undefined}
              className={fieldErrorClass(Boolean(basicsFieldErrors.website))}
            />

            <VendorCategoryPicker
              variant="cards"
              selected={categories}
              onChange={setCategories}
              error={basicsFieldErrors.categories ?? basicsFieldErrors.category ?? null}
            />

            <div>
              <label htmlFor="von-tags" className="block text-sm font-medium text-dc-text">
                Specialty tags <span className="font-normal text-dc-text-muted">(optional, up to {VENDOR_TAG_MAX})</span>
              </label>
              <p className="mt-1 text-xs text-dc-text-muted">
                Add searchable tags like rope, leather, commissions, pup gear, impact toys, aftercare, custom sizing.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  id="von-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTagsFromInput()
                    }
                  }}
                  disabled={tagsAtCap}
                  placeholder={tagsAtCap ? 'Tag limit reached' : 'rope, commissions, pup-play'}
                  aria-invalid={basicsFieldErrors.tags ? true : undefined}
                  className={`flex-1 rounded-xl border border-dc-border bg-dc-elevated px-3 py-2.5 text-base text-dc-text sm:text-sm ${fieldErrorClass(Boolean(basicsFieldErrors.tags))}`}
                />
                <button
                  type="button"
                  onClick={addTagsFromInput}
                  disabled={tagsAtCap}
                  className="min-h-touch rounded-xl border border-dc-border px-3 text-sm text-dc-text-muted hover:text-dc-text disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {basicsFieldErrors.tags ? (
                <p className="mt-1 text-xs text-red-200" role="alert">
                  {basicsFieldErrors.tags}
                </p>
              ) : null}
              {tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="rounded-full border border-dc-border px-2 py-1 text-xs text-dc-text-muted hover:text-dc-text"
                    >
                      {tag} ×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <WizardSelect
              name="von-ships"
              label="Ships to"
              hint="Choose where you ship or provide services."
              value={shipsTo}
              onChange={(e) => setShipsTo(e.target.value as typeof shipsTo)}
            >
              <option value="US">US</option>
              <option value="Canada">Canada</option>
              <option value="International">International</option>
            </WizardSelect>

            {basicsErr ? <FormStatusMessage tone="error">{basicsErr}</FormStatusMessage> : null}
          </div>
        </div>
      ) : null}

      {step === 'inventory' && activeVendor ? (
        <div>
          <WizardStepHeader icon={vicon(STEP_ICONS.inventory)} eyebrow="Inventory" title={VENDOR_INVENTORY_HEADING} description={VENDOR_INVENTORY_INTRO} />

          <div className="mb-5 rounded-xl border border-dc-accent-border/40 bg-dc-accent-muted/20 px-4 py-4" role="note">
            <p className="text-sm font-semibold text-dc-text">No checkout on kink.social</p>
            <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">
              kink.social does not process payment, manage shipping, handle taxes, or issue refunds. Your external shop
              remains the source of truth for purchases and fulfillment.
            </p>
          </div>

          {!inventoryReady ? (
            <p className="mb-4 text-sm text-dc-text-muted">
              Add at least one curated product, save a store link, connect with your own API keys, or skip for now.
            </p>
          ) : null}

          <VendorCatalogPanel
            enabled={Boolean(activeVendor)}
            variant="onboarding"
            onCatalogChange={setCuratedCount}
          />

          <VendorExternalStorePanel
            externalStoreType={externalStoreType}
            etsyShopUrl={etsyShopUrl}
            wooSiteUrl={wooPub?.wooSiteUrl}
            shopifyShop={wooPub?.shopifyShop}
            syncedAt={syncedAt}
            syncError={syncError}
            onUpdated={() => reload()}
            variant="link-only"
          />

          <div className="mb-4">
            <button
              type="button"
              onClick={() => setAdvancedSyncOpen((o) => !o)}
              className="text-sm font-semibold text-dc-text hover:text-dc-accent"
              aria-expanded={advancedSyncOpen}
            >
              {advancedSyncOpen ?
                '− Hide advanced API sync'
              : '+ Advanced: sync listings with your own Etsy / Shopify / Woo keys'}
            </button>
            {!advancedSyncOpen ?
              <p className="mt-1 text-xs text-dc-muted">
                Optional. Most shops use curated products or a storefront link instead.
              </p>
            : null}
          </div>
          {advancedSyncOpen ||
          (vendorHasStoreConnector(activeVendor) &&
            externalStoreType !== 'none' &&
            externalStoreType !== 'link_only') ?
            <VendorExternalStorePanel
              externalStoreType={externalStoreType}
              etsyShopUrl={etsyShopUrl}
              wooSiteUrl={wooPub?.wooSiteUrl}
              shopifyShop={wooPub?.shopifyShop}
              syncedAt={syncedAt}
              syncError={syncError}
              onUpdated={() => reload()}
              variant="advanced"
            />
          : null}
        </div>
      ) : null}

      {step === 'inventory' && !activeVendor ? (
        <p className="text-sm text-dc-text-muted">Create shop basics first.</p>
      ) : null}

      {step === 'appearance' && activeVendor ? (
        <div>
          <WizardStepHeader
            icon={vicon(STEP_ICONS.appearance)}
            eyebrow="Appearance"
            title="Shop appearance"
            description="Optional banner and logo for your public shop page."
          />
          <VendorShopAppearancePanel
            vendorSlug={activeVendor.slug}
            initialBannerUrl={activeVendor.bannerUrl ?? null}
            initialLogoUrl={activeVendor.logoUrl ?? null}
            initialLayout={activeVendor.shopHeaderLayout === 'BELOW' ? 'BELOW' : 'OVERLAY'}
            onSaved={() => reload()}
          />
        </div>
      ) : null}

      {step === 'publish' && activeVendor ? (
        <div>
          <WizardStepHeader
            icon={vicon(STEP_ICONS.publish)}
            eyebrow="Publish"
            title={published ? "You're all set" : 'Publish your shop'}
            description={
              published
                ? 'Your shop is public in the vendor directory.'
                : 'Publishing adds your shop to the vendor directory and discovery surfaces. You can stay unlisted until your catalog looks ready.'
            }
          />
          {!published ? (
            <div className="space-y-4">
              {publishErr ? <FormStatusMessage tone="error">{publishErr}</FormStatusMessage> : null}
              {publishMsg ? <FormStatusMessage tone="success">{publishMsg}</FormStatusMessage> : null}
              <button
                type="button"
                disabled={publishBusy}
                onClick={() => void publishShop()}
                className="min-h-touch w-full rounded-xl bg-dc-accent text-sm font-medium text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
              >
                {publishBusy ? 'Publishing…' : 'Publish to directory'}
              </button>
            </div>
          ) : null}
          <p className="mt-4 rounded-xl border border-dc-border bg-dc-surface-muted/40 px-4 py-3 text-sm text-dc-text-muted">
            Want help managing this shop? You can add shop runners from vendor settings after setup.
          </p>
          <div className="mt-4">
            <VendorIntegrationGuide shopSlug={activeVendor.slug} />
          </div>
        </div>
      ) : null}

      {step === 'publish' && !activeVendor ? (
        <p className="text-sm text-dc-text-muted">Complete shop setup first.</p>
      ) : null}
    </WizardShell>
  )
}
