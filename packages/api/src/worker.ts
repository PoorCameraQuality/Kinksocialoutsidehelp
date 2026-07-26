/**
 * BullMQ worker entrypoint: moderation, external vendor sync, lifecycle/retention,
 * convention offers/people sync, search sync, feed activities, ECKE publish, digests.
 * Queue names and processors are registered below — extend with a named queue module,
 * not inline route-handler side effects.
 */
import './load-dev-env.js'
import { initErrorTracking, reportWorkerJobFailure } from './lib/error-tracking.js'
import { assertAuthFallbackSafeForStartup, assertProductionSecretsForStartup } from './lib/production-guard.js'
import { assertFieldEncryptionConfigured } from './lib/field-encryption.js'
import { assertMailConfiguredForPasswordReset } from './lib/mail-config.js'
import { Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import { db, schema } from './db/index.js'
import { EXTERNAL_SYNC_QUEUE_NAME, getExternalSyncQueue } from './lib/external-sync-queue.js'
import { syncAllExternalVendors, syncVendorExternalListings } from './lib/external-sync.js'
import { MODERATION_QUEUE_NAME } from './lib/moderation-queue.js'
import { LIFECYCLE_QUEUE_NAME, getLifecycleQueue } from './lib/lifecycle-queue.js'
import { runLifecycleSweep } from './lib/lifecycle-sweep.js'
import { runRetentionSweep } from './lib/retention-sweep.js'
import { runVirtualEventReminderSweep } from './lib/virtual-event-reminder-sweep.js'
import { runOrgDigestSweep } from './lib/org-digest-sweep.js'
import { runPinnedDigestSweep } from './lib/pinned-digest-sweep.js'
import { runPresenterTeachingCreditSync } from './lib/presenter-teaching-credit-sync.js'
import { runVendorEventCreditSync } from './lib/vendor-event-credit-sync.js'
import {
  CONVENTION_PARTICIPATION_OFFER_QUEUE_NAME,
} from './lib/convention-participation-offer-queue.js'
import { sendParticipationOfferEmail } from './lib/convention-participation-offer-email.js'
import { CONVENTION_PEOPLE_SYNC_QUEUE_NAME } from './lib/convention-people-sync-queue.js'
import { syncConventionPeopleDirectory } from './lib/convention-people-sync.js'
import {
  SEARCH_SYNC_QUEUE_NAME,
  processSearchSyncJob,
} from './lib/search/search-sync-queue.js'
import {
  FEED_ACTIVITIES_QUEUE_NAME,
} from './lib/feed-activities-queue.js'
import { insertFeedActivity, type EmitActivityParams } from './lib/feed-activities.js'
import {
  ECKE_PUBLISH_QUEUE_NAME,
  runEckePublishJob,
} from './lib/ecke-publish-queue.js'
import type { EckePublishJobName } from './lib/ecke-publish-executor.js'
import { MEDIA_RSS_QUEUE_NAME, getMediaRssQueue } from './lib/media-rss-queue.js'
import { syncAllMediaShowFeeds, syncMediaShowRss } from './lib/media-rss-sync.js'
import { startWorkerHeartbeat, stopWorkerHeartbeat } from './lib/worker-heartbeat.js'

initErrorTracking()

assertProductionSecretsForStartup()
assertAuthFallbackSafeForStartup()
assertFieldEncryptionConfigured()
assertMailConfiguredForPasswordReset(console)

startWorkerHeartbeat()

const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'

const moderationWorker = new Worker(
  MODERATION_QUEUE_NAME,
  async (job) => {
    if (job.name === 'p0_report_notify') {
      const caseId = job.data?.caseId as string | undefined
      const policyReason = job.data?.policyReason as string | undefined
      const queue = job.data?.queue as string | undefined
      if (!caseId || !policyReason || !queue) {
        console.warn('[worker] p0_report_notify missing payload', job.id)
        return
      }
      try {
        const { notifyP0ModerationCaseCreated } = await import('./lib/moderation-notify.js')
        await notifyP0ModerationCaseCreated(caseId, policyReason, queue)
        console.log('[worker] p0_report_notify ok', caseId)
      } catch (err) {
        console.error('[worker] p0_report_notify failed', caseId, err)
        throw err
      }
      return
    }

    const jobId = job.data?.jobId as string | undefined
    if (!jobId) {
      console.warn('[worker] moderation job missing jobId', job.id)
      return
    }
    console.log('[worker] moderation job', jobId, job.name)
    if (process.env.USE_DATABASE === 'true') {
      await db.update(schema.moderationJobs).set({ status: 'COMPLETED' }).where(eq(schema.moderationJobs.id, jobId))
    }
  },
  { connection: { url: redisUrl } }
)

const externalSyncWorker = new Worker(
  EXTERNAL_SYNC_QUEUE_NAME,
  async (job) => {
    if (job.name === 'sync-vendor') {
      const vendorId = job.data?.vendorId as string | undefined
      if (!vendorId) {
        console.warn('[worker] external sync-vendor missing vendorId', job.id)
        return
      }
      const r = await syncVendorExternalListings(vendorId)
      if (!r.ok) console.warn('[worker] external sync-vendor failed', vendorId, r.error)
      else console.log('[worker] external sync-vendor ok', vendorId, r.count)
      return
    }
    if (job.name === 'sync-all') {
      const r = await syncAllExternalVendors()
      const errSample = [...r.etsy.errors, ...r.shopify.errors, ...r.woo.errors].slice(0, 8)
      if (errSample.length > 0) console.warn('[worker] external sync-all errors (sample)', errSample)
      console.log('[worker] external sync-all', {
        etsy: r.etsy.vendors,
        shopify: r.shopify.vendors,
        woo: r.woo.vendors,
      })
      return
    }
    console.warn('[worker] unknown external job name', job.name, job.id)
  },
  { connection: { url: redisUrl } }
)

moderationWorker.on('failed', (job, err) => {
  reportWorkerJobFailure(MODERATION_QUEUE_NAME, job?.id, err)
})

externalSyncWorker.on('failed', (job, err) => {
  reportWorkerJobFailure(EXTERNAL_SYNC_QUEUE_NAME, job?.id, err)
})

const lifecycleWorker = new Worker(
  LIFECYCLE_QUEUE_NAME,
  async (job) => {
    if (job.name === 'sweep') {
      if (process.env.USE_DATABASE === 'true') {
        await runLifecycleSweep()
        console.log('[worker] lifecycle sweep ok')
      }
      return
    }
    if (job.name === 'virtual-event-reminders') {
      if (process.env.USE_DATABASE === 'true') {
        await runVirtualEventReminderSweep()
        console.log('[worker] virtual event reminder sweep ok')
      }
      return
    }
    if (job.name === 'org-digest-sweep') {
      if (process.env.USE_DATABASE === 'true') {
        const r = await runOrgDigestSweep()
        console.log('[worker] org digest sweep ok', r)
      }
      return
    }
    if (job.name === 'pinned-digest-sweep') {
      if (process.env.USE_DATABASE === 'true') {
        const r = await runPinnedDigestSweep()
        console.log('[worker] pinned digest sweep ok', r)
      }
      return
    }
    if (job.name === 'presenter-teaching-credit-sync') {
      if (process.env.USE_DATABASE === 'true') {
        const r = await runPresenterTeachingCreditSync()
        console.log('[worker] presenter teaching credit sync ok', r)
      }
      return
    }
    if (job.name === 'vendor-event-credit-sync') {
      if (process.env.USE_DATABASE === 'true') {
        const r = await runVendorEventCreditSync()
        console.log('[worker] vendor event credit sync ok', r)
      }
      return
    }
    if (job.name === 'retention-sweep') {
      if (process.env.USE_DATABASE === 'true') {
        const r = await runRetentionSweep()
        console.log('[worker] retention sweep ok', r.plannedActions.length)
      }
      return
    }
    if (job.name === 'trust-decay-sweep') {
      if (process.env.USE_DATABASE === 'true') {
        const { runTrustDecaySweep } = await import('./lib/trust-decay.js')
        const r = await runTrustDecaySweep()
        console.log('[worker] trust decay sweep ok', r)
      }
      return
    }
    if (job.name === 'mail-intake-sweep') {
      if (process.env.USE_DATABASE === 'true') {
        const { runMailIntakeImportSweep } = await import('./lib/mail-intake-import.js')
        const r = await runMailIntakeImportSweep(console)
        console.log('[worker] mail intake sweep ok', r)
      }
      return
    }
    console.warn('[worker] unknown lifecycle job', job.name, job.id)
  },
  { connection: { url: redisUrl } }
)

lifecycleWorker.on('failed', (job, err) => {
  reportWorkerJobFailure(LIFECYCLE_QUEUE_NAME, job?.id, err)
})

const peopleSyncWorker = new Worker(
  CONVENTION_PEOPLE_SYNC_QUEUE_NAME,
  async (job) => {
    const conventionId = job.data?.conventionId as string | undefined
    if (!conventionId) {
      console.warn('[worker] people-sync missing conventionId', job.id)
      return
    }
    if (process.env.USE_DATABASE === 'true') {
      await syncConventionPeopleDirectory(conventionId)
      console.log('[worker] people directory sync ok', conventionId)
    }
  },
  { connection: { url: redisUrl } },
)

peopleSyncWorker.on('failed', (job, err) => {
  reportWorkerJobFailure(CONVENTION_PEOPLE_SYNC_QUEUE_NAME, job?.id, err)
})

const searchSyncWorker = new Worker(
  SEARCH_SYNC_QUEUE_NAME,
  async (job) => {
    if (process.env.USE_DATABASE !== 'true') return
    await processSearchSyncJob(job.name, job.data as Record<string, string | undefined>)
    console.log('[worker] search sync ok', job.name, job.id)
  },
  { connection: { url: redisUrl } },
)

searchSyncWorker.on('failed', (job, err) => {
  reportWorkerJobFailure(SEARCH_SYNC_QUEUE_NAME, job?.id, err)
})

const participationOfferWorker = new Worker(
  CONVENTION_PARTICIPATION_OFFER_QUEUE_NAME,
  async (job) => {
    const offerId = job.data?.offerId as string | undefined
    if (!offerId) {
      console.warn('[worker] participation-offer missing offerId', job.id)
      return
    }
    if (process.env.USE_DATABASE === 'true') {
      await sendParticipationOfferEmail(offerId)
      console.log('[worker] participation offer email ok', offerId)
    }
  },
  { connection: { url: redisUrl } },
)

participationOfferWorker.on('failed', (job, err) => {
  reportWorkerJobFailure(CONVENTION_PARTICIPATION_OFFER_QUEUE_NAME, job?.id, err)
})

const feedActivitiesWorker = new Worker(
  FEED_ACTIVITIES_QUEUE_NAME,
  async (job) => {
    const data = job.data as EmitActivityParams | undefined
    if (!data?.actorId || !data.verb || !data.objectType || !data.objectId) {
      console.warn('[worker] feed-activities missing payload', job.id)
      return
    }
    if (process.env.USE_DATABASE === 'true') {
      await insertFeedActivity(data)
      console.log('[worker] feed activity ok', data.verb, data.objectId)
    }
  },
  { connection: { url: redisUrl } },
)

feedActivitiesWorker.on('failed', (job, err) => {
  reportWorkerJobFailure(FEED_ACTIVITIES_QUEUE_NAME, job?.id, err)
})

const eckePublishWorker = new Worker(
  ECKE_PUBLISH_QUEUE_NAME,
  async (job) => {
    if (process.env.USE_DATABASE !== 'true') return
    await runEckePublishJob(job.name as EckePublishJobName, job.data as Record<string, string | undefined>)
    console.log('[worker] ecke publish ok', job.name, job.id)
  },
  { connection: { url: redisUrl } },
)

eckePublishWorker.on('failed', (job, err) => {
  reportWorkerJobFailure(ECKE_PUBLISH_QUEUE_NAME, job?.id, err)
})

console.log(
  `[worker] listening on queues ${MODERATION_QUEUE_NAME}, ${EXTERNAL_SYNC_QUEUE_NAME}, ${LIFECYCLE_QUEUE_NAME}, ${CONVENTION_PEOPLE_SYNC_QUEUE_NAME}, ${SEARCH_SYNC_QUEUE_NAME}, ${CONVENTION_PARTICIPATION_OFFER_QUEUE_NAME}, ${FEED_ACTIVITIES_QUEUE_NAME}, ${ECKE_PUBLISH_QUEUE_NAME}`,
)

async function scheduleExternalRepeat(): Promise<void> {
  if (
    process.env.EXTERNAL_SYNC_DISABLE_REPEAT === 'true' ||
    process.env.ETSY_SYNC_DISABLE_REPEAT === 'true'
  ) {
    console.log('[worker] external repeat disabled via env')
    return
  }
  const every = Math.max(
    60_000,
    Number(
      process.env.EXTERNAL_SYNC_REPEAT_MS ?? process.env.ETSY_SYNC_REPEAT_MS ?? 45 * 60 * 1000
    )
  )
  try {
    await getExternalSyncQueue().add(
      'sync-all',
      {},
      { repeat: { every }, jobId: 'c2k-external-repeat-sync-all' }
    )
    console.log('[worker] scheduled external sync-all every', every, 'ms')
  } catch (e) {
    console.warn('[worker] could not schedule external repeat job (Redis unavailable?)', e)
  }
}

void scheduleExternalRepeat()

async function scheduleLifecycleRepeat(): Promise<void> {
  if (process.env.C2K_LIFECYCLE_DISABLE_REPEAT === 'true') {
    console.log('[worker] lifecycle repeat disabled')
    return
  }
  const every = Math.max(3_600_000, Number(process.env.C2K_LIFECYCLE_REPEAT_MS ?? 86_400_000))
  try {
    await getLifecycleQueue().add('sweep', {}, { repeat: { every }, jobId: 'c2k-lifecycle-repeat-sweep' })
    console.log('[worker] scheduled lifecycle sweep every', every, 'ms')
  } catch (e) {
    console.warn('[worker] could not schedule lifecycle repeat', e)
  }
}

void scheduleLifecycleRepeat()

async function scheduleRetentionRepeat(): Promise<void> {
  if (
    process.env.C2K_LIFECYCLE_DISABLE_REPEAT === 'true' ||
    process.env.C2K_RETENTION_DISABLE_REPEAT === 'true'
  ) {
    console.log('[worker] retention repeat disabled')
    return
  }
  const every = Math.max(3_600_000, Number(process.env.C2K_RETENTION_REPEAT_MS ?? 86_400_000))
  try {
    await getLifecycleQueue().add(
      'retention-sweep',
      {},
      { repeat: { every }, jobId: 'c2k-retention-repeat-sweep' },
    )
    console.log('[worker] scheduled retention sweep every', every, 'ms')
  } catch (e) {
    console.warn('[worker] could not schedule retention repeat', e)
  }
}

void scheduleRetentionRepeat()

async function scheduleTrustDecayRepeat(): Promise<void> {
  if (process.env.C2K_LIFECYCLE_DISABLE_REPEAT === 'true' || process.env.C2K_TRUST_DECAY_DISABLE === 'true') {
    console.log('[worker] trust decay repeat disabled')
    return
  }
  const every = Math.max(3_600_000, Number(process.env.C2K_TRUST_DECAY_REPEAT_MS ?? 3_600_000))
  try {
    await getLifecycleQueue().add(
      'trust-decay-sweep',
      {},
      { repeat: { every }, jobId: 'c2k-trust-decay-sweep' }
    )
    console.log('[worker] scheduled trust decay sweep every', every, 'ms')
  } catch (e) {
    console.warn('[worker] could not schedule trust decay repeat', e)
  }
}

void scheduleTrustDecayRepeat()

async function scheduleVirtualEventReminderRepeat(): Promise<void> {
  if (
    process.env.C2K_LIFECYCLE_DISABLE_REPEAT === 'true' ||
    process.env.C2K_VIRTUAL_EVENT_REMINDER_DISABLE === 'true'
  ) {
    console.log('[worker] virtual event reminder repeat disabled')
    return
  }
  const every = Math.max(
    60_000,
    Number(process.env.C2K_VIRTUAL_EVENT_REMINDER_MS ?? 900_000)
  )
  try {
    await getLifecycleQueue().add(
      'virtual-event-reminders',
      {},
      { repeat: { every }, jobId: 'c2k-virtual-event-reminder-sweep' }
    )
    console.log('[worker] scheduled virtual event reminder sweep every', every, 'ms')
  } catch (e) {
    console.warn('[worker] could not schedule virtual event reminder repeat', e)
  }
}

void scheduleVirtualEventReminderRepeat()

async function scheduleMailIntakeRepeat(): Promise<void> {
  if (process.env.C2K_MAIL_INTAKE_ENABLED !== 'true') {
    console.log('[worker] mail intake repeat disabled (C2K_MAIL_INTAKE_ENABLED!=true)')
    return
  }
  if (process.env.C2K_LIFECYCLE_DISABLE_REPEAT === 'true') {
    console.log('[worker] mail intake repeat disabled (lifecycle repeat off)')
    return
  }
  const { mailIntakeRepeatMs } = await import('./lib/mail-intake-config.js')
  const every = mailIntakeRepeatMs()
  try {
    await getLifecycleQueue().add(
      'mail-intake-sweep',
      {},
      { repeat: { every }, jobId: 'c2k-mail-intake-sweep' },
    )
    console.log('[worker] scheduled mail intake sweep every', every, 'ms')
  } catch (e) {
    console.warn('[worker] could not schedule mail intake repeat', e)
  }
}

void scheduleMailIntakeRepeat()

async function scheduleOrgDigestRepeat(): Promise<void> {
  if (
    process.env.C2K_LIFECYCLE_DISABLE_REPEAT === 'true' ||
    process.env.C2K_ORG_DIGEST_DISABLE === 'true'
  ) {
    console.log('[worker] org digest repeat disabled')
    return
  }
  const every = Math.max(3_600_000, Number(process.env.C2K_ORG_DIGEST_REPEAT_MS ?? 7 * 86_400_000))
  try {
    await getLifecycleQueue().add(
      'org-digest-sweep',
      {},
      { repeat: { every }, jobId: 'c2k-org-digest-sweep' }
    )
    console.log('[worker] scheduled org digest sweep every', every, 'ms')
  } catch (e) {
    console.warn('[worker] could not schedule org digest repeat', e)
  }
}

void scheduleOrgDigestRepeat()

async function schedulePinnedDigestRepeat(): Promise<void> {
  if (
    process.env.C2K_LIFECYCLE_DISABLE_REPEAT === 'true' ||
    process.env.C2K_PINNED_DIGEST_DISABLE === 'true'
  ) {
    console.log('[worker] pinned digest repeat disabled')
    return
  }
  const every = Math.max(3_600_000, Number(process.env.C2K_PINNED_DIGEST_REPEAT_MS ?? 7 * 86_400_000))
  try {
    await getLifecycleQueue().add(
      'pinned-digest-sweep',
      {},
      { repeat: { every }, jobId: 'c2k-pinned-digest-sweep' }
    )
    console.log('[worker] scheduled pinned digest sweep every', every, 'ms')
  } catch (e) {
    console.warn('[worker] could not schedule pinned digest repeat', e)
  }
}

void schedulePinnedDigestRepeat()

async function schedulePresenterTeachingCreditRepeat(): Promise<void> {
  if (
    process.env.C2K_LIFECYCLE_DISABLE_REPEAT === 'true' ||
    process.env.C2K_PRESENTER_CREDIT_SYNC_DISABLE === 'true'
  ) {
    console.log('[worker] presenter teaching credit sync repeat disabled')
    return
  }
  const every = Math.max(60_000, Number(process.env.C2K_PRESENTER_CREDIT_SYNC_EVERY_MS ?? 900_000))
  try {
    await getLifecycleQueue().add(
      'presenter-teaching-credit-sync',
      {},
      { repeat: { every }, jobId: 'c2k-presenter-teaching-credit-sync' },
    )
    console.log('[worker] scheduled presenter teaching credit sync every', every, 'ms')
  } catch (e) {
    console.warn('[worker] could not schedule presenter teaching credit sync repeat', e)
  }
}

void schedulePresenterTeachingCreditRepeat()

async function scheduleVendorEventCreditRepeat(): Promise<void> {
  if (
    process.env.C2K_LIFECYCLE_DISABLE_REPEAT === 'true' ||
    process.env.C2K_VENDOR_EVENT_CREDIT_SYNC_DISABLE === 'true'
  ) {
    console.log('[worker] vendor event credit sync repeat disabled')
    return
  }
  const every = Math.max(60_000, Number(process.env.C2K_VENDOR_EVENT_CREDIT_SYNC_EVERY_MS ?? 900_000))
  try {
    await getLifecycleQueue().add(
      'vendor-event-credit-sync',
      {},
      { repeat: { every }, jobId: 'c2k-vendor-event-credit-sync' },
    )
    console.log('[worker] scheduled vendor event credit sync every', every, 'ms')
  } catch (e) {
    console.warn('[worker] could not schedule vendor event credit sync repeat', e)
  }
}

void scheduleVendorEventCreditRepeat()

const mediaRssWorker = new Worker(
  MEDIA_RSS_QUEUE_NAME,
  async (job) => {
    if (job.name === 'sync-show') {
      const showId = job.data?.showId as string | undefined
      if (!showId) {
        console.warn('[worker] media-rss sync-show missing showId', job.id)
        return
      }
      if (process.env.USE_DATABASE === 'true') {
        const r = await syncMediaShowRss(showId)
        console.log('[worker] media-rss sync-show', showId, r)
      }
      return
    }
    if (job.name === 'sync-all') {
      if (process.env.USE_DATABASE === 'true') {
        const r = await syncAllMediaShowFeeds()
        if (r.errors.length) console.warn('[worker] media-rss sync-all errors (sample)', r.errors.slice(0, 5))
        console.log('[worker] media-rss sync-all', r)
      }
      return
    }
    console.warn('[worker] unknown media-rss job', job.name, job.id)
  },
  { connection: { url: redisUrl } },
)

mediaRssWorker.on('failed', (job, err) => {
  reportWorkerJobFailure(MEDIA_RSS_QUEUE_NAME, job?.id, err)
})

async function scheduleMediaRssRepeat(): Promise<void> {
  if (process.env.C2K_MEDIA_RSS_DISABLE === 'true') {
    console.log('[worker] media-rss repeat disabled')
    return
  }
  const every = Math.max(3_600_000, Number(process.env.C2K_MEDIA_RSS_REPEAT_MS ?? 6 * 3_600_000))
  try {
    await getMediaRssQueue().add('sync-all', {}, { repeat: { every }, jobId: 'c2k-media-rss-repeat-sync-all' })
    console.log('[worker] scheduled media-rss sync-all every', every, 'ms')
  } catch (e) {
    console.warn('[worker] could not schedule media-rss repeat', e)
  }
}

void scheduleMediaRssRepeat()

async function shutdown() {
  await stopWorkerHeartbeat()
  await Promise.all([
    moderationWorker.close(),
    externalSyncWorker.close(),
    lifecycleWorker.close(),
    mediaRssWorker.close(),
    peopleSyncWorker.close(),
    searchSyncWorker.close(),
    participationOfferWorker.close(),
    feedActivitiesWorker.close(),
    eckePublishWorker.close(),
  ])
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
