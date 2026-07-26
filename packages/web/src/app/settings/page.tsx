import { Navigate } from 'react-router-dom'

/** Redirect bare `/settings` bookmarks to Account tab (router index also handles this). */
export default function SettingsPage() {
  return <Navigate to="/settings/account" replace />
}
