import { useState, useEffect, useCallback } from 'react'

import {

  MEDIA_UPLOAD_STATUSES,

  type MediaContentRating,

  type MediaPublishLane,

  type MediaUploadStatus,

  type MediaVisibility,

} from '@c2k/shared'
import type { PersonalPhotoQuota } from '@c2k/shared'

import type { PhotoUploadResult } from '@/components/PhotoUpload'

import type { MediaAttestationTarget } from '@/components/media/MediaAttestationModal'

import type { MockProfilePhoto } from '@/data/mock-data'

import { attachUploadedProfilePhoto, uploadProfilePhotoFile } from '@/lib/profile-photo-upload'
import type { MediaUploadStage } from '@/components/media/MediaUploadProgress'



const PROFILE_PHOTOS_STORAGE_KEY = 'c2k_profile_photos_mock'



function loadStoredPhotos(): MockProfilePhoto[] | null {

  if (typeof window === 'undefined') return null

  try {

    const raw = localStorage.getItem(PROFILE_PHOTOS_STORAGE_KEY)

    return raw ? JSON.parse(raw) : null

  } catch (e) {

    console.warn('[useProfilePhotos] Failed to load stored photos:', e)

    return null

  }

}



function saveStoredPhotos(photos: MockProfilePhoto[]) {

  if (typeof window === 'undefined') return

  try {

    localStorage.setItem(PROFILE_PHOTOS_STORAGE_KEY, JSON.stringify(photos))

  } catch (e) {

    console.warn('[useProfilePhotos] Failed to save photos to localStorage:', e)

  }

}



export type ApiProfilePhoto = {

  id: string

  url: string

  caption: string | null

  order: number

  mediaAssetId?: string | null

  uploadStatus?: MediaUploadStatus | null

  contentRating?: MediaContentRating | null

  visibility?: MediaVisibility | null

  isBlurredByDefault?: boolean

  pendingReview?: boolean

  publishLane?: MediaPublishLane | null

}



export type ProfilePhoto = MockProfilePhoto & {

  mediaAssetId?: string | null

  uploadStatus?: MediaUploadStatus | null

  contentRating?: MediaContentRating | null

  visibility?: MediaVisibility | null

  isBlurredByDefault?: boolean

  pendingReview?: boolean

  publishLane?: MediaPublishLane | null

  needsAttestation?: boolean

}



function mapApiPhoto(photo: ApiProfilePhoto): ProfilePhoto {

  const needsAttestation = photo.uploadStatus === MEDIA_UPLOAD_STATUSES.pendingAttestation

  return {

    id: photo.id,

    url: photo.url,

    caption: photo.caption ?? undefined,

    order: photo.order,

    tags: [],

    mediaAssetId: photo.mediaAssetId,

    uploadStatus: photo.uploadStatus,

    contentRating: photo.contentRating,

    visibility: photo.visibility,

    isBlurredByDefault: photo.isBlurredByDefault,

    pendingReview: photo.pendingReview,

    publishLane: photo.publishLane,

    needsAttestation,

  }

}



export interface UseProfilePhotosOptions {

  basePhotos?: MockProfilePhoto[]

  apiBacked?: boolean

  onPhotosChanged?: () => void

}



export interface UseProfilePhotosReturn {

  photos: ProfilePhoto[]

  loading: boolean

  uploading: boolean

  uploadStage: MediaUploadStage | null

  pendingUploadPreview: { objectUrl: string; caption?: string } | null

  error: string | null

  quota: PersonalPhotoQuota | null

  reload: () => void

  addPhotoOpen: boolean

  setAddPhotoOpen: (open: boolean) => void

  addPhoto: (result: PhotoUploadResult) => void

  attestationTarget: MediaAttestationTarget | null

  setAttestationTarget: (target: MediaAttestationTarget | null) => void

  onAttestationCompleted: () => void

  editingId: string | null

  editingCaption: string

  setEditingCaption: (value: string) => void

  startEditCaption: (id: string) => void

  saveCaption: () => void

  cancelEdit: () => void

  deleteConfirmId: string | null

