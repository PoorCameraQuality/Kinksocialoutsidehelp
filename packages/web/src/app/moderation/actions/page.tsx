import { Navigate } from 'react-router-dom'

/** Legacy route → Cases pending-actions tab. */
export default function ModerationActionsPage() {
  return <Navigate to="/moderation/cases?tab=pending-actions" replace />
}
