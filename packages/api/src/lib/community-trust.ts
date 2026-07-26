import {

  COMMUNITY_TRUST_LEVELS,

  type CommunityTrustLevel,

  TRUST_CAP_ACCEPTED_REFERENCES,

  TRUST_CAP_STAFF_CHECK_INS,

  TRUST_CAP_VERIFIED_PRESENTER_CREDITS,

  TRUST_CAP_VERIFIED_VENDOR_CREDITS,

  TRUST_ORGANIZER_ROLE_PARTICIPATION_WEIGHT,

} from '@c2k/shared'

import { and, count, eq, inArray, isNotNull, sql } from 'drizzle-orm'

import { db, schema } from '../db/index.js'

import { countLevelBoostingReferences } from './reference-trust.js'

import { capSignal } from './reputation-anti-gaming.js'



export type CommunityTrustBadge = {

  key: string

  label: string

  description: string

  count: number | null

}



export type CommunityTrustResponse = {

  userId: string

  username: string

  level: CommunityTrustLevel

  headline: string

  badges: CommunityTrustBadge[]

  references: {
    visible: number
    countedForLevel: number
  }

  sharedContext: {

    sharedOrganizations: number

    sharedGroups: number

    sharedEvents: number

  } | null

}



export type PositiveCounts = {

  /** All accepted references (badge display). */

  acceptedReferences: number

  /** References that count toward levels (anti-gaming filtered). */

  countedReferences: number

  staffConfirmedCheckIns: number

  conventionRegistrations: number

  verifiedPresenterCredits: number

  verifiedVendorCredits: number

  organizerRoles: number

  qualifiesVerifiedContributor: boolean

  accountAgeDays: number

  ageAffirmed: boolean

  profileComplete: boolean

  hasProfilePhoto: boolean

  memberSinceYear: number | null

}



async function countEstablishedOrgOrganizerRoles(userId: string): Promise<number> {

  const [row] = await db

    .select({ c: count() })

    .from(schema.organizationMembers)

    .where(

      and(

        eq(schema.organizationMembers.userId, userId),

        inArray(schema.organizationMembers.role, ['OWNER', 'ADMIN', 'MODERATOR']),

        sql`EXISTS (

          SELECT 1 FROM ${schema.events} e

          WHERE e.organization_id = ${schema.organizationMembers.organizationId}

          AND (

            (e.ends_at IS NOT NULL AND e.ends_at < NOW())

            OR (e.ends_at IS NULL AND e.starts_at < NOW())

          )

        )`

      )

    )

  return Number(row?.c ?? 0)

}



async function countEstablishedOrgStaffRoles(userId: string): Promise<number> {

  const [row] = await db

    .select({ c: count() })

    .from(schema.organizationMembers)

    .where(

      and(

        eq(schema.organizationMembers.userId, userId),

        eq(schema.organizationMembers.role, 'STAFF'),

        sql`EXISTS (

          SELECT 1 FROM ${schema.events} e

          WHERE e.organization_id = ${schema.organizationMembers.organizationId}

          AND (

            (e.ends_at IS NOT NULL AND e.ends_at < NOW())

            OR (e.ends_at IS NULL AND e.starts_at < NOW())

          )

        )`

      )

    )

  return Number(row?.c ?? 0)

}



