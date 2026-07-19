# Justif

> Open source, self-hostable expense report management, built for international use (multilingual, multi-currency).

The name comes from the French slang "justificatif" (receipt / supporting document).

License: [MIT](./LICENSE)

---

## Table of contents

1. [Docker deployment](#1-docker-deployment-production)
2. [Local dev setup](#2-local-dev-setup)
3. [OCR configuration](#3-ocr-configuration)
4. [Currency configuration](#4-currency-configuration)
5. [Migrating vinext → standard Next.js](#5-migrating-vinext--standard-nextjs)
6. [Data & privacy](#6-data--privacy)

## 1. Docker deployment (production)

A single image bundles the backend, the frontend, and a small internal proxy
that routes `/api` and `/uploads` to the backend and everything else to the
frontend: one port to expose, one image to pull, and no more CORS/cookie
headaches since everything is served from the same origin.

```bash
cp .env.example .env
# Edit .env: JWT_SECRET, optional Mistral key, default currency...

docker compose up -d --build
```

- Application: http://localhost:3000
- Data persists in `./data/db` (SQLite) and `./data/uploads` (receipts)

Published image on GHCR: `ghcr.io/<owner>/justif:latest` (or `:<version>`,
or `:<branch-name>` for dev builds).

On first launch, the app automatically redirects to an account-creation
wizard (`/setup`).

## 2. Local dev setup

Requirements: Node.js ≥ 22 (required by vinext), [pnpm](https://pnpm.io/) ≥ 9.

```bash
pnpm install
cp .env.example .env
pnpm --filter backend run db:migrate
pnpm run dev
```

This starts in parallel:
- the Express backend on `http://localhost:3001`
- the vinext frontend on `http://localhost:3000`

## 3. OCR configuration

Two modes, configurable from `/settings` (or via environment variables):

**Cloud mode - Mistral AI**
- Create an API key at [console.mistral.ai](https://console.mistral.ai/)
- Set it in `/settings`, recommended model: `pixtral-12b-2409`

**Local mode - Ollama**
- Install [Ollama](https://ollama.com/) and a vision model (`llava`, `moondream`, `minicpm-v`)
- Set the Ollama URL (default: `http://localhost:11434`) and the model name

Use the "Test connection" button in `/settings` to verify the configuration.

## 4. Currency configuration

Multi-currency conversion uses [Frankfurter](https://frankfurter.dev) - official
European Central Bank data, free API, no key required.

- The default currency (conversion target, EUR by default) is configurable in `/settings`
- Frankfurter automatically returns the latest available ECB business-day
  rate (handles weekends and public holidays)
- If the API is unavailable, the expense is still saved (the converted
  amount stays `null` until a manual recalculation)

## 5. Migrating vinext → standard Next.js

[vinext](https://github.com/cloudflare/vinext) is an experimental Vite plugin
(v0.0.52 at the time of writing) that reimplements the Next.js 16 API surface.
With the App Router, vinext requires `@vitejs/plugin-rsc` (already included in
`apps/frontend/package.json`) - no need to declare it explicitly in
`vite.config.ts`. If you hit stability issues, migrating to standard Next.js
is straightforward:

1. In `apps/frontend/package.json`, replace `vinext` with `next` in the scripts
   (`next dev`, `next build`, `next start`)
2. Delete `apps/frontend/vite.config.ts`
3. The rest of the code (`app/`, `next.config.ts`) is unchanged - no
   modifications needed

---

## Tech stack

| Area | Choice |
|---|---|
| Frontend | [vinext](https://github.com/cloudflare/vinext) (Vite + Next.js 16 API surface) + Tailwind CSS |
| Backend | Node.js + Express |
| ORM / DB | Prisma + SQLite |
| Upload | multer + sharp (backend only) |
| Export | ExcelJS (.xlsx) |
| Auth | JWT (httpOnly cookie) + bcrypt |
| OCR | Mistral (cloud) or Ollama (local) |
| Currencies | [Frankfurter](https://frankfurter.dev) (ECB, free, no key) |
| Package manager | pnpm workspaces |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## 6. Data & privacy

### Audit log and IP address collection

Every sensitive action (sign-in, expense creation/deletion, data export,
user management, settings changes) is recorded in an `AuditLog` table with
the following fields: action type, timestamp, affected entity, actor, and the
**client IP address**.

IP addresses are collected for three reasons:

1. **Brute-force detection** - repeated failed login attempts from the same IP can be spotted and blocked at the infrastructure level.
2. **Compliance traceability** - administrative actions (role changes, bulk exports, account deletion) can be traced back to a network origin.
3. **Audit investigations** - internal or external auditors can correlate events across time and origin.

The legal basis is the operator's legitimate interest in maintaining the
security and integrity of the application and its data (GDPR Art. 6(1)(f)).

### GDPR compliance built in

- **Pseudonymisation on account deletion**: when a user account is deleted,
  the `userId` foreign key in existing audit log entries is set to `NULL`
  (`onDelete: SetNull`) - the log entries are preserved (audit trail
  integrity) but the actor is no longer identifiable.
- **No secrets in metadata**: audit metadata stores only field names and
  safe snapshots (e.g. `passwordChanged: true`, never the password value;
  key names only for settings, never values).
- **In-app privacy policy**: the app ships a `/privacy` page that discloses
  what data is collected, why, and how users can exercise their GDPR rights.
  It is linked from the login page.

### Operator responsibilities

As a self-hosted application, **you** are the data controller. You should:

- Reference the `/privacy` page (or adapt its text) in your own privacy
  notice and make it accessible to users.
- Define a log retention policy appropriate for your compliance obligations
  and purge old entries accordingly - the app does not enforce a TTL.
- If you sit behind a reverse proxy (nginx, Caddy, Traefik…), ensure the
  `X-Forwarded-For` header is set correctly so the recorded IP belongs to
  the actual client and not the proxy.

## File cleanup

Uploaded receipts are **always preserved** in `uploads/`, even after an
expense is deleted from the database. For periodic cleanup of orphaned
files, you can schedule a cron job that diffs `uploads/` against the known
`fichier` paths in the database - this isn't built in (to keep the project
lean), but contributions are welcome.
