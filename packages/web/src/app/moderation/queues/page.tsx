import { Navigate, useSearchParams } from 'react-router-dom'

/** Legacy route → Cases open tab (preserves `queue` query). */
export default function ModerationQueuesPage() {
  const [searchParams] = useSearchParams()
  const next = new URLSearchParams()
  next.set('tab', 'open')
  const queue = searchParams.get('queue')
  if (queue) next.set('queue', queue)
  const status = searchParams.get('status')
  if (status) next.set('status', status)
  return <Navigate to={`/moderation/cases?${next.toString()}`} replace />
}
