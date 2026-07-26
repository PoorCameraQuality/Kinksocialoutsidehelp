import { resolveShareImageUrl } from '@c2k/shared'
import { mediaDisplayUrl } from '@/lib/media-display-url'

export type BrandingAssetKind = 'banner' | 'logo' | 'share'

type Props = {
  scopeLabel: string
  title?: string
  description?: string
  bannerUrl: string | null
  logoUrl: string | null
  shareImageUrl: string | null
  onUpload: (kind: BrandingAssetKind) => void
  onClear: (kind: BrandingAssetKind) => void
  uploading: BrandingAssetKind | null
  readOnly?: boolean
  variant?: 'c2k' | 'dancecard'
  /** Hide banner section (e.g. convention uses separate hero control). */
  hideBanner?: boolean
}

const BRANDING_GUIDE_PATH = '/support/branding'

function btnClass(variant: 'c2k' | 'dancecard', primary?: boolean): string {
  if (variant === 'dancecard') {
    return primary ?
        'rounded-lg border border-dc-accent-border bg-dc-accent px-3 py-1.5 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-60'
      : 'rounded-lg border border-dc-border-subtle px-3 py-1.5 text-xs font-medium text-dc-text hover:bg-dc-elevated-muted disabled:opacity-60'
  }
  return primary ?
      'rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-medium text-dc-text hover:bg-dc-accent-hover disabled:opacity-50'
    : 'rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-text-muted hover:text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50'
}

export default function ScopeBrandingPanel({
  scopeLabel,
  title,
  description,
  bannerUrl,
  logoUrl,
  shareImageUrl,
  onUpload,
  onClear,
  uploading,
  readOnly = false,
  variant = 'c2k',
  hideBanner = false,
}: Props) {
  const resolvedShare = resolveShareImageUrl({
    shareImageUrl,
    bannerUrl,
    logoUrl,
    siteDefault: null,
  })
  const previewTitle = title?.trim() || scopeLabel
  const previewDesc = description?.trim() || `${scopeLabel} on Kink Social`

  const cardClass =
    variant === 'dancecard' ?
      'rounded-xl border border-dc-border-subtle bg-dc-elevated p-4 space-y-2'
    : 'rounded-xl border border-dc-border bg-dc-elevated-solid p-4 space-y-2'

  const mutedClass = variant === 'dancecard' ? 'text-xs text-dc-muted' : 'text-xs text-dc-muted'

  function assetSection(
    kind: BrandingAssetKind,
    label: string,
    hint: string,
    url: string | null,
    aspectClass: string,
  ) {
    const display = mediaDisplayUrl(url)
    return (
      <div className={cardClass}>
        <p className={variant === 'dancecard' ? 'text-sm font-medium text-dc-text' : 'text-sm text-dc-text-muted'}>
          {label}
        </p>
        <p className={mutedClass}>{hint}</p>
        {display ?
          <div className={`overflow-hidden rounded-lg border ${variant === 'dancecard' ? 'border-dc-border-subtle' : 'border-dc-border'}`}>
            <img src={display} alt="" className={`w-full object-cover ${aspectClass}`} />
          </div>
        : <div
            className={`flex items-center justify-center rounded-lg border-2 border-dashed ${aspectClass} ${
              variant === 'dancecard' ? 'border-dc-border-subtle bg-dc-surface text-dc-muted' : (
                'border-dc-border bg-dc-surface-muted text-dc-muted'
              )
            } text-xs`}
          >
            No image yet
          </div>
        }
        {!readOnly ?
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={uploading !== null}
              onClick={() => onUpload(kind)}
              className={btnClass(variant, true)}
            >
              {uploading === kind ? 'Uploading…' : display ? 'Replace' : 'Upload'}
            </button>
            {display ?
              <button
                type="button"
                disabled={uploading !== null}
                onClick={() => onClear(kind)}
                className={btnClass(variant)}
              >
                Remove
              </button>
            : null}
          </div>
        : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className={mutedClass}>
        Images appear on your public page and when you share links. See{' '}
        <a href={BRANDING_GUIDE_PATH} className="text-dc-accent hover:underline">
          branding guide
        </a>{' '}
        for safe sizes (banner 3:1, logo 1:1, link preview 1200×630).
      </p>

      <div className={`grid gap-4 ${hideBanner ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {!hideBanner ?
          assetSection(
            'banner',
            'Banner',
            'Wide header on your public hub (3:1 or 16:9).',
            bannerUrl,
            'aspect-[3/1] min-h-[4rem]',
          )
        : null}
        {assetSection('logo', 'Logo', 'Square avatar beside your name (256–512px).', logoUrl, 'aspect-square max-h-32')}
        {assetSection(
          'share',
          'Link preview image',
          'Shown on Facebook, Discord, iMessage when someone shares your link (1200×630).',
          shareImageUrl,
          'aspect-[1.91/1] min-h-[5rem]',
        )}
      </div>

      <div className={variant === 'dancecard' ? 'rounded-2xl border border-dc-border-subtle bg-dc-surface p-4' : 'rounded-2xl border border-dc-border bg-dc-elevated/95 p-4'}>
        <p className={variant === 'dancecard' ? 'text-xs font-semibold uppercase text-dc-muted mb-2' : 'text-xs font-semibold uppercase text-dc-muted mb-2'}>
          Link preview mockup
        </p>
        <div className="rounded-lg border border-dc-border overflow-hidden max-w-md">
          {mediaDisplayUrl(resolvedShare) ?
            <img src={mediaDisplayUrl(resolvedShare)} alt="" className="aspect-[1.91/1] w-full object-cover" />
          : <div className="aspect-[1.91/1] bg-dc-elevated-muted flex items-center justify-center text-xs text-dc-muted">
              Preview uses banner or logo when share image is empty
            </div>
          }
          <div className="p-3 bg-dc-elevated-solid">
            <p className="text-sm font-medium text-dc-text truncate">{previewTitle}</p>
            <p className="text-xs text-dc-muted line-clamp-2 mt-0.5">{previewDesc}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
