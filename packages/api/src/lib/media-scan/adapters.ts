import net from 'node:net'
import {
  MEDIA_CONTENT_RATINGS,
  MODERATION_QUEUES,
  POLICY_REASONS,
  POLICY_SEVERITIES,
  SCANNER_NAMES,
  SCANNER_NOOP_PASSED_LABEL,
  SCANNER_RESULT_STATUSES,
  SCANNER_VERSIONS,
  mediaScanSimulationEnabled,
  mediaScannerAllowNoopEnabled,
  mediaScannerRequireMalware,
  resolveMalwareScannerMode,
  resolveMediaScannerRuntimeProfile,
} from '@c2k/shared'
import { isProfileGallerySurface } from '../profile-photo-policy.js'
import { scoreProfilePortraitLikelihood } from '../profile-photo-portrait-heuristic.js'
import { captionContainsRiskTerms } from '../media-publish-lane.js'
import type { MediaScanAdapter, MediaScanAdapterResult, MediaScanContext } from './types.js'

const CLAMD_HOST = process.env.CLAMD_HOST ?? '127.0.0.1'
const CLAMD_PORT = Number(process.env.CLAMD_PORT ?? '3310')

function noopWarning(message: string): void {
  if (resolveMediaScannerRuntimeProfile() === 'local') {
    console.warn(`[media-scanner] ${message}`)
  }
}

async function pingClamd(timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: CLAMD_HOST, port: CLAMD_PORT })
    const timer = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, timeoutMs)
    socket.on('connect', () => {
      socket.write('zPING\0')
    })
    socket.on('data', (chunk) => {
      clearTimeout(timer)
      socket.destroy()
      resolve(chunk.toString().includes('PONG'))
    })
    socket.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
  })
}

export class MalwareClamAvScanner implements MediaScanAdapter {
  readonly name = SCANNER_NAMES.malwareClamav
  readonly version = SCANNER_VERSIONS[SCANNER_NAMES.malwareClamav]

