# Documentation cleanup inventory

**Status:** Inventory complete. Canonical engineer docs created/rewritten in-repo (Pass 1 rewrite started 2026-07-26). Historical docs remain in place for the private archive. Pass 2 extraction not started.

**Scope:** Markdown and operator docs in this repository. Pass 1 prepares human documentation for the engineer-facing snapshot. The current repo stays the private development archive. Pass 2 will copy only approved docs into a sibling clean repository.

**Counts:** About 247 `.md` files under `docs/`, plus root `README.md`, `AGENTS.md`, and `c2k_alpha_ux_front-end_470b13ef.plan.md`. No root `SECURITY.md` or `CONTRIBUTING.md` today.

**Verified stack facts used below:**

| Claim | Checked against | Result |
|-------|-----------------|--------|
| Active app is `packages/web`, `packages/api`, `packages/shared` | Root README, workspace packages, Dockerfiles | Accurate |
| Local infra via `docker-compose.dev.yml` | File present, README commands | Accurate |
| Prod VPS via `docker-compose.prod.yml` + `docker-compose.prod.vps.yml` + Caddy | Files present, README | Accurate |
| Node 20 for full test suite | Root README | Accurate for practice |
| `package.json` engines `node >= 18` | `package.json` | **Disagreement:** README prefers Node 20. Document Node 20 as the supported version. |
| Both `package-lock.json` and `pnpm-lock.yaml` exist | Root | **Open for Pass 2:** CI and scripts mostly use npm. Confirm before dropping pnpm. |
| `k8s/` directory exists | Path check | Present. Treat as obsolete unless a supported path is proven. |
| Mailpit / MinIO / Redis local | `docker-compose.dev.yml`, strategic guidance | Accurate |

---

## Target engineer-facing set

Only create a file in the clean repo when verified content exists.

