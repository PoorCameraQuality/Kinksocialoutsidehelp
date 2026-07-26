/**
 * Idempotent: ensure Brax user exists and has platform_staff SITE_ADMIN.
 * Safe to run on existing dev databases without full re-seed.
 */
import { ensureBraxSiteAdmin } from '../src/db/seed-legacy.js'
import { invalidatePlatformStaffCache } from '../src/lib/platform-staff.js'

const brax = await ensureBraxSiteAdmin()
invalidatePlatformStaffCache()
console.log(`Brax site admin ensured: userId=${brax.id} email=${brax.email}`)
console.log('Log in as Brax to see Trust & Safety in the account menu.')
