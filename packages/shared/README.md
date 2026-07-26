# @c2k/shared

Browser-safe types, Zod schemas, and small utilities shared between `@c2k/web` and `@c2k/api`.

## Exports

| Subpath | Use |
|---------|-----|
| `@c2k/shared` | General types and helpers |
| `@c2k/shared/session-token` | HMAC session cookie signing (**API only** — do not import in browser bundles) |

## Build

TypeScript project references compile to `dist/`:

```bash
npm run build -w @c2k/shared
npm run typecheck -w @c2k/shared
```

Root `npm run build` builds shared before api and web.

If **`db:push`** or other tooling fails resolving `@c2k/shared`, run `npm run build -w @c2k/shared` and retry.

## Docs

- Monorepo: [`../../README.md`](../../README.md)
- Technical reference: [`../../docs/technical-reference.md`](../../docs/technical-reference.md)
