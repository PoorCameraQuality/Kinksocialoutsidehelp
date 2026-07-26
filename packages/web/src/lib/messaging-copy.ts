import type { ProfileMessageHint } from '@/hooks/useGraphStatus'

export const PROFILE_MESSAGING_HELPER =
  'Messages open when your privacy settings and connection status allow it.'

export const PROFILE_MESSAGE_HINT_CONNECT_FIRST = 'Connect first to message.'

export const PROFILE_MESSAGE_HINT_LIMITED = 'This member limits who can message them.'

export const PROFILE_MESSAGE_HINT_UNAVAILABLE = 'Messaging is unavailable.'

export const PROFILE_MESSAGE_HINT_REQUEST =
  'Your message will appear in their Requests until they accept.'

export const MESSAGING_EMPTY_INBOX_TITLE = 'No messages yet.'

export const MESSAGING_EMPTY_INBOX_BODY =
  'Conversations start from real connections and community context. Find people, join groups, RSVP to events, or adjust your messaging settings when you are ready.'

export const MESSAGING_REQUESTS_EMPTY_TITLE = 'No message requests'

export const MESSAGING_REQUESTS_EMPTY_BODY =
  'When someone new messages you and you are not connected, their thread waits here until you accept or ignore it. Blocked members cannot message you.'

export const MESSAGING_REQUESTS_FOLDER_HINT =
  'New conversations from people you are not connected with yet. Accept to reply; ignore to hide.'

export const MESSAGING_INBOX_INTRO =
  'Main holds accepted conversations. Requests are for new threads until you accept. ISO is for personal ad replies.'

export const SETTINGS_INBOX_EXPLAINER =
  'Who can message you controls whether someone can start a conversation. If you are not connected, accepted threads land in Main; new threads from allowed senders may wait in Requests. Blocked members cannot message you. Shared group membership can allow messages when you choose group-only messaging.'

export function profileMessageHintCopy(hint: ProfileMessageHint | null | undefined): string | null {
  switch (hint) {
    case 'connect_first':
      return PROFILE_MESSAGE_HINT_CONNECT_FIRST
    case 'limited':
      return PROFILE_MESSAGE_HINT_LIMITED
    case 'unavailable':
      return PROFILE_MESSAGE_HINT_UNAVAILABLE
    case 'request_pending':
      return PROFILE_MESSAGE_HINT_REQUEST
    default:
      return null
  }
}
