import { Navigate } from 'react-router-dom'

/** Legacy route → Cases legacy-reports tab. */
export default function ModerationReportsPage() {
  return <Navigate to="/moderation/cases?tab=legacy-reports" replace />
}