async function qualifiesForVerifiedContributor(userId: string, organizerRoles: number): Promise<boolean> {

  const [

    presenterSlotCredits,

    vendorEventCredits,

    establishedOrganizer,

    establishedStaff,

    staffDuties,

  ] = await Promise.all([

    db

      .select({ c: count() })

      .from(schema.presenterTeachingCredits)

      .where(

        and(

          eq(schema.presenterTeachingCredits.presenterUserId, userId),

          eq(schema.presenterTeachingCredits.verified, true),

          isNotNull(schema.presenterTeachingCredits.scheduleSlotId)

        )

      ),

    db

      .select({ c: count() })

      .from(schema.vendorEventCredits)

      .innerJoin(schema.vendorProfiles, eq(schema.vendorEventCredits.vendorProfileId, schema.vendorProfiles.id))

      .where(and(eq(schema.vendorProfiles.userId, userId), eq(schema.vendorEventCredits.verified, true))),

    countEstablishedOrgOrganizerRoles(userId),

    countEstablishedOrgStaffRoles(userId),

    db

      .select({ c: count() })

      .from(schema.conventionStaffDuties)

      .where(eq(schema.conventionStaffDuties.userId, userId)),

  ])



  const presenterSlots = Number(presenterSlotCredits[0]?.c ?? 0)

  const vendorEvents = Number(vendorEventCredits[0]?.c ?? 0)

  const orgOrganizer = Number(establishedOrganizer ?? 0)

  const orgStaff = Number(establishedStaff ?? 0)

  const duties = Number(staffDuties[0]?.c ?? 0)



  return (

    presenterSlots > 0 ||

    vendorEvents > 0 ||

    orgOrganizer > 0 ||

    orgStaff > 0 ||

    duties > 0 ||

    (organizerRoles > 0 && orgOrganizer > 0)

  )

}



async function loadPositiveCounts(userId: string): Promise<PositiveCounts | null> {

  const [user] = await db

    .select({

      id: schema.users.id,

      createdAt: schema.users.createdAt,

      ageAffirmedAt: schema.users.ageAffirmedAt,

    })

    .from(schema.users)

    .where(eq(schema.users.id, userId))

    .limit(1)

  if (!user) return null



  const [prof] = await db

    .select({

      displayName: schema.profiles.displayName,

      bio: schema.profiles.bio,

      avatarUrl: schema.profiles.avatarUrl,

      homeZip: schema.profiles.homeZip,

      birthDate: schema.profiles.birthDate,

    })

    .from(schema.profiles)

    .where(eq(schema.profiles.userId, userId))

    .limit(1)



  const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000))

  const profileComplete = Boolean(

    prof?.displayName?.trim() &&

      prof?.bio?.trim() &&

      prof?.avatarUrl?.trim() &&

      prof?.homeZip?.trim() &&

      prof?.birthDate

  )



  const [refCounts, checkIns, regs, presenter, vendor, orgRoles, photoCount] = await Promise.all([

    countLevelBoostingReferences(userId),

    db

      .select({ c: count() })

      .from(schema.conventionCheckIns)

      .where(

        and(eq(schema.conventionCheckIns.userId, userId), isNotNull(schema.conventionCheckIns.checkedInByUserId))

      ),

    db.select({ c: count() }).from(schema.conventionRegistrants).where(eq(schema.conventionRegistrants.userId, userId)),

    db

      .select({ c: count() })

      .from(schema.presenterTeachingCredits)

      .where(

        and(

          eq(schema.presenterTeachingCredits.presenterUserId, userId),

          eq(schema.presenterTeachingCredits.verified, true)

        )

      ),

    db

      .select({ c: count() })

      .from(schema.vendorEventCredits)

      .innerJoin(schema.vendorProfiles, eq(schema.vendorEventCredits.vendorProfileId, schema.vendorProfiles.id))

      .where(and(eq(schema.vendorProfiles.userId, userId), eq(schema.vendorEventCredits.verified, true))),

    db

      .select({ c: count() })

      .from(schema.organizationMembers)

      .where(

        and(

          eq(schema.organizationMembers.userId, userId),

          inArray(schema.organizationMembers.role, ['OWNER', 'ADMIN', 'MODERATOR'])

        )

      ),

    db

      .select({ c: count() })

      .from(schema.profilePhotos)

      .innerJoin(schema.profiles, eq(schema.profilePhotos.profileId, schema.profiles.id))

      .where(eq(schema.profiles.userId, userId)),

  ])



  const organizerRoles = Number(orgRoles[0]?.c ?? 0)

  const hasPhoto = Boolean(prof?.avatarUrl?.trim()) || Number(photoCount[0]?.c ?? 0) > 0



  return {

    acceptedReferences: refCounts.totalAccepted,

    countedReferences: refCounts.countedForLevel,

    staffConfirmedCheckIns: Number(checkIns[0]?.c ?? 0),

    conventionRegistrations: Number(regs[0]?.c ?? 0),

    verifiedPresenterCredits: Number(presenter[0]?.c ?? 0),

    verifiedVendorCredits: Number(vendor[0]?.c ?? 0),

    organizerRoles,

    qualifiesVerifiedContributor: await qualifiesForVerifiedContributor(userId, organizerRoles),

    accountAgeDays,

    ageAffirmed: Boolean(user.ageAffirmedAt),

    profileComplete,

    hasProfilePhoto: hasPhoto,

    memberSinceYear: user.createdAt.getFullYear(),

  }

}



