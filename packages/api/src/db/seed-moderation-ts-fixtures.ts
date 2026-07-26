/**
 * T&S case fixtures for local moderation QA - creates prerequisite rows + cases.
 * Run: USE_DATABASE=true npm run db:seed-moderation-ts-fixtures -w @c2k/api
 * Also invoked from seed-moderation-demo after main db:seed.
 */
import './load-dev-env.js'
import { and, eq } from 'drizzle-orm'
import { POLICY_REASONS } from '@c2k/shared'
import { db, schema } from './index.js'
import { createReport } from '../lib/moderation-ts-intake.js'
import {
  ensureFixtureDmMessage,
  ensureFixtureOrgChatMessage,
  ensureFixtureQuarantinedMedia,
  DEMO_MOD_TS_FIXTURE_MARKER,
} from './seed-moderation-ts-fixture-data.js'

export { DEMO_MOD_TS_FIXTURE_MARKER } from './seed-moderation-ts-fixture-data.js'

async function fixtureAlreadyExists(
  targetType: string,
  targetId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: schema.moderationReports.id })
    .from(schema.moderationReports)
    .innerJoin(schema.moderationCases, eq(schema.moderationReports.caseId, schema.moderationCases.id))
    .where(
      and(
        eq(schema.moderationCases.targetContentType, targetType),
        eq(schema.moderationCases.targetContentId, targetId),
        eq(schema.moderationReports.body, DEMO_MOD_TS_FIXTURE_MARKER)
      )
    )
    .limit(1)
  return rows.length > 0
}

async function seedFixtureReport(params: {
  reporterId: string
  targetType: string
  targetId: string
  policyReason: (typeof POLICY_REASONS)[keyof typeof POLICY_REASONS]
}): Promise<string | null> {
  if (await fixtureAlreadyExists(params.targetType, params.targetId)) {
    return null
  }
  const result = await createReport({
    reporterId: params.reporterId,
    targetType: params.targetType,
    targetId: params.targetId,
    policyReason: params.policyReason,
    note: DEMO_MOD_TS_FIXTURE_MARKER,
  })
  return result.caseId
}

export async function seedModerationTsFixtures(): Promise<void> {
  if (process.env.USE_DATABASE !== 'true') {
    console.error('Set USE_DATABASE=true to seed moderation T&S fixtures.')
    process.exit(1)
  }

  const [reporter] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, 'RopeDreamer'))
    .limit(1)

  if (!reporter) {
    console.log('Moderation T&S fixtures: no RopeDreamer user; run db:seed first.')
    return
  }

  console.log('Moderation T&S fixtures: ensuring prerequisite content rows…')

  const { cleanAssetId, malwareAssetId } = await ensureFixtureQuarantinedMedia()
  const orgMsgId = await ensureFixtureOrgChatMessage()
  const dmMsgId = await ensureFixtureDmMessage()

  const created: string[] = []

  if (cleanAssetId) {
    const caseId = await seedFixtureReport({
      reporterId: reporter.id,
      targetType: 'media_asset',
      targetId: cleanAssetId,
      policyReason: POLICY_REASONS.consentSafety,
    })
    if (caseId) created.push(`media_asset (viewable quarantine) → case ${caseId}`)
  } else {
    console.log('Moderation T&S fixtures: could not create quarantined media_asset.')
  }

  if (malwareAssetId) {
    const caseId = await seedFixtureReport({
      reporterId: reporter.id,
      targetType: 'media_asset',
      targetId: malwareAssetId,
      policyReason: POLICY_REASONS.illegalGoodsServices,
    })
    if (caseId) created.push(`media_asset (malware-blocked) → case ${caseId}`)
  }

  if (orgMsgId) {
    const caseId = await seedFixtureReport({
      reporterId: reporter.id,
      targetType: 'org_chat_message',
      targetId: orgMsgId,
      policyReason: POLICY_REASONS.harassmentThreats,
    })
    if (caseId) created.push(`org_chat_message → case ${caseId}`)
  } else {
    console.log('Moderation T&S fixtures: could not create org chat message (need demo-east-collective + channel).')
  }

  if (dmMsgId) {
    const caseId = await seedFixtureReport({
      reporterId: reporter.id,
      targetType: 'message',
      targetId: dmMsgId,
      policyReason: POLICY_REASONS.harassmentThreats,
    })
    if (caseId) created.push(`message (DM) → case ${caseId}`)
  } else {
    console.log('Moderation T&S fixtures: could not create DM message (need seeded users).')
  }

  if (created.length === 0) {
    console.log('Moderation T&S fixtures: cases already exist for fixture content (nothing new).')
  } else {
    console.log('Moderation T&S fixtures created:')
    for (const line of created) console.log(`  ${line}`)
  }
  console.log('  Platform cases: http://127.0.0.1:5173/moderation/cases')
}

const isMain = process.argv[1]?.includes('seed-moderation-ts-fixtures')
if (isMain) {
  seedModerationTsFixtures()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
