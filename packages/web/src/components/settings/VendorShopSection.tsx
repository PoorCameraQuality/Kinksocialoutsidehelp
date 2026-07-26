import {
  VENDOR_TAG_MAX,
  normalizeVendorTags,
  normalizeVendorWebsite,
  vendorCategoriesFromRow,
  type VendorCategory,
} from '@c2k/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import VendorEckePanel from '@/components/ecke/VendorEckePanel'
import VendorExternalStorePanel from '@/components/VendorExternalStorePanel'
import VendorCatalogPanel from '@/components/vendors/VendorCatalogPanel'
import VendorCategoryPicker from '@/components/vendors/VendorCategoryPicker'
import VendorIntegrationGuide from '@/components/vendors/VendorIntegrationGuide'
import PaymentsVaultGate from '@/components/organizer/payments/PaymentsVaultGate'
import VendorPaymentsPanel from '@/components/settings/VendorPaymentsPanel'
import StatusBanner from '@/components/ui/StatusBanner'
import { useAuth } from '@/contexts/AuthContext'
import { usePersistFormDraft, useSessionFormDraft } from '@/hooks/useSessionFormDraft'
import { useApiVendorMe } from '@/hooks/useApiVendorMe'
import {
  fieldErrorClass,
  focusFirstInvalidField,
  formatVendorProfileSaveError,
  type ApiErrorBody,
} from '@/lib/api-errors'

const VENDOR_SHOP_DRAFT_KEY = 'c2k:vendor-shop-draft'

type VendorShopDraft = {
  displayName: string
  bio: string
  makerStory: string
  policyReturns: string
  policyCustomOrders: string
  policyLeadTime: string
  policyShipping: string
  website: string
  shipsTo: 'US' | 'Canada' | 'International'
  categories: VendorCategory[]
  tags: string[]
  visibility: 'PUBLIC' | 'MEMBERS' | 'HIDDEN'
  commissionStatus: 'OPEN' | 'LIMITED' | 'CLOSED'
  commissionNotes: string
  eckePublish: boolean
  coOwnerInput: string
}

const VENDOR_FIELD_IDS: Record<string, string> = {
  displayName: 'vs-name',
  bio: 'vs-bio',
  makerStory: 'vs-maker',
  website: 'vs-web',
  shipsTo: 'vs-ships',
  categories: 'vs-categories',
  tags: 'vs-tags',
  visibility: 'vs-vis',
  commissionStatus: 'vs-comm',
  commissionNotes: 'vs-comm-notes',
  'shopPolicies.returns': 'vs-pol-returns',
  'shopPolicies.customOrders': 'vs-pol-custom',
  'shopPolicies.leadTime': 'vs-pol-lead',
  'shopPolicies.shippingNotes': 'vs-pol-ship',
}

