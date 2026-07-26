import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { isUserIdentityBanned } from './peer-reputation.js'

export type VendorShopPerson = {
  username: string
  displayName: string | null
}

export type VendorShopAccess = {
  isOwner: boolean
  isRunner: boolean
  canManageShop: boolean
}

export type VendorProfileRow = typeof schema.vendorProfiles.$inferSelect

const NO_ACCESS: VendorShopAccess = { isOwner: false, isRunner: false, canManageShop: false }

export async function loadVendorShopOwner(ownerUserId: string): Promise<VendorShopPerson | null> {
  const [row] = await db
    .select({
      username: schema.users.username,
      displayName: schema.profiles.displayName,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, ownerUserId))
    .limit(1)
  if (!row?.username) return null
  return { username: row.username, displayName: row.displayName }
}

export async function loadVendorCoOwners(vendorProfileId: string): Promise<VendorShopPerson[]> {
  const links = await db
    .select({ userId: schema.vendorCoOwners.userId })
    .from(schema.vendorCoOwners)
    .where(eq(schema.vendorCoOwners.vendorProfileId, vendorProfileId))
  if (links.length === 0) return []
  const userIds = links.map((l) => l.userId)
  const rows = await db
    .select({
      username: schema.users.username,
      displayName: schema.profiles.displayName,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(inArray(schema.users.id, userIds))
  return rows
    .filter((r) => r.username)
    .map((r) => ({ username: r.username, displayName: r.displayName }))
}

export async function loadVendorCoOwnerUserIds(vendorProfileId: string): Promise<string[]> {
  const links = await db
    .select({ userId: schema.vendorCoOwners.userId })
    .from(schema.vendorCoOwners)
    .where(eq(schema.vendorCoOwners.vendorProfileId, vendorProfileId))
  return links.map((l) => l.userId)
}

export async function loadVendorShopPeople(
  vendorProfileId: string,
  ownerUserId: string,
): Promise<{ owner: VendorShopPerson | null; coOwners: VendorShopPerson[] }> {
  const [owner, coOwners] = await Promise.all([
    loadVendorShopOwner(ownerUserId),
    loadVendorCoOwners(vendorProfileId),
  ])
  return { owner, coOwners }
}

export async function replaceVendorCoOwners(
  vendorProfileId: string,
  ownerUserId: string,
  coOwnerUserIds: string[],
): Promise<void> {
  const unique = [...new Set(coOwnerUserIds.filter((id) => id !== ownerUserId))]
  await db.delete(schema.vendorCoOwners).where(eq(schema.vendorCoOwners.vendorProfileId, vendorProfileId))
  if (unique.length === 0) return
  await db.insert(schema.vendorCoOwners).values(unique.map((userId) => ({ vendorProfileId, userId })))
}

export async function getVendorShopAccess(
  vendorProfileId: string,
  userId: string,
): Promise<VendorShopAccess | null> {
  if (!userId || (await isUserIdentityBanned(userId))) return NO_ACCESS
  const [vendor] = await db
    .select({ userId: schema.vendorProfiles.userId })
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.id, vendorProfileId))
    .limit(1)
  if (!vendor) return null
  if (vendor.userId === userId) {
    return { isOwner: true, isRunner: false, canManageShop: true }
  }
  const [co] = await db
    .select({ id: schema.vendorCoOwners.id })
    .from(schema.vendorCoOwners)
    .where(and(eq(schema.vendorCoOwners.vendorProfileId, vendorProfileId), eq(schema.vendorCoOwners.userId, userId)))
    .limit(1)
  if (!co) return NO_ACCESS
  return { isOwner: false, isRunner: true, canManageShop: true }
}

/** Primary owner or listed co-owner (shop runner) — for shop management routes. */
export async function isVendorShopManager(vendorProfileId: string, userId: string): Promise<boolean> {
  const access = await getVendorShopAccess(vendorProfileId, userId)
  return access?.canManageShop === true
}

export async function requireVendorOwner(
  vendorProfileId: string,
  userId: string,
): Promise<{ ok: true; vendor: VendorProfileRow } | { ok: false; status: 403 | 404 }> {
  if (!userId || (await isUserIdentityBanned(userId))) {
    return { ok: false, status: 403 }
  }
  const [vendor] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.id, vendorProfileId))
    .limit(1)
  if (!vendor) return { ok: false, status: 404 }
  if (vendor.userId !== userId) return { ok: false, status: 403 }
  return { ok: true, vendor }
}