  async scan(context: MediaScanContext): Promise<MediaScanAdapterResult> {
    // PR 3 (M9): simulate hooks are dead under production/staging.
    const simulate = mediaScanSimulationEnabled()
      ? process.env.MEDIA_SCAN_SIMULATE_MALWARE?.toUpperCase()
      : undefined
    if (simulate === 'BLOCKED' || simulate === 'INFECTED') {
      return {
        status: SCANNER_RESULT_STATUSES.blocked,
        labels: ['malware'],
        policyReason: POLICY_REASONS.illegalGoodsServices,
        severity: POLICY_SEVERITIES.high,
        queue: MODERATION_QUEUES.generalReview,
        userFacingSummary: 'Simulated malware detection.',
        simulated: true,
        rawResultPrivate: { simulate: 'malware' },
      }
    }
    if (simulate === 'ERROR') {
      return {
        status: SCANNER_RESULT_STATUSES.error,
        labels: ['scanner_error'],
        userFacingSummary: 'Simulated malware scanner error.',
        simulated: true,
        rawResultPrivate: { simulate: 'error' },
      }
    }

    const malwareMode = resolveMalwareScannerMode()
    const allowNoop = mediaScannerAllowNoopEnabled()
    const profile = resolveMediaScannerRuntimeProfile()

    if (malwareMode === 'noop' || (allowNoop && malwareMode === 'auto' && profile === 'local')) {
      if (malwareMode === 'noop' || allowNoop) {
        noopWarning('Malware scanner noop pass (dev/local only).')
        return {
          status: SCANNER_RESULT_STATUSES.passed,
          labels: [SCANNER_NOOP_PASSED_LABEL],
          userFacingSummary: 'Malware scan disabled (noop). Dev/local only.',
          simulated: true,
          rawResultPrivate: { mode: 'noop' },
        }
      }
    }

    const clamdUp = await pingClamd()
    if (!clamdUp) {
      const failClosed =
        profile === 'production' ||
        profile === 'staging' ||
        malwareMode === 'clamav' ||
        mediaScannerRequireMalware()

      if (failClosed) {
        return {
          status: SCANNER_RESULT_STATUSES.error,
          labels: ['scanner_unavailable'],
          userFacingSummary: 'Malware scanner required but clamd is unavailable.',
          rawResultPrivate: { host: CLAMD_HOST, port: CLAMD_PORT, profile },
        }
      }

      noopWarning('clamd unavailable. Noop pass (local dev).')
      return {
        status: SCANNER_RESULT_STATUSES.passed,
        labels: [SCANNER_NOOP_PASSED_LABEL],
        userFacingSummary: 'Malware scan skipped. Clamd unavailable (dev noop).',
        simulated: true,
        rawResultPrivate: { mode: 'auto_noop', clamdUp: false, profile },
      }
    }

    if (!context.buffer?.length) {
      const failClosed =
        profile === 'production' ||
        profile === 'staging' ||
        malwareMode === 'clamav' ||
        mediaScannerRequireMalware()
      if (failClosed) {
        return {
          status: SCANNER_RESULT_STATUSES.error,
          labels: ['scanner_unavailable'],
          userFacingSummary: 'Malware scan required but quarantine bytes could not be loaded.',
          rawResultPrivate: { clamdUp: true, skipped: 'no_buffer' },
        }
      }
      noopWarning('No quarantine bytes loaded. Noop pass (local dev).')
      return {
        status: SCANNER_RESULT_STATUSES.passed,
        labels: [SCANNER_NOOP_PASSED_LABEL],
        userFacingSummary: 'Malware scan skipped. No quarantine bytes (dev noop).',
        simulated: true,
        rawResultPrivate: { clamdUp: true, skipped: 'no_buffer' },
      }
    }

    const scanResult = await scanBufferWithClamd(context.buffer)
    if (scanResult === 'error') {
      return {
        status: SCANNER_RESULT_STATUSES.error,
        labels: ['scanner_unavailable'],
        userFacingSummary: 'Malware scan required but clamd did not return a result.',
        rawResultPrivate: { clamdUp: true, bytes: context.buffer.length, scanResult: 'error' },
      }
    }
    if (scanResult === 'infected') {
      return {
        status: SCANNER_RESULT_STATUSES.blocked,
        labels: ['malware'],
        policyReason: POLICY_REASONS.illegalGoodsServices,
        severity: POLICY_SEVERITIES.high,
        queue: MODERATION_QUEUES.generalReview,
        userFacingSummary: 'Malware detected.',
        rawResultPrivate: { clamdUp: true, bytes: context.buffer.length, infected: true },
      }
    }

    return {
      status: SCANNER_RESULT_STATUSES.passed,
      labels: ['clamd_scanned'],
      userFacingSummary: 'Malware scan passed.',
      rawResultPrivate: { clamdUp: true, bytes: context.buffer.length, infected: false },
    }
  }
}

type ClamdScanResult = 'clean' | 'infected' | 'error'

async function scanBufferWithClamd(buffer: Buffer): Promise<ClamdScanResult> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: CLAMD_HOST, port: CLAMD_PORT })
    let response = ''
    let settled = false
    const finish = (result: ClamdScanResult) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }
    const timer = setTimeout(() => finish('error'), 15_000)
    socket.on('error', () => {
      clearTimeout(timer)
      finish('error')
    })
    socket.on('connect', () => {
      socket.write('zINSTREAM\0')
      const chunkSize = 64 * 1024
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const chunk = buffer.subarray(offset, offset + chunkSize)
        const sizeBuf = Buffer.alloc(4)
        sizeBuf.writeUInt32BE(chunk.length, 0)
        socket.write(sizeBuf)
        socket.write(chunk)
      }
      socket.write(Buffer.alloc(4))
    })
    socket.on('data', (chunk) => {
      response += chunk.toString()
      if (response.includes('FOUND')) {
        clearTimeout(timer)
        finish('infected')
      } else if (response.includes('OK')) {
        clearTimeout(timer)
        finish('clean')
      } else if (response.includes('ERROR')) {
        clearTimeout(timer)
        finish('error')
      }
    })
    socket.on('close', () => {
      clearTimeout(timer)
      if (response.includes('FOUND')) finish('infected')
      else if (response.includes('OK')) finish('clean')
      else finish('error')
    })
  })
}

