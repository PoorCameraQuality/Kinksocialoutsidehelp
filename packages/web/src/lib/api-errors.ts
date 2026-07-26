/** Zod `flatten()` shape returned by API routes on validation failure. */
export type ZodFlattenDetails = {
  formErrors?: string[]
  fieldErrors?: Record<string, string[]>
}

export type ApiErrorBody = {
  error?: string
  details?: ZodFlattenDetails | string
}

/** First message per field from zod flatten details. */
export function fieldErrorsFromDetails(details: unknown): Record<string, string> {
  const flat = details as ZodFlattenDetails | undefined
  if (!flat?.fieldErrors) return {}
  const out: Record<string, string> = {}
  for (const [field, msgs] of Object.entries(flat.fieldErrors)) {
    if (msgs?.[0]) out[field] = msgs[0]
  }
  return out
}

const VENDOR_FIELD_LABELS: Record<string, string> = {
  displayName: 'Display name',
  bio: 'Bio',
  makerStory: 'Maker story',
  website: 'Website',
  shipsTo: 'Ships to',
  category: 'Shop category',
  categories: 'Shop categories',
  tags: 'Specialty tags',
  visibility: 'Directory visibility',
  commissionStatus: 'Custom orders',
  commissionNotes: 'Commission notes',
  'shopPolicies.returns': 'Returns policy',
  'shopPolicies.customOrders': 'Custom orders policy',
  'shopPolicies.leadTime': 'Lead time',
  'shopPolicies.shippingNotes': 'Shipping notes',
}

/** Human-readable message for vendor profile save failures. */
export function formatVendorProfileSaveError(body: ApiErrorBody): {
  message: string
  fieldErrors: Record<string, string>
} {
  const fieldErrors = fieldErrorsFromDetails(body.details)
  if (body.error && body.error !== 'Invalid body') {
    return { message: body.error, fieldErrors }
  }
  const firstField = Object.keys(fieldErrors)[0]
  if (firstField) {
    const label = VENDOR_FIELD_LABELS[firstField] ?? firstField
    return { message: `${label}: ${fieldErrors[firstField]}`, fieldErrors }
  }
  const flat = body.details as ZodFlattenDetails | undefined
  if (flat?.formErrors?.[0]) {
    return { message: flat.formErrors[0], fieldErrors }
  }
  return { message: 'Could not save. Check required fields and character limits.', fieldErrors }
}

/** Tailwind classes for invalid form controls. */
export function fieldErrorClass(hasError: boolean): string {
  return hasError ? 'border-red-500/80 ring-1 ring-red-500/40' : ''
}

/** Scroll to and focus the first field with a validation error. */
export function focusFirstInvalidField(
  fieldErrors: Record<string, string>,
  fieldIdByKey: Record<string, string>,
): void {
  for (const key of Object.keys(fieldErrors)) {
    const id = fieldIdByKey[key]
    if (!id) continue
    const el = document.getElementById(id)
    if (!el) continue
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (el instanceof HTMLElement) el.focus({ preventScroll: true })
    break
  }
}
