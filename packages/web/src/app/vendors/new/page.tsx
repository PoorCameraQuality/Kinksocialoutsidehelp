import { Navigate } from 'react-router-dom'

/** Legacy create URL - onboarding wizard is the canonical flow. */
export default function VendorCreatePage() {
  return <Navigate to="/vendors/onboarding" replace />
}