  setDeleteConfirmId: (id: string | null) => void

  deletePhoto: (id: string) => void

}



export function useProfilePhotos(options: UseProfilePhotosOptions = {}): UseProfilePhotosReturn {

  const { basePhotos = [], apiBacked = false, onPhotosChanged } = options

  const [photos, setPhotos] = useState<ProfilePhoto[]>([])

  const [storedPhotos, setStoredPhotos] = useState<MockProfilePhoto[] | null>(null)

  const [loading, setLoading] = useState(false)

  const [uploading, setUploading] = useState(false)

  const [uploadStage, setUploadStage] = useState<MediaUploadStage | null>(null)

  const [pendingUploadPreview, setPendingUploadPreview] = useState<{
    objectUrl: string
    caption?: string
  } | null>(null)

  const [error, setError] = useState<string | null>(null)

  const [quota, setQuota] = useState<PersonalPhotoQuota | null>(null)

  const [addPhotoOpen, setAddPhotoOpen] = useState(false)

  const [attestationTarget, setAttestationTarget] = useState<MediaAttestationTarget | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)

  const [editingCaption, setEditingCaption] = useState('')

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)



  const loadApiPhotos = useCallback(async () => {

    setLoading(true)

    setError(null)

    try {

      const r = await fetch('/api/profile/me/photos', { credentials: 'include' })

      if (r.status === 503) {

        setPhotos([])

        setError('Profile photos are temporarily unavailable. Try again in a moment.')

        return

      }

      if (!r.ok) {

        setPhotos([])

        setError('Could not load profile photos.')

        return

      }

      const data = (await r.json()) as { photos?: ApiProfilePhoto[]; quota?: PersonalPhotoQuota }

      setPhotos((data.photos ?? []).map(mapApiPhoto))
      setQuota(data.quota ?? null)

    } catch {

      setPhotos([])

      setError('Could not load profile photos.')

    } finally {

      setLoading(false)

    }

  }, [])



  useEffect(() => {

    if (apiBacked) {

      void loadApiPhotos()

      return

    }

    setStoredPhotos(loadStoredPhotos())

    setError(null)

  }, [apiBacked, loadApiPhotos])



  useEffect(() => {

    if (apiBacked) return

    setPhotos(storedPhotos ?? basePhotos)

  }, [apiBacked, storedPhotos, basePhotos])



  const persistLocal = useCallback((next: MockProfilePhoto[]) => {

    setPhotos(next)

    setStoredPhotos(next)

    saveStoredPhotos(next)

  }, [])



  const addPhoto = useCallback(

    async (result: PhotoUploadResult) => {

      if (apiBacked) {

        setError(null)
        setUploading(true)
        setUploadStage('uploading')
        if (result.objectUrl) {
          setPendingUploadPreview({ objectUrl: result.objectUrl, caption: result.caption })
        }

        try {
          let uploaded = {
            url: null as string | null,
            quarantineKey: null as string | null,
            sha256: null as string | null,
            mimeType: 'image/jpeg',
            sizeBytes: 0,
            originalFilename: 'photo.jpg',
            imageWidth: undefined as number | undefined,
            imageHeight: undefined as number | undefined,
            error: undefined as string | undefined,
          }

          if (result.file) {
            const fileUpload = await uploadProfilePhotoFile(result.file)
            uploaded = {
              url: fileUpload.url,
              quarantineKey: fileUpload.quarantineKey,
              sha256: fileUpload.sha256,
              mimeType: fileUpload.mimeType,
              sizeBytes: fileUpload.sizeBytes,
              originalFilename: fileUpload.originalFilename,
              imageWidth: fileUpload.imageWidth,
              imageHeight: fileUpload.imageHeight,
              error: fileUpload.error,
            }
          }

          if (!uploaded.url && !uploaded.quarantineKey) {
            throw new Error(uploaded.error ?? 'Could not upload photo. Check your connection and try again.')
          }

          setUploadStage('processing')

          const attached = await attachUploadedProfilePhoto(uploaded, photos.length)
          if (!attached.ok) {
            throw new Error(attached.error)
          }

          if (attached.needsAttestation && attached.mediaAssetId) {
            setAttestationTarget({ mediaAssetId: attached.mediaAssetId, label: 'profile photo' })
            setAddPhotoOpen(false)
            onPhotosChanged?.()
            return
          }

          await loadApiPhotos()
          setAddPhotoOpen(false)
          onPhotosChanged?.()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not save photo.')
          throw err
        } finally {
          setUploading(false)
          setUploadStage(null)
          setPendingUploadPreview(null)
        }

        return

      }



      const newPhoto: ProfilePhoto = {

        id: `pp-${Date.now()}`,

        url: result.objectUrl,

        caption: result.caption,

        order: photos.length,

        tags: [],

      }

      persistLocal([...photos, newPhoto])

      setAddPhotoOpen(false)

      onPhotosChanged?.()

    },

    [apiBacked, photos, persistLocal, loadApiPhotos, onPhotosChanged]

  )



  const onAttestationCompleted = useCallback(() => {

    setAttestationTarget(null)

    void loadApiPhotos()

    onPhotosChanged?.()

  }, [loadApiPhotos, onPhotosChanged])



  const startEditCaption = useCallback(

    (id: string) => {

      const photo = photos.find((photoItem) => photoItem.id === id)

      if (photo) {

        setEditingId(id)

        setEditingCaption(photo.caption ?? '')

      }

    },

    [photos]

  )



  const saveCaption = useCallback(async () => {

    if (!editingId) return

    if (apiBacked) {

      setError(null)

      const r = await fetch(`/api/profile/me/photos/${encodeURIComponent(editingId)}`, {

        method: 'PATCH',

        credentials: 'include',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ caption: editingCaption.trim() || null }),

      })

      if (!r.ok) {

        setError('Could not update caption.')

        return

      }

      const data = (await r.json()) as { photo?: ApiProfilePhoto }

      if (data.photo) {

        setPhotos((prev) => prev.map((photo) => (photo.id === editingId ? mapApiPhoto(data.photo!) : photo)))

      } else {

        await loadApiPhotos()

      }

      setEditingId(null)

      setEditingCaption('')

      onPhotosChanged?.()

      return

    }



    const next = photos.map((photo) =>

      photo.id === editingId ? { ...photo, caption: editingCaption } : photo

    )

    persistLocal(next)

    setEditingId(null)

    setEditingCaption('')

    onPhotosChanged?.()

  }, [apiBacked, editingId, editingCaption, photos, persistLocal, loadApiPhotos, onPhotosChanged])



  const cancelEdit = useCallback(() => {

    setEditingId(null)

    setEditingCaption('')

  }, [])



  const deletePhoto = useCallback(

    async (id: string) => {

      if (apiBacked) {

        setError(null)

        const r = await fetch(`/api/profile/me/photos/${encodeURIComponent(id)}`, {

          method: 'DELETE',

          credentials: 'include',

        })

        if (!r.ok) {

          setError('Could not delete photo.')

          return

        }

        setPhotos((prev) => prev.filter((photo) => photo.id !== id))

        setDeleteConfirmId(null)

        onPhotosChanged?.()

        return

      }



      const removed = photos.find((photo) => photo.id === id)

      if (removed?.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url)

      persistLocal(photos.filter((photo) => photo.id !== id))

      setDeleteConfirmId(null)

      onPhotosChanged?.()

    },

    [apiBacked, photos, persistLocal, onPhotosChanged]

  )



  const galleryPhotos = apiBacked

    ? photos.filter((p) => !p.needsAttestation)

    : photos



  return {

    photos: galleryPhotos,

    loading,

    uploading,

    uploadStage,

    pendingUploadPreview,

    error,

    quota,

    reload: loadApiPhotos,

    addPhotoOpen,

    setAddPhotoOpen,

    addPhoto,

    attestationTarget,

    setAttestationTarget,

    onAttestationCompleted,

    editingId,

    editingCaption,

    setEditingCaption,

    startEditCaption,

    saveCaption,

    cancelEdit,

    deleteConfirmId,

    setDeleteConfirmId,

    deletePhoto,

  }

}

