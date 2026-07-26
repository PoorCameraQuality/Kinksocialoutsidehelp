import { useId, useState, useCallback, useEffect, useMemo } from 'react'
import type { GroupRule } from '@c2k/shared'
import {
  GROUP_CATEGORY_DESCRIPTIONS,
  GROUP_CATEGORY_VALUES,
  groupRulesSchema,
  normalizeGroupTags,
} from '@c2k/shared'
import {
  GroupCreateStepper,
  PreviewRow,
  PreviewSummary,
  SectionCard,
  StickyWizardFooter,
} from '@/components/create-flow/CreateFlowWizardUi'
import TextInput from '@/components/ui/TextInput'
import { TAG_SEEDS } from '@/data/mock-data'
import { uploadGroupBrandingAsset } from '@/lib/group-branding-upload'

export type CreateGroupModalProps = {
  onClose: () => void
  onCreated: (group: { id: string; name: string; slug: string }) => void
}

function slugFromName(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group'
  return `${base}-${Date.now().toString(36)}`
}

const emptyRule = (): GroupRule => ({ title: '', body: '' })

const fieldClass = 'min-h-11 rounded-xl'

const VISIBILITY_LABELS: Record<'public' | 'private' | 'invite-only', string> = {
  public: 'Public — listed in directory',
  private: 'Private — members only',
  'invite-only': 'Invite only — join by invitation',
}