export class AdultClassifierScanner implements MediaScanAdapter {
  readonly name = SCANNER_NAMES.adultClassifier
  readonly version = SCANNER_VERSIONS[SCANNER_NAMES.adultClassifier]

  async scan(context: MediaScanContext): Promise<MediaScanAdapterResult> {
    // PR 3 (M9): simulate hooks are dead under production/staging.
    const simulate = mediaScanSimulationEnabled()
      ? process.env.MEDIA_SCAN_SIMULATE_CLASSIFIER?.toUpperCase()
      : undefined
    let inferred: 'SAFE' | 'EXPLICIT' | 'NON_EXPLICIT' = 'NON_EXPLICIT'

    if (simulate === 'EXPLICIT' || simulate === 'MISMATCH') {
      inferred = 'EXPLICIT'
    } else if (simulate === 'SAFE') {
      inferred = 'SAFE'
    } else if (context.contentRating === MEDIA_CONTENT_RATINGS.explicitAdult) {
      inferred = 'EXPLICIT'
    } else if (context.contentRating === MEDIA_CONTENT_RATINGS.safePublic) {
      inferred = 'SAFE'
    }

    if (
      isProfileGallerySurface(context.sourceSurface) &&
      context.buffer &&
      context.contentRating === MEDIA_CONTENT_RATINGS.safePublic
    ) {
      try {
        const portrait = await scoreProfilePortraitLikelihood(context.buffer)
        if (portrait.likelyExplicitCloseup) {
          return {
            status: SCANNER_RESULT_STATUSES.flagged,
            confidence: portrait.confidence,
            labels: ['explicit_closeup', 'profile_photo_policy'],
            policyReason: POLICY_REASONS.explicitVisibilityViolation,
            severity: POLICY_SEVERITIES.medium,
            queue: MODERATION_QUEUES.mediaReview,
            userFacingSummary:
              'This image looks like explicit close-up content, which is not allowed as a profile photo.',
            rawResultPrivate: { portrait },
          }
        }
      } catch {
        // Heuristic metadata parse is best-effort; a throw must not fail the whole
        // scan pass — remaining scanners still run and can block/flag.
      }
    }

    const declared = context.contentRating
    const mismatchSafeVsExplicit =
      declared === MEDIA_CONTENT_RATINGS.safePublic && inferred === 'EXPLICIT'
    const simulateMismatch = simulate === 'MISMATCH'

    if (mismatchSafeVsExplicit || simulateMismatch) {
      return {
        status: SCANNER_RESULT_STATUSES.flagged,
        confidence: 0.82,
        labels: ['explicit_adult', 'rating_mismatch'],
        policyReason: POLICY_REASONS.explicitVisibilityViolation,
        severity: POLICY_SEVERITIES.medium,
        queue: MODERATION_QUEUES.mediaReview,
        userFacingSummary:
          'Adult classifier suggests explicit content but member declared safe/public rating.',
        simulated: Boolean(simulate),
        rawResultPrivate: { declared, inferred },
      }
    }

    if (inferred === 'EXPLICIT') {
      return {
        status: SCANNER_RESULT_STATUSES.passed,
        confidence: 0.9,
        labels: ['explicit_adult'],
        userFacingSummary: 'Adult classifier: explicit content (allowed when attested).',
        simulated: Boolean(simulate),
        rawResultPrivate: { declared, inferred },
      }
    }

    return {
      status: SCANNER_RESULT_STATUSES.passed,
      confidence: 0.75,
      labels: inferred === 'SAFE' ? ['safe_public'] : ['non_explicit'],
      userFacingSummary: 'Adult classifier: no blocking signal.',
      rawResultPrivate: { declared, inferred },
    }
  }
}

const OCR_CRITICAL_TERMS = ['csam', 'child porn', 'underage']
const OCR_NCII_TERMS = ['leaked', 'revenge porn', 'hidden cam', 'hidden camera', 'without consent']
const OCR_MINOR_TERMS = ['teen', 'barely legal', 'under 18', 'minor']

