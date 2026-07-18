# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package manager & runtime

- **Bun** (`bun@1.1.10`, pinned in `package.json`) is the sole package manager. Do not use npm/yarn/pnpm — the lockfile is `bun.lockb` and `postinstall` runs `check-dependency-version-consistency`, which will fail if versions drift between workspaces.
- Node **>=18** required.
- Environment lives in `.env.local` at the repo root. Workspace scripts read it via a `with-env` alias: `dotenv -e ../../.env.local -- <cmd>`. Copy `.env.example` first: `cp .env.example .env.local`.

## Commands (run from repo root)

```bash
bun install                # install + postinstall check-deps
bun run dev                # turbo dev --parallel (all workspaces incl. stripe worker)
bun run dev:web            # dev without the stripe worker — faster feedback loop
bun run build              # turbo build (respects topo order via ^build)
bun run lint               # turbo lint + `manypkg check` (repo hygiene)
bun run lint:fix
bun run typecheck          # turbo typecheck across all workspaces
bun run format             # prettier check (cached)
bun run format:fix         # prettier write
bun db:push                # cd packages/db && prisma db push (requires POSTGRES_URL in .env.local)
bun run gen                # turbo generators (see turbo/generators/config.ts)
bun run clean              # git clean -xdf node_modules
```

Turbo respects `--filter` — scope a task to one workspace with e.g. `turbo dev --filter @saasfly/nextjs`.

## Tests

There is no test framework configured. `CONTRIBUTING.md` states plainly: *"we dont have auto-test now"*. Do not invent test commands.

## Monorepo layout

Turborepo workspaces defined in root `package.json`: `apps/*`, `packages/*`, `tooling/*`.

```
apps/
  nextjs/         @saasfly/nextjs      — Next.js 14 App Router web app (the product)
  auth-proxy/                          — Nitro server exposing NextAuth routes ([...auth].ts)
packages/
  api/            @saasfly/api         — tRPC routers + Stripe subscriptions + email senders
  auth/           @saasfly/auth        — auth shim; exports both clerk.ts and nextauth.ts
  db/             @saasfly/db          — Prisma schema + Kysely-typed DB client
  stripe/         @saasfly/stripe      — Stripe worker/webhook logic
  ui/             @saasfly/ui          — shared Shadcn/Radix components (cn(), buttonVariants, etc.)
  common/                              — cross-cutting types/utils
tooling/
  eslint-config/ prettier-config/ tailwind-config/ typescript-config/   — shared configs consumed via workspace:*
```

Internal packages are consumed by workspace protocol (`"@saasfly/db": "workspace:*"`) and export TypeScript source directly (no build step for packages) — the Next.js app compiles them via `transpilePackages`. When editing a package used by `apps/nextjs`, `bun dev` picks up changes without a rebuild.

## Architecture cross-cuts

**Auth is dual-provider, current default is Clerk.** After June 2025 the repo defaults to Clerk (`@clerk/nextjs` in root deps). `apps/nextjs/src/middleware.ts` re-exports from `./utils/clerk`. A parallel NextAuth implementation lives on the `feature-nextauth` branch and inside `packages/auth/nextauth.ts` + `apps/auth-proxy/` — do not delete NextAuth code assuming it's dead. When adding an auth-touching feature, decide which provider it targets and mirror only where necessary.

**i18n via URL segment.** All user-facing routes live under `apps/nextjs/src/app/[lang]/` grouped by concern: `(auth)`, `(dashboard)`, `(docs)`, `(editor)`, `(marketing)`. The `lang` param drives `getDictionary()` — pages receive it as a prop and pass it into components; do not read locale from a global.

**tRPC data path is split edge/lambda.** `packages/api/src/index.ts` composes routers from `src/router/*.ts` (`auth`, `customer`, `k8s`, `stripe`, `health_check`). Two entry points: `./edge` for Edge runtime (`edge.ts`) and `./lambda` for Node. The Next app consumes them via `apps/nextjs/src/trpc/{client,server,shared}.ts`. Add new procedures inside a router in `packages/api/src/router/`, then wire into `root.ts`.

**Database is Kysely at runtime, Prisma at schema time.** Prisma is a schema-management tool only (`prisma db push`, `prisma generate`); actual queries use Kysely typed from `prisma-kysely`. Do not add Prisma Client calls — write Kysely queries against the exported client in `packages/db`.

**Content is Contentlayer2 MDX.** `apps/nextjs/contentlayer.config.ts` defines `Doc`, `Guide`, and `Author` collections sourced from `src/content/{docs,blog,guides,authors}`. `bun run build` runs `contentlayer2 build` before `next build`. New MDX files are picked up automatically; new collection *types* require editing the config.

**Environment validation.** `@t3-oss/env-nextjs` is used in `apps/nextjs/src/env.mjs`, `packages/api/src/env.mjs`, and `packages/auth/env.mjs`. Add new env vars there — reading `process.env` directly bypasses the schema and will break typed access.

**Every workspace declares its own ESLint/Prettier config** by extending `@saasfly/eslint-config/*` and setting `"prettier": "@saasfly/prettier-config"` in its `package.json`. When adding a new package, copy these blocks from `packages/db/package.json` or `packages/api/package.json`.

## Repo hygiene rules that will bite

- **Dependency versions must match across all workspaces.** `check-dependency-version-consistency .` runs on every `bun install`; a mismatched `react`, `zod`, `next`, etc. across two packages will fail the postinstall. Bump versions everywhere at once.
- **`manypkg check` runs in `bun run lint`** — flags workspace protocol issues (missing `workspace:*` on internal deps, private-package publishing mistakes).
- `.env.local` is what everything reads. `.env` alone will not work — `with-env` explicitly points at `../../.env.local`.
