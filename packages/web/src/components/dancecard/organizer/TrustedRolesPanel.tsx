'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { OrganizerApiError, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import {
  organizerTabHref,
  useOrganizerWorkspacePath,
} from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { applicationAnswerEntries } from '@/lib/dancecard/vettingApplicationDisplay'
import { InlineSuccessBanner, useOrganizerToast } from '@/components/dancecard/organizer/ui'
import { QUESTION_TYPES } from '@/lib/dancecard/questionnaireTypes'
import { applySlugFromName, publicTrustedRoleApplyPath } from '@/lib/dancecard/trustedRoles'
import type { ConventionCommandPermissions } from '@c2k/shared'
import { canMutateInCommandBridge } from '@/lib/dancecard/conventionCommandPermissions'
import { supportCopy } from '@/lib/dancecard/supportCopy'
import { useConfirm } from '@/hooks/useConfirm'

type QuestionDraft = {
  id?: string
  type: string
  label: string
  required: boolean
  sortOrder: number
  optionsJson: unknown
  visibilityRulesJson: Record<string, unknown>
}

export type TrustedRole = {
  id: string
  name: string
  applySlug: string
  description: string | null
  status: string
  roleKind?: string
  introText: string
  confirmationText: string
  sortOrder: number
  questions: QuestionDraft[]
}

function draftFromRole(r: TrustedRole): TrustedRole {
  return {
    ...r,
    questions: (r.questions ?? []).map((q) => ({
      id: q.id,
      type: q.type,
      label: q.label,
      required: q.required,
      sortOrder: q.sortOrder,
      optionsJson: q.optionsJson ?? [],
      visibilityRulesJson: q.visibilityRulesJson ?? {},
    })),
  }
}

function optionsToText(optionsJson: unknown): string {
  if (!Array.isArray(optionsJson)) return ''
  return optionsJson.map((o) => (typeof o === 'string' ? o : String(o))).join('\n')
}

function textToOptions(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

function formatOrganizerApiError(e: unknown): string {
  if (e instanceof OrganizerApiError) {
    try {
      const parsed = JSON.parse(e.body) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
      }
      if (parsed.details?.formErrors?.length) return parsed.details.formErrors.join(' ')
      const fieldMsgs = parsed.details?.fieldErrors
        ? Object.entries(parsed.details.fieldErrors).flatMap(([k, v]) => (v ?? []).map((m) => `${k}: ${m}`))
        : []
      if (fieldMsgs.length) return fieldMsgs[0]
    } catch {
      // use OrganizerApiError.message
    }
    return e.message
  }
  return e instanceof Error ? e.message : 'Request failed'
}

function buildRolePayload(draft: TrustedRole) {
  const applySlug = applySlugFromName(draft.applySlug.trim() || draft.name)
  return {
    name: draft.name.trim(),
    applySlug,
    description: draft.description?.trim() || null,
    status: draft.status,
    roleKind: draft.roleKind ?? 'custom',
    introText: draft.introText,
    confirmationText: draft.confirmationText,
    sortOrder: draft.sortOrder,
    questions: draft.questions.map((q, i) => ({
      ...(q.id ? { id: q.id } : {}),
      type: q.type,
      label: q.label.trim() || 'Question',
      required: q.required,
      sortOrder: q.sortOrder ?? i,
      optionsJson: q.optionsJson,
      visibilityRulesJson: q.visibilityRulesJson,
    })),
  }
}

