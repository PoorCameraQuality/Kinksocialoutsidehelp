import { Navigate, useLocation } from 'react-router-dom'
import { loginRedirectSearchParams } from '@/lib/auth-links'

/** Preserves redirect / legacy next and opens the landing login card. */
export default function LoginRedirectPage() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/', search: loginRedirectSearchParams(search) }} replace />
}