export async function requireVendorShopManager(
  vendorProfileId: string,
  userId: string,
): Promise<{ ok: true; vendor: VendorProfileRow; access: VendorShopAccess } | { ok: false; status: 403 | 404 }> {
  if (!userId || (await isUserIdentityBanned(userId))) {
    return { ok: false, status: 403 }
  }
  const [vendor] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.id, vendorProfileId))
    .limit(1)
  if (!vendor) return { ok: false, status: 404 }
  const access = await getVendorShopAccess(vendorProfileId, userId)
  if (!access?.canManageShop) return { ok: false, status: 403 }
  return { ok: true, vendor, access }
}

/** Resolve vendor for `/vendors/me/*` management routes (owned shop or single runner shop). */
export async function resolveManagedVendorForMeRoutes(
  userId: string,
  vendorProfileIdHint?: string | null,
): Promise<
  | { ok: true; vendor: VendorProfileRow; access: VendorShopAccess }
  | { ok: false; status: 403 | 404 | 400; error: string }
> {
  if (!userId || (await isUserIdentityBanned(userId))) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  if (vendorProfileIdHint) {
    const gate = await requireVendorShopManager(vendorProfileIdHint, userId)
    if (!gate.ok) {
      return { ok: false, status: gate.status, error: gate.status === 404 ? 'Vendor not found' : 'Forbidden' }
    }
    return { ok: true, vendor: gate.vendor, access: gate.access }
  }

  const [owned] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.userId, userId))
    .limit(1)
  if (owned) {
    return { ok: true, vendor: owned, access: { isOwner: true, isRunner: false, canManageShop: true } }
  }

  const runnerLinks = await db
    .select({ vendorProfileId: schema.vendorCoOwners.vendorProfileId })
    .from(schema.vendorCoOwners)
    .where(eq(schema.vendorCoOwners.userId, userId))
  if (runnerLinks.length === 0) {
    return { ok: false, status: 404, error: 'No vendor shop' }
  }
  if (runnerLinks.length > 1) {
    return {
      ok: false,
      status: 400,
      error: 'You help run multiple shops. Open the shop page or pass vendorId.',
    }
  }

  const gate = await requireVendorShopManager(runnerLinks[0]!.vendorProfileId, userId)
  if (!gate.ok) {
    return { ok: false, status: gate.status, error: gate.status === 404 ? 'Vendor not found' : 'Forbidden' }
  }
  return { ok: true, vendor: gate.vendor, access: gate.access }
}

export async function listManagedVendorShops(userId: string): Promise<
  Array<{
    id: string
    displayName: string
    slug: string
    visibility: string | null
    logoUrl: string | null
    lastUpdated: Date | null
    role: 'owner' | 'runner'
    isOwner: boolean
    isRunner: boolean
    canManageShop: boolean
  }>
> {
  if (!userId || (await isUserIdentityBanned(userId))) return []

  const [owned] = await db
    .select({
      id: schema.vendorProfiles.id,
      displayName: schema.vendorProfiles.displayName,
      slug: schema.vendorProfiles.slug,
      visibility: schema.vendorProfiles.visibility,
      logoUrl: schema.vendorProfiles.logoUrl,
      lastUpdated: schema.vendorProfiles.createdAt,
    })
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.userId, userId))
    .limit(1)

  const runnerRows = await db
    .select({
      id: schema.vendorProfiles.id,
      displayName: schema.vendorProfiles.displayName,
      slug: schema.vendorProfiles.slug,
      visibility: schema.vendorProfiles.visibility,
      logoUrl: schema.vendorProfiles.logoUrl,
      lastUpdated: schema.vendorProfiles.createdAt,
    })
    .from(schema.vendorCoOwners)
    .innerJoin(schema.vendorProfiles, eq(schema.vendorCoOwners.vendorProfileId, schema.vendorProfiles.id))
    .where(eq(schema.vendorCoOwners.userId, userId))

  const items: Array<{
    id: string
    displayName: string
    slug: string
    visibility: string | null
    logoUrl: string | null
    lastUpdated: Date | null
    role: 'owner' | 'runner'
    isOwner: boolean
    isRunner: boolean
    canManageShop: boolean
  }> = []

  if (owned) {
    items.push({
      ...owned,
      role: 'owner',
      isOwner: true,
      isRunner: false,
      canManageShop: true,
    })
  }

  const ownedId = owned?.id
  for (const row of runnerRows) {
    if (ownedId && row.id === ownedId) continue
    items.push({
      ...row,
      role: 'runner',
      isOwner: false,
      isRunner: true,
      canManageShop: true,
    })
  }

  return items
}