function classifyOcrText(text: string): MediaScanAdapterResult | null {
  const haystack = text.toLowerCase()
  if (OCR_CRITICAL_TERMS.some((t) => haystack.includes(t))) {
    return {
      status: SCANNER_RESULT_STATUSES.flagged,
      confidence: 0.95,
      labels: ['ocr_critical'],
      policyReason: POLICY_REASONS.csamSuspected,
      severity: POLICY_SEVERITIES.critical,
      queue: MODERATION_QUEUES.minorSafetyRestricted,
      userFacingSummary: 'OCR flagged critical minor-safety terms.',
      rawResultPrivate: { matched: 'critical' },
    }
  }
  if (OCR_NCII_TERMS.some((t) => haystack.includes(t)) || captionContainsRiskTerms(text)) {
    const ncii = OCR_NCII_TERMS.some((t) => haystack.includes(t))
    return {
      status: SCANNER_RESULT_STATUSES.flagged,
      confidence: 0.88,
      labels: ncii ? ['ocr_ncii'] : ['ocr_risk'],
      policyReason: ncii ? POLICY_REASONS.ncii : POLICY_REASONS.hiddenCameraLeaked,
      severity: POLICY_SEVERITIES.critical,
      queue: MODERATION_QUEUES.nciiUrgent,
      userFacingSummary: 'OCR flagged non-consensual or leaked-content terms.',
      rawResultPrivate: { textSample: text.slice(0, 120) },
    }
  }
  if (OCR_MINOR_TERMS.some((t) => haystack.includes(t))) {
    return {
      status: SCANNER_RESULT_STATUSES.flagged,
      confidence: 0.8,
      labels: ['ocr_minor_coded'],
      policyReason: POLICY_REASONS.minorSafety,
      severity: POLICY_SEVERITIES.high,
      queue: MODERATION_QUEUES.mediaReview,
      userFacingSummary: 'OCR flagged minor-coded language. Review required.',
      rawResultPrivate: { matched: 'minor_coded' },
    }
  }
  if (haystack.includes('buy followers') || haystack.includes('crypto scam')) {
    return {
      status: SCANNER_RESULT_STATUSES.flagged,
      confidence: 0.7,
      labels: ['ocr_spam'],
      policyReason: POLICY_REASONS.spamScam,
      severity: POLICY_SEVERITIES.low,
      queue: MODERATION_QUEUES.spamAbuse,
      userFacingSummary: 'OCR flagged spam/scam language.',
      rawResultPrivate: {},
    }
  }
  return null
}

export class OcrRiskScanner implements MediaScanAdapter {
  readonly name = SCANNER_NAMES.ocrRisk
  readonly version = SCANNER_VERSIONS[SCANNER_NAMES.ocrRisk]

  async scan(context: MediaScanContext): Promise<MediaScanAdapterResult> {
    // PR 3 (M9): simulate hooks are dead under production/staging.
    const simulate = mediaScanSimulationEnabled()
      ? process.env.MEDIA_SCAN_SIMULATE_OCR?.toUpperCase()
      : undefined
    let text = context.originalFilename ?? ''
    if (simulate === 'NCII') text = `${text} leaked hidden camera`
    if (simulate === 'MINOR') text = `${text} barely legal teen`
    if (simulate === 'SPAM') text = `${text} buy followers crypto scam`
    if (simulate === 'CRITICAL') text = `${text} csam`

    const hit = classifyOcrText(text)
    if (hit) {
      return { ...hit, simulated: Boolean(simulate) }
    }

    return {
      status: SCANNER_RESULT_STATUSES.passed,
      labels: [],
      userFacingSummary: 'OCR risk scan: no flagged terms in available text.',
      rawResultPrivate: { textSource: 'filename_metadata_shell' },
    }
  }
}

import { ExactHashListScanner } from './hash-list.js'

export const defaultScanAdapters: MediaScanAdapter[] = [
  new MalwareClamAvScanner(),
  new ExactHashListScanner(),
  new AdultClassifierScanner(),
  new OcrRiskScanner(),
]
