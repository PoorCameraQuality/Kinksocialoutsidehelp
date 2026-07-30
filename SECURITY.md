# Security

If you find a security problem, tell me privately. Don't open a public GitHub issue for something that could get people hurt (auth bypass, privacy leak, credential exposure, etc.).

Useful to include:

- what you found
- how to reproduce it
- who it could affect
- a fix idea if you have one

Contact: whatever is on the live site policy / `security.txt`, or reach me privately through the repo owner channel.

## Please don't

- Commit real secrets, prod env files, keys, or DB dumps
- Turn off auth / privacy / upload checks / rate limits / mod gates just to pass a test
- Set `AUTH_ALLOW_FALLBACK=true` in production (the API will refuse to start if that's explicitly on)
- Treat env UUID staff lists as enough for privacy bypass paths — use the real staff checks
- Ignore media quarantine / scan status on serve paths
- Blow off P0 moderation reasons

## Places that scare me (review carefully)

| Area | Why |
|------|-----|
| Session / auth | Cookies, UUID user ids, fallback sessions |
| Authorization | Org / group / convention / event / media gates |
| Privacy | Profiles, DMs, connections, feed |
| Uploads | Size limits, magic bytes, quarantine, scanners |
| Moderation | Reports, hide/delete/suspend |
| ECKE publish | Outbound only, redaction |
| WebSockets | Subscribe auth should match REST |
| Staff step-up | Extra password check before sensitive admin stuff |

Fixes go against `packages/web`, `packages/api`, and `packages/shared`. That's the app.