export default function CreateGroupModal({ onClose, onCreated }: CreateGroupModalProps) {
  const titleId = useId()
  const nameId = useId()
  const categoryId = useId()
  const tagsId = useId()
  const visibilityId = useId()
  const bannerInputId = useId()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>(GROUP_CATEGORY_VALUES[0])
  const [tagsInput, setTagsInput] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private' | 'invite-only'>('public')
  const [rules, setRules] = useState<GroupRule[]>([])
  const [showRules, setShowRules] = useState(false)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(bannerFile)
    setBannerPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [bannerFile])

  const bannerLabel = useMemo(() => {
    if (!bannerFile) return 'None'
    return bannerFile.name
  }, [bannerFile])

  const stepDescription =
    step === 1 ?
      'Name your group, choose a purpose, and set who can find it.'
    : step === 2 ?
      'Optional community rules members accept when joining.'
    : 'Review details, then create your group.'

  const validateBasics = useCallback((): string | null => {
    if (!name.trim()) return 'Name is required.'
    if (!category) return 'Choose a purpose category.'
    return null
  }, [name, category])

  const goNext = useCallback(() => {
    setError(null)
    if (step === 1) {
      const err = validateBasics()
      if (err) {
        setError(err)
        return
      }
    }
    if (step === 2) {
      const activeRules = rules.filter((r) => r.title.trim() && r.body.trim())
      const rulesParsed = groupRulesSchema.safeParse(activeRules)
      if (!rulesParsed.success) {
        setError('Each rule needs a title and body (max 20 rules).')
        return
      }
    }
    setStep((s) => Math.min(3, s + 1))
  }, [step, validateBasics, rules])

  async function handleCreate() {
    setError(null)
    const err = validateBasics()
    if (err) {
      setError(err)
      setStep(1)
      return
    }
    const activeRules = rules.filter((r) => r.title.trim() && r.body.trim())
    const rulesParsed = groupRulesSchema.safeParse(activeRules)
    if (!rulesParsed.success) {
      setError('Each rule needs a title and body (max 20 rules).')
      setStep(2)
      return
    }
    const tagParts = tagsInput.split(/[,;\s]+/).filter(Boolean)
    const tags = normalizeGroupTags(tagParts)
    setSubmitting(true)
    try {
      const r = await fetch('/api/v1/groups', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slugFromName(name.trim()),
          category,
          ...(tags.length > 0 ? { tags } : {}),
          visibility,
          ...(rulesParsed.data.length > 0 ? { rules: rulesParsed.data } : {}),
        }),
      })
      const j = (await r.json().catch(() => ({}))) as {
        error?: string
        group?: { id: string; name: string; slug: string }
      }
      if (!r.ok) {
        setError(j.error ?? 'Could not create group.')
        return
      }
      if (!j.group?.id) {
        setError('Group was created but no id was returned.')
        return
      }
      if (bannerFile) {
        try {
          await uploadGroupBrandingAsset(j.group.id, 'banner', bannerFile)
        } catch (uploadErr) {
          setError(
            uploadErr instanceof Error ?
              `Group created, but banner upload failed: ${uploadErr.message}`
            : 'Group created, but banner upload failed.',
          )
          onCreated(j.group)
          return
        }
      }
      onCreated(j.group)
    } catch {
      setError('Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  function updateRule(index: number, patch: Partial<GroupRule>) {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const footer = (
    <StickyWizardFooter
      leftLabel={step === 1 ? 'Cancel' : 'Back'}
      onLeft={step === 1 ? onClose : () => setStep((s) => Math.max(1, s - 1))}
      onPrimary={step === 3 ? () => void handleCreate() : goNext}
      primaryLabel={step === 3 ? (submitting ? 'Creating…' : 'Create group') : 'Continue'}
      primaryLoading={submitting}
      primaryDisabled={submitting}
    />
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-dc-border px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-dc-text">
            Create group
          </h2>
          <p className="mt-1 text-sm text-dc-muted">{stepDescription}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <GroupCreateStepper currentStep={step} />

          {error ?
            <div
              className="mb-4 rounded-xl border border-dc-danger-border/40 bg-dc-danger/10 px-3 py-2 text-sm text-dc-danger"
              role="alert"
            >
              {error}
            </div>
          : null}

          {step === 1 ?
            <div className="space-y-4">
              <SectionCard title="Basics" badge="Required">
                <div>
                  <label htmlFor={nameId} className="mb-1.5 block text-sm font-medium text-dc-text-muted">
                    Name
                  </label>
                  <TextInput
                    id={nameId}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Philly Rope Munch"
                    required
                    maxLength={255}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor={categoryId} className="mb-1.5 block text-sm font-medium text-dc-text-muted">
                    Purpose
                  </label>
                  <select
                    id={categoryId}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    className={`w-full border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text ${fieldClass}`}
                  >
                    {GROUP_CATEGORY_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {value} · {GROUP_CATEGORY_DESCRIPTIONS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={tagsId} className="mb-1.5 block text-sm font-medium text-dc-text-muted">
                    Tags (optional)
                  </label>
                  <TextInput
                    id={tagsId}
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="e.g. rope, munch, gear-swap"
                    className={fieldClass}
                  />
                  <p className="mt-1.5 text-xs text-dc-muted">
                    Comma-separated interests. Suggestions: {TAG_SEEDS.slice(0, 5).map((t) => `#${t}`).join(', ')}…
                  </p>
                </div>
              </SectionCard>

              <SectionCard title="Banner image" badge="Optional">
                <p className="text-xs text-dc-muted">
                  Wide header on your group page (3:1 or 16:9). You can change this later in organizer settings.
                </p>
                {bannerPreviewUrl ?
                  <div className="mt-3 overflow-hidden rounded-xl border border-dc-border">
                    <img src={bannerPreviewUrl} alt="" className="aspect-[3/1] w-full object-cover" />
                  </div>
                : (
                  <div className="mt-3 flex aspect-[3/1] w-full items-center justify-center rounded-xl border-2 border-dashed border-dc-border bg-dc-surface-muted text-xs text-dc-muted">
                    No banner yet
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    id={bannerInputId}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={submitting}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      e.target.value = ''
                      setBannerFile(file)
                    }}
                  />
                  <label
                    htmlFor={bannerInputId}
                    className="inline-flex min-h-touch cursor-pointer items-center rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-medium text-dc-text hover:bg-dc-accent-hover"
                  >
                    {bannerFile ? 'Replace banner' : 'Upload banner'}
                  </label>
                  {bannerFile ?
                    <button
                      type="button"
                      className="min-h-touch rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-text-muted hover:text-dc-text"
                      onClick={() => setBannerFile(null)}
                    >
                      Remove
                    </button>
                  : null}
                </div>
              </SectionCard>

              <SectionCard title="Privacy" badge="Required">
                <div>
                  <label htmlFor={visibilityId} className="mb-1.5 block text-sm font-medium text-dc-text-muted">
                    Who can find this group?
                  </label>
                  <select
                    id={visibilityId}
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                    className={`w-full border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text ${fieldClass}`}
                  >
                    <option value="public">Public. Listed in directory</option>
                    <option value="private">Private. Members only</option>
                    <option value="invite-only">Invite only</option>
                  </select>
                  <p className="mt-2 text-xs text-dc-muted">{VISIBILITY_LABELS[visibility]}</p>
                </div>
              </SectionCard>
            </div>
          : step === 2 ?
            <SectionCard title="Community rules" badge="Optional">
              <button
                type="button"
                onClick={() => {
                  setShowRules((v) => !v)
                  if (!showRules && rules.length === 0) setRules([emptyRule()])
                }}
                className="flex min-h-touch w-full items-center justify-between gap-3 rounded-xl border border-dc-border px-4 py-3 text-sm font-medium text-dc-text"
              >
                Add group rules
                <span className="text-dc-muted text-xs" aria-hidden>
                  {showRules ? '▾' : '▸'}
                </span>
              </button>
              {showRules ?
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-dc-muted">
                    Members accept these rules when joining. Keep language plain and actionable.
                  </p>
                  {rules.map((rule, index) => (
                    <div key={index} className="space-y-2 rounded-xl border border-dc-border p-3">
                      <TextInput
                        value={rule.title}
                        onChange={(e) => updateRule(index, { title: e.target.value })}
                        placeholder="Rule title"
                        maxLength={200}
                        className="min-h-11 rounded-lg"
                      />
                      <textarea
                        value={rule.body}
                        onChange={(e) => updateRule(index, { body: e.target.value })}
                        placeholder="Rule details"
                        rows={3}
                        maxLength={5000}
                        className="w-full min-h-11 rounded-lg border border-dc-border bg-dc-elevated-solid px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted resize-y"
                      />
                      {rules.length > 1 ?
                        <button
                          type="button"
                          onClick={() => setRules((prev) => prev.filter((_, i) => i !== index))}
                          className="min-h-touch text-xs text-dc-muted hover:text-dc-text"
                        >
                          Remove rule
                        </button>
                      : null}
                    </div>
                  ))}
                  {rules.length < 20 ?
                    <button
                      type="button"
                      onClick={() => setRules((prev) => [...prev, emptyRule()])}
                      className="min-h-touch text-sm text-dc-accent hover:underline"
                    >
                      Add another rule
                    </button>
                  : null}
                </div>
              : (
                <p className="mt-2 text-sm text-dc-muted">You can skip this step and add rules later from group settings.</p>
              )}
            </SectionCard>
          : <PreviewSummary>
              <PreviewRow label="Name" value={name.trim() || '-'} missing={!name.trim()} />
              <PreviewRow label="Purpose" value={category || '-'} />
              <PreviewRow label="Visibility" value={VISIBILITY_LABELS[visibility]} />
              <PreviewRow label="Banner" value={bannerLabel} />
              {tagsInput.trim() ?
                <PreviewRow label="Tags" value={tagsInput.trim()} />
              : null}
              <PreviewRow
                label="Rules"
                value={
                  rules.filter((r) => r.title.trim() && r.body.trim()).length > 0 ?
                    `${rules.filter((r) => r.title.trim() && r.body.trim()).length} rule(s)`
                  : 'None'
                }
              />
            </PreviewSummary>
          }
        </div>

        <div className="shrink-0 border-t border-dc-border px-5 py-4 safe-area-pb">{footer}</div>
      </div>
    </div>
  )
}
