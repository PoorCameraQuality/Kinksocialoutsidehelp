# Domain glossary

Definitions follow current implementation. When code and docs disagree, trust runtime behavior and tests, then fix the docs.

## Identity and people

### User
An authenticated account row in `users`. Ownership foreign keys should reference the user UUID.

### Member
A signed-in user. In UI copy this usually means "not an anonymous visitor," not a separate table.

### Profile
Public or semi-public presentation of a user: display name, bio, identity fields, visibility preferences.

### Organizer
A user with staff or management capability for an organization, group, event, or convention.

### Presenter
A capability profile for educators and speakers. Same `users` identity.

### Vendor
A shop or vendor capability profile. Payments use per-vendor Stripe Connect where enabled. Same identity spine.

## Community structure

### Organization
A lasting community with membership, forums, channels, events, and staff roles.

### Group
A smaller community unit. Uses the same forum patterns as org-scoped forums. Not a third forum stack.

### Event
A calendar gathering with RSVP and host tools. Distinct from a full convention program, though a convention may anchor events.

### Convention
Multi-day Event Systems entity: registration, program slots, ISO board, hub channels, door check-in, participation applications.

### Schedule slot
A program unit on a convention schedule.

### Education
Articles and learning surfaces under `/education`. Can publish to ECKE when public-safe.

## Visibility and access

### Visibility
Who may see a resource or field. Always enforce on the API.

### Public
Depends on context:

- SEO public: allowlisted marketing paths (`seo-policy`)
- Auth public: login not required (`public-paths`)
- Resource public: entity visibility such as `PUBLIC`

Do not merge those lists.

### Members-only
Visible to signed-in members, or to org/group members when the resource is scoped that way.

### Private
Restricted to the owner and explicitly authorized roles or relationships.

### Connections
Preferred product word for mutual relationship-gated content.

### Friends
Legacy stored settings value. Runtime gates treat it as accepted mutual connections for profile fields and DMs. Do not rename without a migration.

### Followers / following
One-way follow graph. Media enum `FOLLOWERS` is gated by accepted connections on current asset paths. Feed `connections_only` is surface-specific (following feed vs discovery); do not assume one graph edge everywhere.

### Block
Member safety action that must stay respected in notifications and social delivery.

### RSVP
Event response. Not the same as paid convention registration.

### Check-in
Door confirmation that a registrant arrived.

## Trust, safety, and media

### Report
A complaint about content or behavior. Intake maps it to a `PolicyReason`.

### Moderation
Human-governed enforcement. AI may summarize later. Humans decide.

P0 reasons need fast platform notify. Platform-critical reasons must not be dismissed as local-only. P0 is a subset of platform-critical.

### Attestation
Uploader affirmations for media publish lanes. UI checkbox fields and publish-lane fields are different shapes. Map with `mapUploaderAttestationToPublishLaneFields`.

### Quarantine
Media held pending scan or after enforcement. Do not treat it as ordinary public content.

## ECKE and publishing

### ECKE
East Coast Kink Events. Public SEO and advertising surface. Not the member app.

### Publish to ECKE
Outbound push of sanitized public-eligible records from Kink.social. Helpers live in `ecke-publish-safety.ts`.

### Sync
Refresh or unpublish an already published ECKE target. Still outbound.

## Brand and codenames

| Term | Meaning |
|------|---------|
| Kink Social / kink.social | Public product brand |
| C2K | Internal engineering codename |
| Event Systems | Organizer convention and registration product area |
| Dancecard | Historical name still seen in some organizer program paths |
| Command bridge | Convention staff permission domains |