export default function VendorShopSection() {
  const { isAuthenticated } = useAuth()
  const { status, vendor, reload } = useApiVendorMe(isAuthenticated)
  const { restore, clear, markRestored, hasRestored } = useSessionFormDraft<VendorShopDraft>(VENDOR_SHOP_DRAFT_KEY)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [makerStory, setMakerStory] = useState('')
  const [policyReturns, setPolicyReturns] = useState('')
  const [policyCustomOrders, setPolicyCustomOrders] = useState('')
  const [policyLeadTime, setPolicyLeadTime] = useState('')
  const [policyShipping, setPolicyShipping] = useState('')
  const [website, setWebsite] = useState('')
  const [shipsTo, setShipsTo] = useState<'US' | 'Canada' | 'International'>('US')
  const [categories, setCategories] = useState<VendorCategory[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [visibility, setVisibility] = useState<'PUBLIC' | 'MEMBERS' | 'HIDDEN'>('HIDDEN')
  const [commissionStatus, setCommissionStatus] = useState<'OPEN' | 'LIMITED' | 'CLOSED'>('OPEN')
  const [commissionNotes, setCommissionNotes] = useState('')
  const [eckePublish, setEckePublish] = useState(false)
  const [coOwnerInput, setCoOwnerInput] = useState('')

  const draftSnapshot = useMemo(
    (): VendorShopDraft => ({
      displayName,
      bio,
      makerStory,
      policyReturns,
      policyCustomOrders,
      policyLeadTime,
      policyShipping,
      website,
      shipsTo,
      categories,
      tags,
      visibility,
      commissionStatus,
      commissionNotes,
      eckePublish,
      coOwnerInput,
    }),
    [
      bio,
      categories,
      coOwnerInput,
      commissionNotes,
      commissionStatus,
      displayName,
      eckePublish,
      makerStory,
      policyCustomOrders,
      policyLeadTime,
      policyReturns,
      policyShipping,
      shipsTo,
      tags,
      visibility,
      website,
    ],
  )

  usePersistFormDraft(VENDOR_SHOP_DRAFT_KEY, draftSnapshot, Boolean(vendor))

  useEffect(() => {
    if (hasRestored()) return
    const draft = restore()
    if (draft) {
      setDisplayName(draft.displayName)
      setBio(draft.bio)
      setMakerStory(draft.makerStory)
      setPolicyReturns(draft.policyReturns)
      setPolicyCustomOrders(draft.policyCustomOrders)
      setPolicyLeadTime(draft.policyLeadTime)
      setPolicyShipping(draft.policyShipping)
      setWebsite(draft.website)
      setShipsTo(draft.shipsTo)
      setCategories(draft.categories)
      setTags(draft.tags)
      setVisibility(draft.visibility)
      setCommissionStatus(draft.commissionStatus)
      setCommissionNotes(draft.commissionNotes)
      setEckePublish(draft.eckePublish)
      setCoOwnerInput(draft.coOwnerInput)
      markRestored()
      return
    }
    if (!vendor) return
    setDisplayName(vendor.displayName ?? '')
    setBio(vendor.bio ?? '')
    setMakerStory(vendor.makerStory ?? '')
    const p = vendor.shopPolicies
    setPolicyReturns(p?.returns ?? '')
    setPolicyCustomOrders(p?.customOrders ?? '')
    setPolicyLeadTime(p?.leadTime ?? '')
    setPolicyShipping(p?.shippingNotes ?? '')
    setWebsite(vendor.website ?? '')
    setShipsTo((vendor.shipsTo as typeof shipsTo) ?? 'US')
    setCategories(vendorCategoriesFromRow({ category: vendor.category, categories: vendor.categories }))
    setTags(vendor.tags ?? [])
    setTagInput('')
    setVisibility(vendor.visibility ?? 'HIDDEN')
    setCommissionStatus(vendor.commissionStatus ?? 'OPEN')
    setCommissionNotes(vendor.commissionNotes ?? '')
    setEckePublish(Boolean(vendor.eckePublish))
    markRestored()
    void (async () => {
      try {
        const r = await fetch('/api/v1/vendors/me/co-owners', { credentials: 'include' })
        if (!r.ok) return
        const d = (await r.json()) as { coOwners?: Array<{ username: string }> }
        setCoOwnerInput((d.coOwners ?? []).map((c) => c.username).join(', '))
      } catch {
        /* ignore */
      }
    })()
  }, [vendor, restore, markRestored, hasRestored])

  const addTagsFromInput = () => {
    const parts = tagInput.split(/[,]+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length === 0) return
    setTags((prev) => normalizeVendorTags([...prev, ...parts]))
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  const applySaveError = useCallback((body: ApiErrorBody) => {
    const parsed = formatVendorProfileSaveError(body)
    setErr(parsed.message)
    setFieldErrors(parsed.fieldErrors)
    focusFirstInvalidField(parsed.fieldErrors, VENDOR_FIELD_IDS)
  }, [])

  const saveProfile = useCallback(async () => {
    if (!vendor) return
    setSaving(true)
    setErr(null)
    setMsg(null)
    setFieldErrors({})
    try {
      const r = await fetch('/api/v1/me/vendor-profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim() || null,
          makerStory: makerStory.trim() || null,
          shopPolicies: {
            returns: policyReturns.trim() || null,
            customOrders: policyCustomOrders.trim() || null,
            leadTime: policyLeadTime.trim() || null,
            shippingNotes: policyShipping.trim() || null,
          },
          website: website.trim() ? normalizeVendorWebsite(website) : null,
          shipsTo,
          categories,
          tags,
          visibility,
          commissionStatus,
          commissionNotes: commissionNotes.trim() || null,
          eckePublish,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as ApiErrorBody
      if (!r.ok) {
        applySaveError(j)
        return
      }
      const coUsernames = coOwnerInput
        .split(/[,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const cr = await fetch('/api/v1/vendors/me/co-owners', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: coUsernames }),
      })
      const cj = (await cr.json().catch(() => ({}))) as ApiErrorBody
      if (!cr.ok) {
        setErr(cj.error ?? 'Shop saved but shop runners could not be updated')
        reload()
        return
      }
      clear()
      setMsg('Shop settings saved.')
      reload()
    } catch {
      setErr('Network error')
    } finally {
      setSaving(false)
    }
  }, [
    applySaveError,
    bio,
    categories,
    clear,
    tags,
    commissionNotes,
    commissionStatus,
    coOwnerInput,
    displayName,
    eckePublish,
    makerStory,
    policyCustomOrders,
    policyLeadTime,
    policyReturns,
    policyShipping,
    reload,
    shipsTo,
    vendor,
    visibility,
    website,
  ])

  if (!isAuthenticated) return null

  if (status === 'loading' || status === 'idle') {
    return (
      <section className="rounded-2xl border border-dc-border bg-dc-elevated/40 p-6">
        <div className="h-24 animate-pulse rounded-xl bg-dc-elevated-muted" />
      </section>
    )
  }

  if (status === 'none' || !vendor) {
    return (
      <section className="rounded-2xl border border-dc-border bg-dc-elevated/40 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-dc-text">Vendor shop</h2>
        <p className="text-sm text-dc-text-muted">
          Showcase your catalog on Kink Social and import listings from Etsy, Shopify, or WooCommerce. Checkout stays on your store.
        </p>
        <Link
          to="/vendors/onboarding"
          className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text hover:bg-dc-accent-hover"
        >
          Set up your shop
        </Link>
      </section>
    )
  }

  const externalStoreType = vendor.externalStoreType ?? (vendor.usesEtsy ? 'etsy' : 'none')
  const wooPub = vendor.externalStorePublic as { wooSiteUrl?: string; shopifyShop?: string } | undefined
  const syncedAt = vendor.externalListingsSyncedAt ?? vendor.etsyListingsSyncedAt ?? null
  const syncError = vendor.externalSyncError ?? vendor.etsySyncError ?? null
  const tagsAtCap = tags.length >= VENDOR_TAG_MAX

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated/40 p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-dc-text">Vendor shop</h2>
          <p className="text-sm text-dc-text-muted mt-1">
            Manage your public shop, inventory sync, and how you appear on events and discovery.
          </p>
        </div>
        <Link
          to={`/vendors/${encodeURIComponent(vendor.slug)}`}
          className="text-sm text-dc-accent hover:underline shrink-0"
        >
          View public shop →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vs-name" className="block text-xs text-dc-muted mb-1">
            Display name
          </label>
          <input
            id="vs-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            aria-invalid={fieldErrors.displayName ? true : undefined}
            className={`w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors.displayName))}`}
          />
        </div>
        <div>
          <label htmlFor="vs-vis" className="block text-xs text-dc-muted mb-1">
            Directory visibility
          </label>
          <select
            id="vs-vis"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as typeof visibility)}
            aria-invalid={fieldErrors.visibility ? true : undefined}
            className={`w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors.visibility))}`}
          >
            <option value="PUBLIC">Public. Listed in vendor directory</option>
            <option value="MEMBERS">Members only</option>
            <option value="HIDDEN">Hidden. Not in directory</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="vs-bio" className="block text-xs text-dc-muted mb-1">
          Bio
        </label>
        <textarea
          id="vs-bio"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          aria-invalid={fieldErrors.bio ? true : undefined}
          className={`w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors.bio))}`}
        />
      </div>

      <div>
        <label htmlFor="vs-maker" className="block text-xs text-dc-muted mb-1">
          Maker story
        </label>
        <textarea
          id="vs-maker"
          rows={2}
          value={makerStory}
          onChange={(e) => setMakerStory(e.target.value)}
          placeholder="One sentence: who you make for (rope, leather, art prints…)"
          aria-invalid={fieldErrors.makerStory ? true : undefined}
          className={`w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors.makerStory))}`}
        />
      </div>

      <div className="rounded-xl border border-dc-border bg-dc-surface-muted/40 p-4 space-y-3">
        <p className="text-xs font-semibold text-dc-text">Shop policies</p>
        <p className="text-xs text-dc-muted">Your own wording. Shown on your public shop. Not platform-verified.</p>
        <div>
          <label htmlFor="vs-pol-returns" className="block text-xs text-dc-muted mb-1">
            Returns
          </label>
          <textarea
            id="vs-pol-returns"
            rows={2}
            value={policyReturns}
            onChange={(e) => setPolicyReturns(e.target.value)}
            aria-invalid={fieldErrors['shopPolicies.returns'] ? true : undefined}
            className={`w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors['shopPolicies.returns']))}`}
          />
        </div>
        <div>
          <label htmlFor="vs-pol-custom" className="block text-xs text-dc-muted mb-1">
            Custom orders
          </label>
          <textarea
            id="vs-pol-custom"
            rows={2}
            value={policyCustomOrders}
            onChange={(e) => setPolicyCustomOrders(e.target.value)}
            aria-invalid={fieldErrors['shopPolicies.customOrders'] ? true : undefined}
            className={`w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors['shopPolicies.customOrders']))}`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="vs-pol-lead" className="block text-xs text-dc-muted mb-1">
              Lead time
            </label>
            <input
              id="vs-pol-lead"
              value={policyLeadTime}
              onChange={(e) => setPolicyLeadTime(e.target.value)}
              aria-invalid={fieldErrors['shopPolicies.leadTime'] ? true : undefined}
              className={`w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors['shopPolicies.leadTime']))}`}
            />
          </div>
          <div>
            <label htmlFor="vs-pol-ship" className="block text-xs text-dc-muted mb-1">
              Shipping notes
            </label>
            <input
              id="vs-pol-ship"
              value={policyShipping}
              onChange={(e) => setPolicyShipping(e.target.value)}
              aria-invalid={fieldErrors['shopPolicies.shippingNotes'] ? true : undefined}
              className={`w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors['shopPolicies.shippingNotes']))}`}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vs-web" className="block text-xs text-dc-muted mb-1">
            Website
          </label>
          <p className="mb-1 text-xs text-dc-text-muted">We&apos;ll add https:// if you paste a link without it.</p>
          <input
            id="vs-web"
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            aria-invalid={fieldErrors.website ? true : undefined}
            className={`w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors.website))}`}
          />
        </div>
        <div>
          <label htmlFor="vs-ships" className="block text-xs text-dc-muted mb-1">
            Ships to
          </label>
          <select
            id="vs-ships"
            value={shipsTo}
            onChange={(e) => setShipsTo(e.target.value as typeof shipsTo)}
            aria-invalid={fieldErrors.shipsTo ? true : undefined}
            className={`w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors.shipsTo))}`}
          >
            <option value="US">US</option>
            <option value="Canada">Canada</option>
            <option value="International">International</option>
          </select>
        </div>
      </div>

      <VendorCategoryPicker
        id="vs-categories"
        selected={categories}
        onChange={setCategories}
        error={fieldErrors.categories ?? fieldErrors.category ?? null}
      />

      <div>
        <label htmlFor="vs-tags" className="block text-xs text-dc-muted mb-1">
          Specialty tags <span className="text-dc-text-muted">(up to {VENDOR_TAG_MAX})</span>
        </label>
        <div className="flex gap-2">
          <input
            id="vs-tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTagsFromInput()
              }
            }}
            disabled={tagsAtCap}
            placeholder={tagsAtCap ? 'Tag limit reached' : 'rope, commissions'}
            aria-invalid={fieldErrors.tags ? true : undefined}
            className={`flex-1 px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors.tags))}`}
          />
          <button
            type="button"
            onClick={addTagsFromInput}
            disabled={tagsAtCap}
            className="px-3 rounded-lg border border-dc-border text-sm text-dc-text-muted disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {fieldErrors.tags ?
          <p className="mt-1 text-xs text-red-200" role="alert">
            {fieldErrors.tags}
          </p>
        : null}
        {tags.length > 0 ?
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded-full border border-dc-border px-2 py-1 text-xs text-dc-text-muted"
              >
                {tag} ×
              </button>
            ))}
          </div>
        : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vs-comm" className="block text-xs text-dc-muted mb-1">
            Custom orders
          </label>
          <select
            id="vs-comm"
            value={commissionStatus}
            onChange={(e) => setCommissionStatus(e.target.value as typeof commissionStatus)}
            aria-invalid={fieldErrors.commissionStatus ? true : undefined}
            className={`w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors.commissionStatus))}`}
          >
            <option value="OPEN">Open to commissions</option>
            <option value="LIMITED">Limited availability</option>
            <option value="CLOSED">Not taking custom work</option>
          </select>
        </div>
        <div>
          <label htmlFor="vs-comm-notes" className="block text-xs text-dc-muted mb-1">
            Commission notes
          </label>
          <input
            id="vs-comm-notes"
            value={commissionNotes}
            onChange={(e) => setCommissionNotes(e.target.value)}
            placeholder="Lead time, minimums, etc."
            aria-invalid={fieldErrors.commissionNotes ? true : undefined}
            className={`w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm ${fieldErrorClass(Boolean(fieldErrors.commissionNotes))}`}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-dc-text mb-2">Shop runners</p>
        <label htmlFor="vs-co-owners" className="block text-xs text-dc-muted mb-1">
          Runner usernames
        </label>
        <input
          id="vs-co-owners"
          value={coOwnerInput}
          onChange={(e) => setCoOwnerInput(e.target.value)}
          placeholder="username1, username2"
          className="w-full px-3 py-2 rounded-lg bg-dc-surface-muted border border-dc-border text-dc-text text-sm"
        />
        <p className="text-xs text-dc-muted mt-1">
          Shop runners are trusted people who can help operate this vendor page. They may help with inventory,
          appearance, and feedback. The primary owner remains responsible for the shop.
        </p>
        <p className="text-xs text-amber-200/90 mt-2">
          Only add people you trust. Runners may be able to change shop content and inventory settings.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-teal-500/20 bg-teal-950/20 px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 rounded border-dc-border"
          checked={eckePublish}
          onChange={(e) => setEckePublish(e.target.checked)}
          disabled={visibility !== 'PUBLIC'}
        />
        <div>
          <span className="text-sm font-medium text-dc-text">List on East Coast Kink Events</span>
          <p className="text-xs text-dc-muted mt-1">
            Auto-sync your vendor profile to eastcoastkinkevents.com when your shop is public. Requires ECKE publish
            bridge on the server.
          </p>
        </div>
      </label>

      {eckePublish && visibility === 'PUBLIC' ?
        <VendorEckePanel vendorProfileId={vendor.id} />
      : null}

      {err ?
        <StatusBanner tone="error">{err}</StatusBanner>
      : null}
      {msg ?
        <p className="text-sm text-emerald-300" role="status">
          {msg}
        </p>
      : null}

      <button
        type="button"
        disabled={saving}
        onClick={() => void saveProfile()}
        className="min-h-10 rounded-lg bg-dc-accent px-4 text-sm font-medium text-dc-text disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save shop profile'}
      </button>

      <div className="border-t border-dc-border pt-6">
        <PaymentsVaultGate title="Shop payments">
          <VendorPaymentsPanel enabled />
        </PaymentsVaultGate>
      </div>

      <div className="border-t border-dc-border pt-6">
        <h3 className="mb-1 text-sm font-semibold text-dc-text">Curated catalog</h3>
        <p className="mb-3 text-xs text-dc-muted">
          Feature products with a price for Stripe Checkout (when connected), outbound buy links, or CSV import.
          kink.social never holds vendor sale funds.
        </p>
        <VendorCatalogPanel enabled />
      </div>

      <div className="border-t border-dc-border pt-6">
        <h3 className="mb-1 text-sm font-semibold text-dc-text">Advanced store sync</h3>
        <p className="mb-3 text-xs text-dc-muted">
          Optional: link-only storefront, or sync listings with your own Etsy / Shopify / WooCommerce API credentials.
          Platform OAuth apps are not required.
        </p>
        <VendorExternalStorePanel
          externalStoreType={externalStoreType}
          etsyShopUrl={vendor.etsyShopUrl ?? ''}
          wooSiteUrl={wooPub?.wooSiteUrl}
          shopifyShop={wooPub?.shopifyShop}
          syncedAt={syncedAt}
          syncError={syncError}
          onUpdated={() => reload()}
          variant="advanced"
        />
      </div>

      <div className="border-t border-dc-border pt-6">
        <h3 className="text-sm font-semibold text-dc-text mb-3">Where your shop appears</h3>
        <VendorIntegrationGuide shopSlug={vendor.slug} compact />
      </div>

      <Link to="/vendors/onboarding" className="text-sm text-dc-accent hover:underline">
        Re-run setup wizard
      </Link>
    </section>
  )
}
