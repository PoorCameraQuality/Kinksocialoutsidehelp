export const PROFILE_PHOTO_STORAGE_PREFIX = 'storage:'

export function formatProfilePhotoStorageRef(storagePath: string): string {
  return `${PROFILE_PHOTO_STORAGE_PREFIX}${storagePath}`
}

export function isProfilePhotoStorageRef(value: string): boolean {
  return value.startsWith(PROFILE_PHOTO_STORAGE_PREFIX)
}

export function profilePhotoStoragePath(ref: string): string {
  return ref.slice(PROFILE_PHOTO_STORAGE_PREFIX.length)
}
