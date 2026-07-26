import { useApiMutes, type ApiMuteTag } from '@/hooks/useApiMutes'

export type ApiMutedTag = {
  id: string
  targetId: string
  createdAt: string
  tag: ApiMuteTag | null
}

export type UseApiMutedTagsResult = {
  status: ReturnType<typeof useApiMutes>['status']
  items: ApiMutedTag[]
  error: ReturnType<typeof useApiMutes>['error']
  reload: ReturnType<typeof useApiMutes>['reload']
  mute: ReturnType<typeof useApiMutes>['mute']
  unmute: ReturnType<typeof useApiMutes>['unmute']
  muteBusy: boolean
  unmuteBusy: boolean
}

export function useApiMutedTags(enabled: boolean): UseApiMutedTagsResult {
  const hook = useApiMutes(enabled, 'TAG')

  return {
    status: hook.status,
    items: hook.items.map((m) => ({
      id: m.id,
      targetId: m.targetId,
      createdAt: m.createdAt,
      tag: m.tag,
    })),
    error: hook.error,
    reload: hook.reload,
    mute: hook.mute,
    unmute: hook.unmute,
    muteBusy: hook.muteBusy,
    unmuteBusy: hook.unmuteBusy,
  }
}
