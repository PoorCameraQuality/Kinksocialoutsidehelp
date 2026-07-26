/** Target types where platform hide_content executes (forum/chat). */
export const HIDE_CONTENT_TARGET_TYPES = [
  'org_forum_reply',
  'group_reply',
  'comment',
  'org_chat_message',
] as const

export const MEDIA_CASE_TARGET_TYPES = ['media_asset', 'profile_photo'] as const

export function isMediaCaseTarget(targetContentType: string): boolean {
  return (MEDIA_CASE_TARGET_TYPES as readonly string[]).includes(targetContentType)
}

export function supportsHideContent(targetContentType: string): boolean {
  return (HIDE_CONTENT_TARGET_TYPES as readonly string[]).includes(targetContentType)
}

export function enforcementHint(targetContentType: string, hasMediaSnapshot: boolean): string {
  if (isMediaCaseTarget(targetContentType) || hasMediaSnapshot) {
    return 'Media case. Delete permanently removes the file from member surfaces. Keep quarantined leaves it blocked. Mark no violation closes the case without deleting.'
  }
  if (supportsHideContent(targetContentType)) {
    return 'Hide removes this post or message from public view. Resolution actions close or escalate the case.'
  }
  return `Hide is not available for ${targetContentType.replace(/_/g, ' ')}. Use resolution actions below or change case status.`
}
