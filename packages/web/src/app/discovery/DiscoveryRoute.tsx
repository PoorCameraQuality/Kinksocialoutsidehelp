import { Navigate, useLocation } from 'react-router-dom'

import { PEOPLE_DIRECTORY_PATH } from '@/lib/app-routes'



/** Legacy `/discovery` URLs redirect to the People directory. */

export default function DiscoveryRoute() {

  const { search } = useLocation()

  const params = new URLSearchParams(search)

  const entity = params.get('entity')?.toLowerCase()



  if (entity === 'places') {

    const category = params.get('category')

    return <Navigate to={category ? `/places?category=${encodeURIComponent(category)}` : '/places'} replace />

  }

  if (entity === 'events') return <Navigate to="/events" replace />

  if (entity === 'groups') return <Navigate to="/groups" replace />



  params.delete('entity')

  const rest = params.toString()

  const target = rest ? `${PEOPLE_DIRECTORY_PATH}?${rest}` : PEOPLE_DIRECTORY_PATH

  return <Navigate to={target} replace />

}