export function TrustedRolesPanel({
  eventSlug,
  permissions,
}: {
  eventSlug: string
  permissions: ConventionCommandPermissions
}) {
  const { confirm, confirmDialog } = useConfirm()
  const canMutate = canMutateInCommandBridge(permissions)
  const toast = useOrganizerToast()
  const [roles, setRoles] = useState<TrustedRole[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TrustedRole | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [roleApps, setRoleApps] = useState<
    Array<{
      id: string
      applicantName: string
      status: string
      createdAt: string
      payload: Record<string, unknown>
    }>
  >([])
  const [roleAppsErr, setRoleAppsErr] = useState<string | null>(null)

  const workspaceBase = useOrganizerWorkspacePath(eventSlug)

  const applyUrl = useMemo(() => {
    if (!draft?.applySlug || typeof window === 'undefined') return ''
    return `${window.location.origin}${publicTrustedRoleApplyPath(eventSlug, draft.applySlug)}`
  }, [draft?.applySlug, eventSlug])

  const load = useCallback(async () => {
    setErr(null)
    try {
      const res = await organizerDancecardFetch<{ roles: TrustedRole[]; needsMigration?: boolean }>(
        eventSlug,
        '/trusted-roles',
      )
      setRoles(res.roles ?? [])
      setNeedsMigration(Boolean(res.needsMigration))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load trusted roles')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedId) {
      setDraft(null)
      setRoleApps([])
      return
    }
    const role = roles.find((r) => r.id === selectedId)
    if (role) setDraft(draftFromRole(role))
  }, [selectedId, roles])

  const loadRoleApplications = useCallback(async () => {
    if (!selectedId) return
    setRoleAppsErr(null)
    try {
      const res = await organizerDancecardFetch<{
        applications: Array<{
          id: string
          applicantName: string
          status: string
          createdAt: string | Date
          payload: Record<string, unknown>
        }>
      }>(eventSlug, `/trusted-roles/${encodeURIComponent(selectedId)}/applications`)
      setRoleApps(
        (res.applications ?? []).map((a) => ({
          id: a.id,
          applicantName: a.applicantName,
          status: a.status,
          createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date(a.createdAt).toISOString(),
          payload: a.payload ?? {},
        })),
      )
    } catch (e) {
      setRoleAppsErr(e instanceof Error ? e.message : 'Could not load applications for this role')
      setRoleApps([])
    }
  }, [eventSlug, selectedId])

  useEffect(() => {
    void loadRoleApplications()
  }, [loadRoleApplications])

  async function saveDraft() {
    if (!canMutate) {
      const message = 'You do not have permission to edit trusted roles.'
      setErr(message)
      toast.push(message)
      return
    }
    if (!draft) {
      const message = 'Select a role from the list first, or click + New role.'
      setErr(message)
      toast.push(message)
      return
    }
    if (!draft.name.trim()) {
      const message = 'Role name is required.'
      setErr(message)
      toast.push(message)
      return
    }
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const body = buildRolePayload(draft)
      const res = await organizerDancecardFetch<{ role: TrustedRole }>(
        eventSlug,
        `/trusted-roles/${draft.id}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      )
      const savedMsg =
        body.status === 'published'
          ? `Saved “${body.name}”. Apply link is ready to share.`
          : `Saved “${body.name}”. Publish when you want a public apply link.`
      setMsg(savedMsg)
      toast.push(savedMsg)
      if (body.applySlug !== draft.applySlug) {
        setDraft((d) => (d ? { ...d, applySlug: body.applySlug } : d))
      }
      await load()
      setSelectedId(res.role.id)
    } catch (e) {
      const message = formatOrganizerApiError(e)
      setErr(message)
      toast.push(message)
    } finally {
      setBusy(false)
    }
  }

  async function createRole() {
    if (!canMutate) return
    const name = 'New trusted role'
    setBusy(true)
    setErr(null)
    try {
      const res = await organizerDancecardFetch<{ role: TrustedRole }>(eventSlug, '/trusted-roles', {
        method: 'POST',
        body: JSON.stringify({
          name,
          applySlug: applySlugFromName(name),
          status: 'draft',
          introText: 'Tell applicants what this role involves and what you are looking for.',
          questions: [
            {
              type: 'long_text',
              label: 'Why do you want this role?',
              required: true,
              sortOrder: 0,
              optionsJson: [],
            },
          ],
        }),
      })
      await load()
      setSelectedId(res.role.id)
      const createdMsg = 'Role created. Publish when ready and share the apply link.'
      setMsg(createdMsg)
      toast.push(createdMsg)
    } catch (e) {
      const message = formatOrganizerApiError(e)
      setErr(message)
      toast.push(message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteRole(id: string) {
    if (
      !canMutate ||
      !(await confirm(
        'Delete this role?',
        'The questionnaire is removed. Existing applications keep their answers.',
        { destructive: true },
      ))
    ) {
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, `/trusted-roles/${id}`, { method: 'DELETE' })
      if (selectedId === id) setSelectedId(null)
      await load()
      const deletedMsg = 'Role deleted.'
      setMsg(deletedMsg)
      toast.push(deletedMsg)
    } catch (e) {
      const message = formatOrganizerApiError(e)
      setErr(message)
      toast.push(message)
    } finally {
      setBusy(false)
    }
  }

  function copyApplyLink() {
    if (!applyUrl) return
    void navigator.clipboard.writeText(applyUrl).then(() => setMsg('Apply link copied.'))
  }

  if (needsMigration) {
    return (
      <div className="rounded-xl border border-dc-warning/30 bg-dc-warning-muted px-4 py-5 text-sm text-dc-warning">
        <p className="font-medium">Trusted roles are not set up yet</p>
        <p className="mt-2 text-dc-warning/80">{supportCopy.trustedRolesNotReady} Refresh this page after setup is complete.</p>
      </div>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-dc-text">Trusted roles & questionnaires</h2>
          <p className="mt-1 max-w-xl text-xs text-dc-muted">
            Create special positions (dungeon monitor, lead volunteer, safety team), design each application form, and
            share a public apply link. Publish a role before sharing.
          </p>
        </div>
        {canMutate ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-full bg-dc-accent px-4 py-2 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
            onClick={() => void createRole()}
          >
            + New role
          </button>
        ) : null}
      </div>

      {err ? (
        <div className="rounded-xl border border-dc-danger/30 bg-dc-danger-muted px-4 py-3 text-sm text-dc-danger">{err}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
        <ul className="space-y-2">
          {roles.length === 0 ? (
            <li className="rounded-lg border border-dashed border-dc-border px-3 py-4 text-center text-xs text-dc-muted">
              No roles yet. Add one to get started.
            </li>
          ) : (
            roles.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={
                    selectedId === r.id
                      ? 'w-full rounded-lg border border-dc-accent-border bg-dc-accent-muted px-3 py-2 text-left'
                      : 'w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-left hover:bg-dc-elevated-muted'
                  }
                  onClick={() => setSelectedId(r.id)}
                >
                  <p className="font-medium text-dc-text">{r.name}</p>
                  <p className="text-[10px] text-dc-muted">
                    {r.status === 'published' ? 'Published' : 'Draft'} · /apply/{r.applySlug}
                    {selectedId === r.id && roleApps.length > 0 ?
                      <span className="ml-1 rounded-full bg-dc-warning-muted px-1.5 text-dc-warning">
                        {roleApps.filter((a) => a.status === 'pending' || a.status === 'review').length} open
                      </span>
                    : null}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>

        {!draft ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-dc-border py-12 text-xs text-dc-muted">
            Select a role to edit its form and apply link.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-dc-muted">
                Role name
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  disabled={!canMutate}
                  value={draft.name}
                  onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                />
              </label>
              <label className="block text-xs text-dc-muted">
                URL slug
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 font-mono text-sm text-dc-text"
                  disabled={!canMutate}
                  value={draft.applySlug}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, applySlug: applySlugFromName(e.target.value || d.name) } : d,
                    )
                  }
                />
              </label>
            </div>
            <label className="block text-xs text-dc-muted">
              Short description (optional)
              <input
                className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                disabled={!canMutate}
                value={draft.description ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, description: e.target.value } : d))}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="block text-xs text-dc-muted">
                Status
                <select
                  className="mt-1 block rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  disabled={!canMutate}
                  value={draft.status}
                  onChange={(e) => setDraft((d) => (d ? { ...d, status: e.target.value } : d))}
                >
                  <option value="draft">Draft (hidden from public)</option>
                  <option value="published">Published (accept applications)</option>
                </select>
              </label>
              <label className="block text-xs text-dc-muted">
                Role kind
                <select
                  className="mt-1 block rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  disabled={!canMutate}
                  value={draft.roleKind ?? 'custom'}
                  onChange={(e) => setDraft((d) => (d ? { ...d, roleKind: e.target.value } : d))}
                >
                  <option value="custom">Custom / special role</option>
                  <option value="staff">Staff</option>
                  <option value="volunteer">Volunteer</option>
                </select>
              </label>
            </div>
            {draft.status === 'published' && applyUrl ? (
              <div className="rounded-lg border border-dc-accent-border/40 bg-dc-accent-muted/30 px-3 py-2">
                <p className="text-xs font-medium text-dc-accent">Public apply link</p>
                <p className="mt-1 break-all font-mono text-[11px] text-dc-muted">{applyUrl}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs text-dc-accent hover:underline"
                    onClick={copyApplyLink}
                  >
                    Copy link
                  </button>
                  <a
                    className="text-xs text-dc-accent hover:underline"
                    href={applyUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open apply page
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-dc-muted">Publish this role to generate a shareable apply link.</p>
            )}
            <label className="block text-xs text-dc-muted">
              Intro (shown at top of apply form)
              <textarea
                className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                rows={3}
                disabled={!canMutate}
                value={draft.introText}
                onChange={(e) => setDraft((d) => (d ? { ...d, introText: e.target.value } : d))}
              />
            </label>
            <label className="block text-xs text-dc-muted">
              Confirmation message (after submit)
              <textarea
                className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                rows={2}
                disabled={!canMutate}
                value={draft.confirmationText}
                onChange={(e) => setDraft((d) => (d ? { ...d, confirmationText: e.target.value } : d))}
              />
            </label>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Questionnaire</p>
                {canMutate ? (
                  <button
                    type="button"
                    className="text-xs text-dc-accent hover:underline"
                    onClick={() =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              questions: [
                                ...d.questions,
                                {
                                  type: 'text',
                                  label: 'New question',
                                  required: false,
                                  sortOrder: d.questions.length,
                                  optionsJson: [],
                                  visibilityRulesJson: {},
                                },
                              ],
                            }
                          : d,
                      )
                    }
                  >
                    + Add question
                  </button>
                ) : null}
              </div>
              <div className="mt-2 space-y-3">
                {draft.questions.map((q, idx) => (
                  <div key={q.id ?? `q-${idx}`} className="rounded-lg border border-dc-border bg-dc-surface-muted p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block text-xs text-dc-muted">
                        Type
                        <select
                          className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1.5 text-sm text-dc-text"
                          disabled={!canMutate}
                          value={q.type}
                          onChange={(e) =>
                            setDraft((d) => {
                              if (!d) return d
                              const questions = [...d.questions]
                              questions[idx] = { ...questions[idx], type: e.target.value }
                              return { ...d, questions }
                            })
                          }
                        >
                          {QUESTION_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-end gap-2 pb-1 text-xs text-dc-muted">
                        <input
                          type="checkbox"
                          disabled={!canMutate}
                          checked={q.required}
                          onChange={(e) =>
                            setDraft((d) => {
                              if (!d) return d
                              const questions = [...d.questions]
                              questions[idx] = { ...questions[idx], required: e.target.checked }
                              return { ...d, questions }
                            })
                          }
                        />
                        Required
                      </label>
                    </div>
                    <label className="mt-2 block text-xs text-dc-muted">
                      Question label
                      <input
                        className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                        disabled={!canMutate}
                        value={q.label}
                        onChange={(e) =>
                          setDraft((d) => {
                            if (!d) return d
                            const questions = [...d.questions]
                            questions[idx] = { ...questions[idx], label: e.target.value }
                            return { ...d, questions }
                          })
                        }
                      />
                    </label>
                    {q.type === 'single_choice' || q.type === 'multi_choice' || q.type === 'dropdown' ? (
                      <label className="mt-2 block text-xs text-dc-muted">
                        Options (one per line)
                        <textarea
                          className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 font-mono text-xs text-dc-text"
                          rows={3}
                          disabled={!canMutate}
                          value={optionsToText(q.optionsJson)}
                          onChange={(e) =>
                            setDraft((d) => {
                              if (!d) return d
                              const questions = [...d.questions]
                              questions[idx] = { ...questions[idx], optionsJson: textToOptions(e.target.value) }
                              return { ...d, questions }
                            })
                          }
                        />
                      </label>
                    ) : null}
                    {canMutate ? (
                      <button
                        type="button"
                        className="mt-2 text-xs text-rose-400 hover:underline"
                        onClick={() =>
                          setDraft((d) =>
                            d ? { ...d, questions: d.questions.filter((_, i) => i !== idx) } : d,
                          )
                        }
                      >
                        Remove question
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-dc-border bg-dc-surface-muted/50 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Applications for this role</h3>
                <Link
                  to={organizerTabHref(workspaceBase, 'applications', {
                    vettingRoleId: selectedId ?? undefined,
                  })}
                  className="text-xs font-medium text-dc-accent hover:underline"
                >
                  Review in queue →
                </Link>
              </div>
              {roleAppsErr ? <p className="text-xs text-dc-danger">{roleAppsErr}</p> : null}
              {!roleApps.length && !roleAppsErr ?
                <p className="text-xs text-dc-muted">No applications yet for this role.</p>
              : (
                <ul className="max-h-48 space-y-2 overflow-y-auto">
                  {roleApps.map((app) => (
                    <li key={app.id} className="rounded-lg border border-dc-border bg-dc-elevated-muted px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-dc-text">{app.applicantName}</span>
                        <span className="text-dc-muted">{app.status}</span>
                      </div>
                      <p className="text-[10px] text-dc-muted mt-0.5">
                        {new Date(app.createdAt).toLocaleString()}
                      </p>
                      {applicationAnswerEntries(app.payload).length > 0 ?
                        <p className="text-[10px] text-dc-muted mt-1">
                          {applicationAnswerEntries(app.payload).length} answer
                          {applicationAnswerEntries(app.payload).length === 1 ? '' : 's'}
                        </p>
                      : null}
                      <Link
                        to={organizerTabHref(workspaceBase, 'applications', {
                          vettingRoleId: selectedId ?? undefined,
                          applicationId: app.id,
                        })}
                        className="mt-1 inline-block text-[10px] text-dc-accent hover:underline"
                      >
                        Open in application queue
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {msg ? <InlineSuccessBanner message={msg} onDismiss={() => setMsg(null)} /> : null}

            {canMutate ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-full bg-dc-accent px-4 py-2 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-40"
                  onClick={() => void saveDraft()}
                >
                  {busy ? 'Saving…' : 'Save role'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-full border border-dc-border px-4 py-2 text-xs text-dc-muted hover:bg-white/5 disabled:opacity-40"
                  onClick={() => void deleteRole(draft.id)}
                >
                  Delete role
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
      {confirmDialog}
    </section>
  )
}
