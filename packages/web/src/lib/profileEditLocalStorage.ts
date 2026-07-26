/** Demo/offline profile edits mirrored from profile edit (see FEATURE_REGISTRY). */
export const PROFILE_EDIT_STORAGE_KEY = 'c2k_profile_edit_mock'

export function hasProfileEditLocalOverrides(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(PROFILE_EDIT_STORAGE_KEY)
    return raw != null && raw.length > 0
  } catch {
    return false
  }
}

export function clearProfileEditLocalOverrides(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(PROFILE_EDIT_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
