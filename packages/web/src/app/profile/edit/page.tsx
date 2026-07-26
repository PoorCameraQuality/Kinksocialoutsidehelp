import { Navigate } from 'react-router-dom'

/** Legacy route - profile edit lives at tabbed `/profile/edit/*`. */
export default function ProfileEditPageRedirect() {
  return <Navigate to="/profile/edit" replace />
}