export function deriveCommunityTrustLevel(c: PositiveCounts): CommunityTrustLevel {

  const refs = capSignal(c.countedReferences, TRUST_CAP_ACCEPTED_REFERENCES)

  const checkIns = capSignal(c.staffConfirmedCheckIns, TRUST_CAP_STAFF_CHECK_INS)

  const presenterCredits = capSignal(c.verifiedPresenterCredits, TRUST_CAP_VERIFIED_PRESENTER_CREDITS)

  const vendorCredits = capSignal(c.verifiedVendorCredits, TRUST_CAP_VERIFIED_VENDOR_CREDITS)

  const organizerBoost = c.organizerRoles > 0 ? TRUST_ORGANIZER_ROLE_PARTICIPATION_WEIGHT : 0



  const participationScore =

    refs + checkIns + c.conventionRegistrations + presenterCredits + vendorCredits + organizerBoost



  if (c.qualifiesVerifiedContributor) {

    return COMMUNITY_TRUST_LEVELS.verifiedContributor

  }

  if (participationScore >= 4 || (refs >= 2 && checkIns >= 2)) {

    return COMMUNITY_TRUST_LEVELS.communityKnown

  }

  if (participationScore >= 1 || refs >= 1 || checkIns >= 1 || c.accountAgeDays >= 90) {

    return COMMUNITY_TRUST_LEVELS.establishedMember

  }

  if (c.accountAgeDays >= 14 || c.profileComplete || c.hasProfilePhoto) {

    return COMMUNITY_TRUST_LEVELS.buildingTrust

  }

  return COMMUNITY_TRUST_LEVELS.newMember

}



function headlineForLevel(level: CommunityTrustLevel, c: PositiveCounts): string {

  switch (level) {

    case COMMUNITY_TRUST_LEVELS.verifiedContributor:

      return 'Verified contributor with community roles or credits'

    case COMMUNITY_TRUST_LEVELS.communityKnown:

      return 'Known in the community through participation and references'

    case COMMUNITY_TRUST_LEVELS.establishedMember:

      return 'Established member with some verified community activity'

    case COMMUNITY_TRUST_LEVELS.buildingTrust:

      return 'Building community presence'

    default:

      return c.accountAgeDays < 30 ? 'New member with limited public history' : 'Member with limited public history'

  }

}