| Target path | Build from | Notes |
|-------------|------------|-------|
| `README.md` | Root README + REPO_MAP + LOCAL facts | Rewrite. Drop agent and alpha promo framing. |
| `CONTRIBUTING.md` | New from ENGINEERING_ONBOARDING + EXTEND_BEFORE_ADD + package scripts | Create |
| `SECURITY.md` | New from trust-safety playbooks + legal request docs + reporting surfaces | Create. No root SECURITY.md today. |
| `docs/ARCHITECTURE.md` | `architecture/README.md` + 01–13 + ADR index | Merge. Drop agent language. |
| `docs/LOCAL_DEVELOPMENT.md` | README local section + ENGINEERING_ONBOARDING + ALPHA_SEED_WORLD + LOCALHOST_DEMO_LINKS | Merge |
| `docs/DEPLOYMENT.md` | DEPLOYMENT_RUNBOOK + ALPHA_DEPLOYMENT + SERVER_MOUNT_RUNBOOK + VPS_SECURITY_HARDENING | Merge. Prefer VPS path. Demote or drop k8s unless verified. |
| `docs/ENVIRONMENT_VARIABLES.md` | FEATURE_REGISTRY env sections + `.env.example` / `.env.production.example` + launch-audit external-services | New consolidated table. Verify every name in code. |
| `docs/TESTING.md` | E2E.md + UI_TESTING_CONTRACT + package.json test scripts + QA_TESTER_GUIDE (slim) | Merge |
| `docs/DATABASE.md` | technical-reference + migrations notes + DATA_INVENTORY_AND_RETENTION + privacy/retention | Merge |
| `docs/DOMAIN_GLOSSARY.md` | Keep, humanize | Already useful |
| `docs/PRIVACY_AND_VISIBILITY.md` | privacy/* + LEGAL_REQUEST_* + architecture permission notes + design/06 | Merge |
| `docs/MODERATION_AND_REPORTING.md` | trust-safety/* + audits/trust-and-safety operational parts + MODERATION_WIREFRAME | Merge. Drop orchestration plans. |
| `docs/MEDIA_AND_STORAGE.md` | MEDIA_IMAGE_PROXY + T&S upload/lifecycle + handoff photo facts that are still true | Merge after verifying against code |
| `docs/ECKE_INTEGRATION.md` | ECKE_PUBLIC_PUBLISHING_CONTRACT + PRIVACY_CONTRACT + CONTROL_PLANE + ENTITY_MAP + ecke-bridge | Merge. Drop rollout theater and announcement drafts. |
| `docs/OPERATIONS.md` | ops/* + ALPHA_OBSERVABILITY + SERVER_CUTOVER_LOG (facts only) | Merge |
| `docs/TROUBLESHOOTING.md` | New from DEPLOYMENT + ops mail + common failures | Create from verified failure modes only |
| `docs/KNOWN_LIMITATIONS.md` | New from PILOT_READINESS gaps + launch-audit unmapped risks + alpha status | Create |
| `docs/adr/*` | Keep active ADRs | Keep. Humanize titles if needed. |
| Package READMEs | `packages/*/README.md` | Keep short package pointers |

---

## Actions legend

| Action | Meaning |
|--------|---------|
| **keep** | Stays in engineer-facing set after humanize (possibly renamed) |
| **merge** | Unique accurate facts move into a canonical doc. Source not copied as-is. |
| **archive** | Remains only in the private development archive. Not copied to the clean repo. |
| **delete-from-export** | Same as archive for Pass 2. Not deleted from this private repo. |

Link updates listed under each group apply when Pass 1 rewrite / Pass 2 export runs.

---

## Root markdown

| Current path | Purpose | Accurate? | Needed? | Dupes? | Destination | Action | Tool/generated language | Links to update |
|--------------|---------|-----------|---------|--------|-------------|--------|-------------------------|-----------------|
| `README.md` | Product + local + deploy overview | Mostly. Node engines disagreement. | Yes | Partial overlap with ENGINEERING_ONBOARDING | Root README | keep (rewrite) | Mentions agent constraints via strategic guidance link | Point to new canonical docs |
| `AGENTS.md` | Launch hardening review rules | Process policy | Archive for export. Useful historically. | Overlaps CONTRIBUTING/SECURITY review ideas | Private archive only | archive | Agent reviewer workflow framing | Remove from engineer index |
| `c2k_alpha_ux_front-end_470b13ef.plan.md` | Generated UI plan | Stale planning | No | UI sprint docs | Exclude | archive | Generated plan filename | None in engineer docs |

---

## Canonical / index docs (`docs/` root, high value)

| Current path | Purpose | Accurate? | Needed? | Dupes? | Destination | Action | Tool language | Links |
|--------------|---------|-----------|---------|--------|-------------|--------|---------------|-------|
| `docs/README.md` | Doc index | Index is agent-centric and outdated | Yes after rewrite | Indexes many archive docs | `docs/README.md` slim index | keep (rewrite) | Yes: agent rules, handoff bundle, attack plan | Rebuild to canonical set only |
| `docs/FEATURE_REGISTRY.md` | Routes, modules, env | Large. Partially stale vs code. Needs claim-by-claim check. | Yes as source for ENVIRONMENT + ARCHITECTURE | Many UI inventories | Split into ARCHITECTURE + ENVIRONMENT_VARIABLES | merge | Pass numbering, month-end pause notes | Update all FEATURE_REGISTRY links |
| `docs/C2K-STRATEGIC-GUIDANCE.md` | Product phases + constraints | Mix of product truth and agent rules | Product parts yes | PLATFORM_VISION, MASTER_NEXT_STEPS | ARCHITECTURE + KNOWN_LIMITATIONS + CONTRIBUTING | merge | Heavy Cursor/agent language | Drop agent sections from export |
| `docs/MASTER_NEXT_STEPS.md` | Session priorities | Planning | No for engineer snapshot | NEXT_STEPS, PROJECT_ROADMAP | Archive. Useful facts -> KNOWN_LIMITATIONS | archive | Agent queue, handoff | Redirects |
| `docs/NEXT_STEPS.md` | Redirect | N/A | No | MASTER_NEXT_STEPS | archive | archive | No | — |
| `docs/PROJECT_ROADMAP.md` | Work tracks | Planning | No | MASTER_NEXT_STEPS | archive | archive | Mild | — |
| `docs/BACKLOG_QUEUE.md` | Autonomous backlog | Tool queue | No | — | archive | archive | Autonomous agent, worker prompts | — |
| `docs/HANDOFF.md` | Rolling session handoff | Session log | No | handoff/ | archive | archive | Agent handoff | — |
| `docs/ENGINEERING_ONBOARDING.md` | How to navigate code | Mostly current after recent edits | Yes | README | LOCAL_DEVELOPMENT + CONTRIBUTING | merge | Low | — |
| `docs/DOMAIN_GLOSSARY.md` | Domain terms | Current | Yes | — | DOMAIN_GLOSSARY.md | keep (humanize) | Low | — |
| `docs/EXTEND_BEFORE_ADD.md` | Avoid duplicate models | Accurate product rule | Yes | Cursor rule duplicate | CONTRIBUTING | merge | Low | — |
| `docs/REPO_MAP.md` | Repo layout | Mostly | Yes | README | README repo map | merge | Cleanup inventory refs | — |
| `docs/PROJECT_DECISIONS.md` | Living decisions | Mixed age | Selective | ADRs | ARCHITECTURE / ADRs | merge | Low | — |
| `docs/PLATFORM_VISION.md` | Product vision | Product | Slim only | strategic guidance | Archive or short ARCHITECTURE intro | merge | Agent workflow section | — |
| `docs/PILOT_READINESS.md` | Alpha operator gate | Partially | Limitations + ops | ALPHA_* | KNOWN_LIMITATIONS + OPERATIONS | merge | Mild | — |
| `docs/technical-reference.md` | Monorepo technical notes | Needs re-verify | Yes | FEATURE_REGISTRY | ARCHITECTURE + DATABASE | merge | Low | — |
| `docs/HUMAN_READABILITY_AUDIT.md` | Recent readability campaign | Accurate as audit log | No for outside engineers | — | archive | archive | Campaign language | — |
| `docs/DOCUMENTATION_CLEANUP_INVENTORY.md` | This file | Meta | Keep in private archive. May copy into clean repo for Pass 2 transparency. | — | Optional in export | keep | None | — |
| `docs/CODE_CLEANUP_INVENTORY.md` | Code cleanup inventory | Historical | No | REPO_MAP | archive | archive | Low | — |

---

## Deployment and operations

| Current path | Purpose | Accurate? | Needed? | Dupes? | Destination | Action | Tool language | Links |
|--------------|---------|-----------|---------|--------|-------------|--------|---------------|-------|
| `docs/DEPLOYMENT_RUNBOOK.md` | Deploy runbook | Needs VPS path verify | Yes | ALPHA_DEPLOYMENT, SERVER_MOUNT | DEPLOYMENT.md | merge | Low | — |
| `docs/ALPHA_DEPLOYMENT.md` | Alpha deploy notes | Partial | Selective | DEPLOYMENT_RUNBOOK | DEPLOYMENT.md | merge | Low | — |
| `docs/SERVER_MOUNT_RUNBOOK.md` | First prod mount | Historical + ops | Selective | DEPLOYMENT | DEPLOYMENT.md | merge | Low | — |
| `docs/SERVER_CUTOVER_LOG.md` | Prod delta journal | Ops journal | Private archive. Facts only if still true. | — | OPERATIONS slim or archive | archive | Mentions .cursor plans | — |
| `docs/VPS_SECURITY_HARDENING.md` | VPS hardening | Likely useful | Yes | — | DEPLOYMENT / OPERATIONS | merge | Low | — |
| `docs/VPS_ALPHA_READINESS.md` | Operator checklist | Mixed | Selective | PILOT_READINESS | OPERATIONS / KNOWN_LIMITATIONS | merge | Mild | — |
| `docs/VPS_ALPHA_EXECUTION_LOG.md` | Long execution log | Historical | No | — | archive | archive | Agent pass language | — |
| `docs/DEPLOY_SMOKE.md` | Smoke after deploy | Useful | Yes | SMOKE_CHECKLIST | TESTING / OPERATIONS | merge | Low | — |
| `docs/SMOKE_CHECKLIST.md` | Manual smoke | Useful | Yes | DEPLOY_SMOKE | TESTING | merge | Low | — |
| `docs/DEPLOY_MAIL_K8S.md` | Mail + k8s | Likely obsolete if VPS-only | Unclear | PROD_SMTP_K8S | Verify then archive or merge mail parts | merge/archive pending | k8s | Stop if k8s unsupported |
| `docs/PROD_SMTP_K8S_CHECKLIST.md` | SMTP/k8s checklist | Unclear | Unclear | DEPLOY_MAIL_K8S | Same as above | merge/archive pending | k8s | — |
| `docs/ops/mail-production.md` | Production mail | Likely current | Yes | — | OPERATIONS / MEDIA? no -> OPERATIONS | merge | Low | — |
| `docs/ops/glitchtip-self-host.md` | Optional GlitchTip | Optional | If still supported | ALPHA_OBSERVABILITY | OPERATIONS | merge | Low | — |
| `docs/ops/uptime-kuma-checks.md` | Uptime checks | Optional | If still used | — | OPERATIONS | merge | Low | — |
| `docs/ALPHA_OBSERVABILITY.md` | Alpha observability | Partial | Selective | ops/* | OPERATIONS | merge | Pass language | — |
| `docs/REALTIME_SCALING.md` | Realtime scaling notes | Needs verify | Selective | architecture/05 | ARCHITECTURE | merge | Low | — |
| `docs/LAUNCH_PHASED_ATTACK_PLAN.md` | Launch phases | Dramatic name, planning | No as titled | LAUNCH_E2E | Archive. Checklist facts -> ENGINEERING_REVIEW later | archive | Attack plan wording | Rename if any facts kept |
| `docs/LAUNCH_E2E_VERIFICATION_INVENTORY.md` | E2E launch inventory | Mixed | Selective for TESTING | E2E.md | TESTING merge then archive rest | merge | Agent pass | — |
| `docs/ECKE_LAUNCH_READINESS.md` | Two-domain SEO sign-off | Partial | ECKE_INTEGRATION | ECKE_* | merge | Mild | — |
| `docs/ALPHA_DEPENDENCY_RISK_REGISTER.md` | Dependency risks | Needs update | KNOWN_LIMITATIONS | — | merge | Low | — |
| `docs/PILOT_CRITICAL_GAP_AUDIT.md` | Gap audit | Historical | KNOWN_LIMITATIONS selective | — | archive | Mild | — |

**Stop condition:** Do not keep k8s docs in the clean repo until someone confirms Kubernetes is an active or approved target. Current preferred path in README is VPS Compose + Caddy.

---

## Local development, testing, QA

| Current path | Purpose | Accurate? | Needed? | Dupes? | Destination | Action | Tool language |
|--------------|---------|-----------|---------|--------|-------------|--------|---------------|
| `docs/E2E.md` | Playwright | Likely | Yes | UI_TESTING_CONTRACT | TESTING.md | merge | Low |
| `docs/UI_TESTING_CONTRACT.md` | UI test contract | Partial | Selective | E2E | TESTING.md | merge | Pass language |
| `docs/QA_TESTER_GUIDE.md` | Manual QA | Useful for alpha | Slim | ALPHA_QA_JOURNEY | TESTING or CONTRIBUTING | merge | Low |
| `docs/ALPHA_QA_JOURNEY.md` | Structured QA | Useful | Slim | QA_TESTER_GUIDE | TESTING | merge | Low |
| `docs/ALPHA_SEED_WORLD.md` | Seed world | Likely | LOCAL_DEVELOPMENT | — | merge | Low |
| `docs/LOCALHOST_DEMO_LINKS.md` | Demo links | Useful locally | LOCAL_DEVELOPMENT | — | merge | Low |
| `docs/locations.md` | Places seed | Useful | DATABASE / LOCAL | — | merge | Low |
| `docs/PUSH_VAPID_DEV.md` | Web push local | If still used | LOCAL | — | merge after verify | Low |
| `docs/PUBLIC_ALPHA_PROMOTION.md` | Marketing/tester promo | Not engineering core | No | — | archive | Promotional |

---

## Architecture and ADRs

| Current path | Purpose | Action | Destination | Tool language |
|--------------|---------|--------|-------------|---------------|
| `docs/architecture/README.md` | Architecture index | merge | ARCHITECTURE.md | Mentions ChatGPT advisors |
| `docs/architecture/01-domain-boundaries.md` through `13-interoperability-federation.md` | Domain series | merge | ARCHITECTURE.md sections | Low |
| `docs/architecture/CONVENTION_PEOPLE_TAB.md` | People tab reference | keep or merge | ARCHITECTURE appendix or organizer section | Low |
| `docs/architecture/ADR-004-multi-tier-moderation.md` | ADR duplicate location | merge | `docs/adr/` | Low |
| `docs/adr/README.md` + `002`–`006` + `ECKE_SUPABASE_INGEST.md` | ADRs | keep | `docs/adr/` | Low |
| `docs/EVENT_SYSTEMS_IDENTITY.md` | Identity ADR-like | merge | ARCHITECTURE / adr | Low |
| `docs/ORGANIZER_CONSOLE.md` | Organizer console | merge | ARCHITECTURE or ORGANIZER section | Low |
| `docs/DANCECARD_ORGANIZER_PARITY.md` | Dancecard parity | Selective | ARCHITECTURE / KNOWN_LIMITATIONS | Low |

---

## Privacy, legal, moderation, media

| Current path | Purpose | Action | Destination | Notes |
|--------------|---------|--------|-------------|-------|
| `docs/privacy/data-inventory.md` | Data inventory | merge | DATABASE / PRIVACY | Prefer over older duplicates |
| `docs/privacy/retention-policy.md` | Retention ops | merge | DATABASE / PRIVACY | Cross-check `retention-policy.ts` |
| `docs/privacy/vendor-registry.md` | Subprocessors | merge | PRIVACY | Scaffold |
| `docs/privacy/LEGAL-RISK-PRINCIPLE.md` | Legal principle | merge | PRIVACY / SECURITY | Short |
| `docs/DATA_INVENTORY_AND_RETENTION.md` | Inventory + retention | merge | Same as privacy/* | Dedupe with privacy/ |
| `docs/LEGAL_REQUEST_AND_DATA_MINIMIZATION.md` | Legal requests | merge | PRIVACY / SECURITY | Keep accurate procedures |
| `docs/LEGAL-PROFILE-TRUST-SAFETY-MASTER-PLAN.md` | Large T&S plan | archive after merge | MODERATION | Worker prompt sections out |
| `docs/trust-safety/*` (4 files) | Playbooks + matrix | merge | MODERATION / SECURITY | Keep playbooks |
| `docs/audits/trust-and-safety/*` operational docs | MEDIA_LIFECYCLE, UPLOAD_PIPELINE, MODERATOR_WORKFLOW, POLICY_TAXONOMY, SCANNER_ADAPTERS, V1_EXPLICIT_MEDIA_POLICY | merge | MEDIA / MODERATION | Drop master plans and wave ledgers from export |
| Remaining T&S audit plans | Planning / audits | archive | — | Tool/orchestration language common |
| `docs/MODERATION_WIREFRAME.md` | Plain walkthrough | merge | MODERATION | Good tone already |
| `docs/MEDIA_IMAGE_PROXY.md` | imgproxy | merge | MEDIA_AND_STORAGE | Verify against docker media compose |
| `docs/SEARCH_TYPESENSE.md` | Typesense | merge | ARCHITECTURE / OPERATIONS | Optional overlay |
| `docs/DISCOVERY_SEARCH_SPIKE.md` | Spike | archive | — | Spike |
| `docs/TRENDING_SCORE.md` | Trending | merge if still used | ARCHITECTURE | Verify |

---

## ECKE documentation cluster

| Current path | Action | Destination | Notes |
|--------------|--------|-------------|-------|
| `docs/ECKE_PUBLIC_PUBLISHING_CONTRACT.md` | merge | ECKE_INTEGRATION.md | Primary contract |
| `docs/ECKE_PUBLISH_PRIVACY_CONTRACT.md` | merge | ECKE_INTEGRATION.md | Privacy rules |
| `docs/ECKE_PUBLISH_CONTROL_PLANE.md` | merge | ECKE_INTEGRATION.md | Control plane |
| `docs/ECKE_C2K_ENTITY_MAP.md` | merge | ECKE_INTEGRATION.md | Entity map |
| `docs/ecke-bridge.md` | merge | ECKE_INTEGRATION.md | Photo bridge runbook |
| `docs/KINK_SOCIAL_ECKE_PUBLISH_MIGRATION.md` | merge selective | ECKE_INTEGRATION.md | Migration notes if still relevant |
| `docs/ECKE_PUBLISH_EXECUTOR_ARCHITECTURE.md` | merge selective | ECKE_INTEGRATION.md | Planning residue. Verify implemented parts only |
| `docs/ECKE_PUBLISH_GROUP_DASHBOARD.md` | merge selective | ECKE_INTEGRATION.md | UI surface |
| `docs/ECKE_PUBLISH_PARITY_AUDIT.md` | archive | — | Audit log |
| `docs/ECKE_PUBLISH_ROLLOUT_PLAN.md` | archive | — | Pass theater |
| `docs/ECKE_PUBLISH_FINAL_COMPLETION_AUDIT.md` | archive | — | Completion theater |
| `docs/ECKE_C2K_HOOKUP_MASTER.md` | archive | — | Handoff master |
| `docs/ECKE_PUBLISH_TESTING_ANNOUNCEMENT*.md` | archive | — | Announcement drafts |
| `docs/ECKE_PUBLISH_TESTING_ARTICLE_CONTENT.md` | archive | — | Paste content |
| `docs/adr/004-ecke-member-presentation-layer.md` | keep | adr/ | ADR |
| `docs/adr/ECKE_SUPABASE_INGEST.md` | keep | adr/ | ADR |
| `docs/launch-audit/ecke-publish-map.md` | merge selective | ECKE_INTEGRATION | Inventory map |

---

## Design and UI documentation

Most UI sprint briefs, screenshot audits, and GPT design context are **archive** for the engineer export. Keep only durable design-system facts.

| Group | Paths | Action | Destination |
|-------|-------|--------|-------------|
| Design canon | `docs/design/01`–`08`, `docs/C2K-DESIGN-SYSTEM.md`, `docs/UI_SURFACE_SYSTEM.md`, `docs/PREMIUM_VISUAL_SYSTEM.md`, `docs/STORYBOOK_UI_SYSTEM.md` | merge selective | Optional `docs/DESIGN_SYSTEM.md` only if engineers need it to build UI. Otherwise archive and keep tokens in code. |
| Design research / bible | DESIGN_BIBLE, DESIGN_RESEARCH, DESIGN_SYSTEM_RESEARCH, ADULT_PLATFORM_DESIGN_RESEARCH, DESIGN_RESEARCH | archive | Private archive |
| GPT UI context | `docs/GPT_UI_DESIGN_CONTEXT.md` | archive | Tool briefing |
| UI inventories / sprints / audits | All `UI_*`, `UX_*`, `VISUAL_AUDIT`, `WAYFINDING`, `FETLIFE_CLASS_HOME`, `MY_FINDINGS_ON_USABILITY`, `BRANDING_AND_SOCIAL_SHARING`, `SOCIAL_GRAPH_*`, desktop sprint briefs | archive | Private archive |
| `docs/audits/ui/**` | UI QA system + screenshots | archive | Do not ship screenshot packs |
| Storybook | STORYBOOK_UI_SYSTEM | merge one paragraph into LOCAL or CONTRIBUTING if Storybook remains supported | Verify `npm run storybook` |

---

## Handoff, plans, launch-audit, archive folders

| Group | Paths | Action | Notes |
|-------|-------|--------|-------|
| `docs/handoff/**` | All session/GPT handoffs | archive | Explicit external-AI material |
| `docs/plans/**` | Orchestration / planning briefs | archive | Tool prompts |
| `docs/archive/**` | Already archived | archive | Do not export |
| `docs/launch-audit/**` | Phase-1 launch inventory | merge selective maps into ARCHITECTURE / TESTING / ECKE. Archive logs and agent preflight. | HUMAN_PREFLIGHT is agent-framed |
| `docs/policies/POLICY-HUB-ARCHITECTURE.md` | Policy hub | merge | PRIVACY or ARCHITECTURE |

---

## Package and vendor docs

| Path | Action | Notes |
|------|--------|-------|
| `packages/web/README.md` | keep | Short |
| `packages/api/README.md` | keep | Short |
| `packages/shared/README.md` | keep | Short |
| `legacy/README.md` | archive | Historical Next.js |
| `vendor/**/README*.md` and docs | archive | Reference only. Not engineer snapshot |

---

## Tooling docs outside `docs/` (for Pass 2 awareness)

These are not rewritten in Pass 1 as engineer docs. They are excluded from the clean repo unless proven required.

| Path | Action for export |
|------|-------------------|
| `.cursor/**` | exclude |
| `.agents/**` | exclude |
| `AGENTS.md` | exclude |
| Root `*.log`, `*-out.txt`, `tmp-*`, plan files | exclude |
| `docs/handoff/C2K_PROJECT_CONTEXT_LATEST.txt` if present | exclude |

---

## Known accuracy conflicts to resolve during rewrite

1. **Node version:** README says Node 20. `package.json` engines allow `>=18`. Prefer documenting Node 20 as the supported version for tests and CI.
2. **Package manager:** Both npm and pnpm lockfiles exist. Scripts and README use npm. Confirm CI/Docker before choosing one for the clean repo.
3. **Kubernetes:** `k8s/` and mail/k8s docs exist. README preferred path is VPS Compose. Do not document k8s as supported without verification.
4. **FEATURE_REGISTRY size and age:** Last updated stamp mid-2026. Route registrar count must be rechecked against `packages/api/src/server.ts` before copying claims into ENVIRONMENT or ARCHITECTURE.
5. **Strategic guidance vs architecture:** When they disagree on runtime facts, architecture docs and code win. When they disagree on product priority, keep a short KNOWN_LIMITATIONS note, not agent rules.
6. **ECKE Pass language:** Many ECKE docs describe rollout passes. Engineer docs should describe current behavior, queues, and failure modes verified in code.

---

## Link update plan (after rewrite)

When canonical files land:

1. Replace `docs/README.md` index so it lists only active engineer docs.
2. Grep for `FEATURE_REGISTRY`, `MASTER_NEXT_STEPS`, `BACKLOG_QUEUE`, `HANDOFF`, `C2K-STRATEGIC-GUIDANCE`, `GPT_UI`, `handoff/`, `LAUNCH_PHASED_ATTACK` and retarget or remove.
3. Update root README links.
4. Update `.cursor/rules` and AGENTS references only in the private archive. Do not carry those into the clean repo.
5. Check `packages/*/README.md` for stale doc links.

---

## Pass 1 next steps (not started yet)

1. Humanize and consolidate into the canonical set listed above.
2. Verify each retained technical claim against code, Compose, env examples, and tests.
3. Search engineer-facing docs for tool terms and em dashes.
4. Stop. Do not extract the clean repository until this rewrite pass finishes.

## Pass 2 reminder

Do not clean this repository in place. Extract approved files into a sibling directory such as `../kink-social-engineering`, verify build/test/Docker there, then initialize git and push to `outsidehelp` only when instructed.

---

## File coverage statement

Every `.md` file under `docs/` falls into one of the groups above:

- Canonical / index tables
- Deployment and operations
- Local / testing / QA
- Architecture and ADRs
- Privacy / legal / moderation / media
- ECKE cluster
- Design and UI (bulk archive)
- handoff / plans / launch-audit / archive
- Package READMEs

If a new markdown file is added after this inventory date, append a row before export.
