import { Navigate } from 'react-router-dom'

/** Legacy dungeons route → community places directory (SG-139). */
export default function DungeonsPage() {
  return <Navigate to="/places?category=dungeon_club" replace />
}
