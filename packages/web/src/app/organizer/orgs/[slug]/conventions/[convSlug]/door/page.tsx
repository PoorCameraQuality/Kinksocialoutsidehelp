import { useCallback, useEffect, useState } from 'react'

import { Link, useParams, useSearchParams } from 'react-router-dom'

import { DoorModePanel } from '@/components/dancecard/organizer/door/DoorModePanel'

import { registerDoorServiceWorker } from '@/lib/dancecard/door/registerDoorSw'

import { OrganizerApiError, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'

import type { ConventionCommandPermissions } from '@c2k/shared'

import { commandPermissionIncludes } from '@c2k/shared'

import { organizerConventionBasePath } from '@/lib/organizer/organizerConventionPaths'

import PermissionDeniedPanel from '@/components/ui/PermissionDeniedPanel'

import LoadErrorBanner from '@/components/ui/LoadErrorBanner'

import { useAuth } from '@/contexts/AuthContext'

import { supportCopy } from '@/lib/dancecard/supportCopy'



type DoorLoadState = 'loading' | 'ready' | 'denied' | 'error'



function doorLoadErrorMessage(error: unknown): string {

  if (error instanceof OrganizerApiError) {

    if (error.status === 404) {

      return 'This event could not be found. Check the link or ask an organizer for the correct door URL.'

    }

    return error.message

  }

  const raw = error instanceof Error ? error.message : ''

  if (!raw || /^HTTP \d+$/i.test(raw)) return supportCopy.tryAgainLater

  return raw

}



export default function OrganizerConventionDoorPage() {

  const { slug: orgSlug = '', convSlug = '' } = useParams()

  const [searchParams] = useSearchParams()

  const kioskMode = searchParams.get('kiosk') === '1'

  const eventSlug = convSlug.toLowerCase()

  const { isAuthenticated, status: authStatus } = useAuth()

  const [permissions, setPermissions] = useState<ConventionCommandPermissions | null>(null)

  const [loadState, setLoadState] = useState<DoorLoadState>('loading')

  const [loadErr, setLoadErr] = useState<string | null>(null)

  const [reloadKey, setReloadKey] = useState(0)



  useEffect(() => {

    registerDoorServiceWorker()

  }, [])



  const loadBootstrap = useCallback(async (signal: { cancelled: boolean }) => {

    if (!eventSlug) return

    setLoadState('loading')

    setLoadErr(null)

    setPermissions(null)

    try {

      const boot = await organizerDancecardFetch<{

        permissions?: ConventionCommandPermissions

      }>(eventSlug, '/organizer/bootstrap')

      if (signal.cancelled) return

      const perms = boot.permissions

      if (!perms || !commandPermissionIncludes('registration', perms)) {

        setLoadState('denied')

        return

      }

      setPermissions(perms)

      setLoadState('ready')

    } catch (e) {

      if (signal.cancelled) return

      if (e instanceof OrganizerApiError && (e.status === 403 || e.status === 401)) {

        setLoadState('denied')

        return

      }

      setLoadErr(doorLoadErrorMessage(e))

      setLoadState('error')

      console.error('[door mode] bootstrap failed', { eventSlug, error: e })

    }

  }, [eventSlug])



  useEffect(() => {
    if (authStatus !== 'ready') return
    if (!isAuthenticated) {
      setLoadState('denied')
      return
    }
    const signal = { cancelled: false }
    void loadBootstrap(signal)
    return () => {
      signal.cancelled = true
    }
  }, [loadBootstrap, reloadKey, authStatus, isAuthenticated])



  const readOnly = permissions ? !commandPermissionIncludes('registration', permissions) : true

  const backHref = `${organizerConventionBasePath(orgSlug, eventSlug)}?tab=people&peopleTab=signups`

  const conventionHref = organizerConventionBasePath(orgSlug, eventSlug)



  return (

    <div data-dc-theme="event" className="min-h-dvh flex flex-col bg-dc-surface text-dc-text">

      {!kioskMode ?

        <div className="no-print shrink-0 border-b border-dc-border px-4 py-2">

          <Link to={backHref} className="text-sm text-dc-accent hover:underline">

            ← Exit door mode

          </Link>

        </div>

      : null}

      {loadState === 'denied' ?

        authStatus !== 'ready' ?

          <p className="p-4 text-sm text-dc-muted" role="status">

            Checking session…

          </p>

        : !isAuthenticated ?

          <PermissionDeniedPanel

            title="Sign in required"

            message="Door check-in is only available to signed-in staff with registration access."

            detail="Sign in with the account your organizer assigned, then open this link again."

            backLabel="Back to event"

            backHref={conventionHref}

          />

        : <PermissionDeniedPanel

            title="Door check-in not available"

            message="You're signed in, but your account doesn't have door check-in access for this event."

            detail="Contact an event organizer or admin to request registration access on the event team."

            backLabel="Back to event"

            backHref={conventionHref}

          />

      : loadState === 'error' && loadErr ?

        <div className="p-4">

          <LoadErrorBanner

            message={loadErr}

            onRetry={() => setReloadKey((k) => k + 1)}

            retryLabel="Try again"

          />

        </div>

      : loadState === 'ready' && permissions ?

        <div className="flex-1 min-h-0">

          <DoorModePanel eventSlug={eventSlug} readOnly={readOnly} exitHref={backHref} />

        </div>

      : (

        <p className="p-4 text-sm text-dc-muted" role="status">

          Loading door mode…

        </p>

      )}

    </div>

  )

}