function buildBadges(c: PositiveCounts): CommunityTrustBadge[] {

  const badges: CommunityTrustBadge[] = []

  if (c.memberSinceYear) {

    badges.push({

      key: 'MEMBER_SINCE',

      label: `Member since ${c.memberSinceYear}`,

      description: `This member has had an account since ${c.memberSinceYear}.`,

      count: null,

    })

  }

  if (c.ageAffirmed) {

    badges.push({

      key: 'AGE_AFFIRMED',

      label: 'Age affirmed',

      description: 'This member has affirmed they meet the platform age requirement.',

      count: null,

    })

  }

  if (c.profileComplete) {

    badges.push({

      key: 'PROFILE_COMPLETE',

      label: 'Complete profile',

      description: 'Profile has core fields filled in.',

      count: null,

    })

  } else if (c.hasProfilePhoto) {

    badges.push({

      key: 'HAS_PHOTO',

      label: 'Profile photo',

      description: 'This member has a profile photo.',

      count: null,

    })

  }

  if (c.acceptedReferences > 0) {

    badges.push({

      key: 'ACCEPTED_REFERENCES',

      label: `${c.acceptedReferences} Reference${c.acceptedReferences === 1 ? '' : 's'} accepted`,

      description: 'Other members have accepted public references for this profile.',

      count: c.acceptedReferences,

    })

  }

  if (c.staffConfirmedCheckIns > 0) {

    badges.push({

      key: 'EVENT_ATTENDEE',

      label: 'Event Attendee',

      description: 'This member has at least one staff-confirmed event check-in.',

      count: c.staffConfirmedCheckIns,

    })

  }

  if (c.verifiedPresenterCredits > 0) {

    badges.push({

      key: 'PRESENTER',

      label: 'Presenter',

      description: 'Verified presenter teaching credits on record.',

      count: c.verifiedPresenterCredits,

    })

  }

  if (c.verifiedVendorCredits > 0) {

    badges.push({

      key: 'VENDOR',

      label: 'Vendor',

      description: 'Verified vendor event participation on record.',

      count: c.verifiedVendorCredits,

    })

  }

  if (c.organizerRoles > 0) {

    badges.push({

      key: 'ORGANIZER',

      label: 'Organizer',

      description: 'Holds an organizer or admin role in a community organization.',

      count: c.organizerRoles,

    })

  }

  return badges

}



async function loadSharedContext(

  targetUserId: string,

  viewerUserId: string

): Promise<CommunityTrustResponse['sharedContext']> {

  const [orgOverlap, groupOverlap, eventOverlap] = await Promise.all([

    db

      .select({ c: count() })

      .from(schema.organizationMembers)

      .where(

        and(

          eq(schema.organizationMembers.userId, targetUserId),

          sql`${schema.organizationMembers.organizationId} IN (

            SELECT organization_id FROM organization_members WHERE user_id = ${viewerUserId}

          )`

        )

      ),

    db

      .select({ c: count() })

      .from(schema.groupMembers)

      .where(

        and(

          eq(schema.groupMembers.userId, targetUserId),

          sql`${schema.groupMembers.groupId} IN (

            SELECT gm.group_id FROM group_members gm
            WHERE gm.user_id = ${viewerUserId}
            AND (
              gm.member_list_visibility = 'visible'
              OR gm.role IN ('owner', 'admin', 'moderator')
            )

          )`,

          sql`(
            ${schema.groupMembers.memberListVisibility} = 'visible'
            OR ${schema.groupMembers.role} IN ('owner', 'admin', 'moderator')
          )`,

        )

      ),

    db

      .select({ c: count() })

      .from(schema.conventionRegistrants)

      .where(

        and(

          eq(schema.conventionRegistrants.userId, targetUserId),

          sql`${schema.conventionRegistrants.conventionId} IN (

            SELECT convention_id FROM convention_registrants WHERE user_id = ${viewerUserId}

          )`

        )

      ),

  ])



  return {

    sharedOrganizations: Number(orgOverlap[0]?.c ?? 0),

    sharedGroups: Number(groupOverlap[0]?.c ?? 0),

    sharedEvents: Number(eventOverlap[0]?.c ?? 0),

  }

}



export async function buildCommunityTrust(

  userId: string,

  opts: { viewerUserId: string | null; username: string }

): Promise<CommunityTrustResponse | null> {

  const counts = await loadPositiveCounts(userId)

  if (!counts) return null



  const level = deriveCommunityTrustLevel(counts)

  const sharedContext =

    opts.viewerUserId && opts.viewerUserId !== userId

      ? await loadSharedContext(userId, opts.viewerUserId)

      : null



  return {

    userId,

    username: opts.username,

    level,

    headline: headlineForLevel(level, counts),

    badges: buildBadges(counts),

    references: {
      visible: counts.acceptedReferences,
      countedForLevel: counts.countedReferences,
    },

    sharedContext,

  }

}



export async function resolveUserIdByUsername(username: string): Promise<{ id: string; username: string } | null> {

  const [row] = await db

    .select({ id: schema.users.id, username: schema.users.username })

    .from(schema.users)

    .where(eq(schema.users.username, username))

    .limit(1)

  return row ?? null

}


