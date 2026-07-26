import { createHash } from 'node:crypto'

export type LoginLockoutConfig = {
  /** Failures before the first lockout window. */
  threshold: number
  /** Base lockout duration after threshold (ms). Doubles each step, capped. */
  baseLockMs: number
  /** Max lockout duration (ms). */
  maxLockMs: number
  /** How many failures past threshold before each backoff step. */
  stepEvery: number
  /** Drop idle attempt records after this (ms). */
  idleResetMs: number
}

type AttemptState = {
  failures: number
  lockedUntil: number
  updatedAt: number
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function defaultConfig(): LoginLockoutConfig {
  return {
    threshold: intEnv('C2K_LOGIN_LOCKOUT_THRESHOLD', 5),
    baseLockMs: intEnv('C2K_LOGIN_LOCKOUT_BASE_MS', 60_000),
    maxLockMs: intEnv('C2K_LOGIN_LOCKOUT_MAX_MS', 3_600_000),
    stepEvery: intEnv('C2K_LOGIN_LOCKOUT_STEP_EVERY', 3),
    idleResetMs: intEnv('C2K_LOGIN_LOCKOUT_IDLE_RESET_MS', 3_600_000),
  }
}

/** Normalize login identifier for lockout keys (trim + lower-case). */
export function normalizeLoginLockoutIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase()
}

/** Opaque key — avoid storing raw emails in the process Map. */
export function loginLockoutKey(identifier: string): string {
  return createHash('sha256').update(normalizeLoginLockoutIdentifier(identifier)).digest('hex')
}

function lockDurationMs(failures: number, cfg: LoginLockoutConfig): number {
  if (failures < cfg.threshold) return 0
  const steps = Math.floor((failures - cfg.threshold) / cfg.stepEvery)
  const duration = cfg.baseLockMs * 2 ** steps
  return Math.min(duration, cfg.maxLockMs)
}

/**
 * In-memory per-identifier login lockout with progressive backoff.
 * Tracks both known and unknown identifiers so lockout timing does not
 * disclose whether an account exists. Single-process (matches API rate-limit).
 */
export class LoginLockoutStore {
  private readonly states = new Map<string, AttemptState>()
  private readonly cfg: LoginLockoutConfig

  constructor(cfg: Partial<LoginLockoutConfig> = {}) {
    this.cfg = { ...defaultConfig(), ...cfg }
  }

  /** Test / ops helper. */
  clear(): void {
    this.states.clear()
  }

  getConfig(): LoginLockoutConfig {
    return { ...this.cfg }
  }

  /**
   * @returns remaining lock ms when blocked; 0 when sign-in may proceed.
   */
  remainingLockMs(identifier: string, now = Date.now()): number {
    const key = loginLockoutKey(identifier)
    const state = this.states.get(key)
    if (!state) return 0
    if (now - state.updatedAt > this.cfg.idleResetMs) {
      this.states.delete(key)
      return 0
    }
    if (state.lockedUntil <= now) return 0
    return state.lockedUntil - now
  }

  recordFailure(identifier: string, now = Date.now()): { failures: number; lockedForMs: number } {
    const key = loginLockoutKey(identifier)
    const prev = this.states.get(key)
    const failures =
      prev && now - prev.updatedAt <= this.cfg.idleResetMs ? prev.failures + 1 : 1
    const lockedForMs = lockDurationMs(failures, this.cfg)
    this.states.set(key, {
      failures,
      lockedUntil: lockedForMs > 0 ? now + lockedForMs : 0,
      updatedAt: now,
    })
    return { failures, lockedForMs }
  }

  clearFailures(identifier: string): void {
    this.states.delete(loginLockoutKey(identifier))
  }
}

/** Process-wide store used by auth routes. */
export const loginLockoutStore = new LoginLockoutStore()

export const LOGIN_LOCKOUT_MESSAGE =
  'Too many sign-in attempts. Wait a bit and try again, or use password recovery.'

export const REGISTER_CONFLICT_MESSAGE =
  'Unable to complete registration. Try a different username or email, or sign in if you already have an account.'

export function isPgUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string })?.code
  if (code === '23505') return true
  const cause = (err as { cause?: { code?: string } })?.cause
  return cause?.code === '23505'
}
