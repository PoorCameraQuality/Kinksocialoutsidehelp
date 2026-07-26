import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function SavedBackLink() {
  const location = useLocation()
  const navigate = useNavigate()
  const canGoBack = location.key !== 'default'

  if (canGoBack) {
    return (
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-sm font-medium text-dc-accent hover:underline"
      >
        ← Back
      </button>
    )
  }

  return (
    <Link to="/home?mode=discover&tab=Local" className="text-sm font-medium text-dc-accent hover:underline">
      ← Back to My Kink Social
    </Link>
  )
}
