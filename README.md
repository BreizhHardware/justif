# Justif

> Gestion de notes de frais open source et auto-hébergeable, conçue pour un usage international (multilingue, multidevise).
> Open source, self-hostable expense report management, built for international use (multilingual, multi-currency).

Le nom vient de l'argot français « justificatif » (receipt / supporting document).

Licence : [MIT](./LICENSE)

---

## 🇫🇷 Documentation en français

### Sommaire

1. [Déploiement Docker](#1-déploiement-docker-production)
2. [Démarrage en dev local](#2-démarrage-en-dev-local)
3. [Configuration OCR](#3-configuration-ocr)
4. [Configuration des devises](#4-configuration-des-devises)
5. [Migration vinext → Next.js standard](#5-migration-vinext--nextjs-standard)

### 1. Déploiement Docker (production)

Une seule image regroupe le backend, le frontend et un petit proxy interne
qui route `/api` et `/uploads` vers le backend et le reste vers le frontend :
un seul port à exposer, une seule image à pull, et plus de souci CORS/cookies
puisque tout est servi depuis la même origine.

```bash
cp .env.example .env
# Éditez .env : JWT_SECRET, clé Mistral éventuelle, devise par défaut...

docker compose up -d --build
```

- Application : http://localhost:3000
- Les données persistent dans `./data/db` (SQLite) et `./data/uploads` (justificatifs)

Image publiée sur GHCR : `ghcr.io/<owner>/justif:latest` (ou `:<version>`,
ou `:<branche>` pour les versions de dev).

Au premier lancement, l'application redirige automatiquement vers un assistant
de création de compte (`/setup`).

### 2. Démarrage en dev local

Prérequis : Node.js ≥ 22 (requis par vinext), [pnpm](https://pnpm.io/) ≥ 9.

```bash
pnpm install
cp .env.example .env
pnpm --filter backend run db:migrate
pnpm run dev
```

Cela démarre en parallèle :
- le backend Express sur `http://localhost:3001`
- le frontend vinext sur `http://localhost:3000`

### 3. Configuration OCR

Deux modes, configurables depuis `/settings` (ou via les variables d'environnement) :

**Mode Cloud — Mistral AI**
- Créez une clé API sur [console.mistral.ai](https://console.mistral.ai/)
- Renseignez-la dans `/settings`, modèle recommandé : `pixtral-12b-2409`

**Mode Local — Ollama**
- Installez [Ollama](https://ollama.com/) et un modèle vision (`llava`, `moondream`, `minicpm-v`)
- Renseignez l'URL Ollama (défaut : `http://localhost:11434`) et le nom du modèle

Le bouton « Tester la connexion » dans `/settings` permet de vérifier la configuration.

### 4. Configuration des devises

La conversion multidevise utilise [Frankfurter](https://frankfurter.dev) — données
officielles de la Banque Centrale Européenne, API gratuite et sans clé.

- La devise par défaut (cible de conversion, EUR par défaut) se configure dans `/settings`
- Frankfurter retourne automatiquement le taux du dernier jour ouvré BCE
  disponible (gestion des week-ends et jours fériés)
- En cas d'indisponibilité de l'API, la dépense est tout de même sauvegardée
  (le montant converti reste `null` jusqu'à un recalcul manuel)

### 5. Migration vinext → Next.js standard

[vinext](https://github.com/cloudflare/vinext) est un plugin Vite expérimental
(v0.0.52 au moment de l'écriture) qui réimplémente la surface d'API de Next.js 16.
Avec l'App Router, vinext requiert `@vitejs/plugin-rsc` (déjà inclus dans
`apps/frontend/package.json`) — il n'a pas besoin d'être déclaré explicitement
dans `vite.config.ts`. En cas de problème de stabilité, la migration vers
Next.js standard est directe :

1. Dans `apps/frontend/package.json`, remplacez `vinext` par `next` dans les scripts
   (`next dev`, `next build`, `next start`)
2. Supprimez `apps/frontend/vite.config.ts`
3. Le reste du code (`app/`, `next.config.ts`) est identique — aucune
   modification nécessaire

---

## 🇬🇧 English documentation

### Table of contents

1. [Docker deployment](#1-docker-deployment-production)
2. [Local dev setup](#2-local-dev-setup)
3. [OCR configuration](#3-ocr-configuration)
4. [Currency configuration](#4-currency-configuration)
5. [Migrating vinext → standard Next.js](#5-migrating-vinext--standard-nextjs)

### 1. Docker deployment (production)

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

### 2. Local dev setup

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

### 3. OCR configuration

Two modes, configurable from `/settings` (or via environment variables):

**Cloud mode — Mistral AI**
- Create an API key at [console.mistral.ai](https://console.mistral.ai/)
- Set it in `/settings`, recommended model: `pixtral-12b-2409`

**Local mode — Ollama**
- Install [Ollama](https://ollama.com/) and a vision model (`llava`, `moondream`, `minicpm-v`)
- Set the Ollama URL (default: `http://localhost:11434`) and the model name

Use the "Test connection" button in `/settings` to verify the configuration.

### 4. Currency configuration

Multi-currency conversion uses [Frankfurter](https://frankfurter.dev) — official
European Central Bank data, free API, no key required.

- The default currency (conversion target, EUR by default) is configurable in `/settings`
- Frankfurter automatically returns the latest available ECB business-day
  rate (handles weekends and public holidays)
- If the API is unavailable, the expense is still saved (the converted
  amount stays `null` until a manual recalculation)

### 5. Migrating vinext → standard Next.js

[vinext](https://github.com/cloudflare/vinext) is an experimental Vite plugin
(v0.0.52 at the time of writing) that reimplements the Next.js 16 API surface.
With the App Router, vinext requires `@vitejs/plugin-rsc` (already included in
`apps/frontend/package.json`) — no need to declare it explicitly in
`vite.config.ts`. If you hit stability issues, migrating to standard Next.js
is straightforward:

1. In `apps/frontend/package.json`, replace `vinext` with `next` in the scripts
   (`next dev`, `next build`, `next start`)
2. Delete `apps/frontend/vite.config.ts`
3. The rest of the code (`app/`, `next.config.ts`) is unchanged — no
   modifications needed

---

## Stack technique / Tech stack

| Domaine | Choix |
|---|---|
| Frontend | [vinext](https://github.com/cloudflare/vinext) (Vite + Next.js 16 API surface) + Tailwind CSS |
| Backend | Node.js + Express |
| ORM / DB | Prisma + SQLite |
| Upload | multer + sharp (backend uniquement) |
| Export | ExcelJS (.xlsx) |
| Auth | JWT (cookie httpOnly) + bcrypt, single-user |
| OCR | Mistral (cloud) ou Ollama (local) |
| Devises | [Frankfurter](https://frankfurter.dev) (BCE, gratuit, sans clé) |
| Package manager | pnpm workspaces |

## Contribuer / Contributing

Voir [CONTRIBUTING.md](./CONTRIBUTING.md).

## Nettoyage des fichiers / File cleanup

Les justificatifs uploadés sont **toujours conservés** dans `uploads/`, même
après suppression d'une dépense en base. Pour un nettoyage périodique des
fichiers orphelins, vous pouvez planifier une tâche cron qui compare le
contenu de `uploads/` avec les chemins `fichier` connus en base — cette
fonctionnalité n'est pas fournie nativement afin de garder le projet simple,
mais une contribution est bienvenue.

Uploaded receipts are **always preserved** in `uploads/`, even after an
expense is deleted from the database. For periodic cleanup of orphaned
files, you can schedule a cron job that diffs `uploads/` against the known
`fichier` paths in the database — this isn't built in (to keep the project
lean), but contributions are welcome.
