# Cloudflare Migration Guide (Workers + Static Assets + D1)

This repo is prepared for Cloudflare Workers static assets with an API route at `/api/*`.

## 1. Prerequisites

- Cloudflare account (free plan works)
- Node.js + npm
- Wrangler CLI via `npx wrangler` (no global install required)

## 2. What is already prepared in this repo

- Worker API handler: `worker/index.js`
- Worker config: `wrangler.toml`
- Static asset config (`dist`): `assets.directory = "./dist"`
- Frontend API base is now relative (`/api`) for same-origin deployments.
- D1 seed export script: `scripts/export-d1-sql.sh`
- Current seed file: `cloudflare/d1-seed.sql`

## 3. Build frontend assets

```bash
npm install
npm run build
```

## 4. Authenticate Wrangler

```bash
npx wrangler login
```

## 5. Create D1 database

```bash
npx wrangler d1 create teamwork-legacy-archive-db
```

Cloudflare prints a config snippet like:

```toml
[[d1_databases]]
binding = "DB"
database_name = "teamwork-legacy-archive-db"
database_id = "<generated-id>"
```

Paste that block into `wrangler.toml`.

## 6. Import data into D1

If you need to regenerate SQL from `archive.db`:

```bash
npm run cf:dump-d1
```

Import the seed to remote D1:

```bash
npx wrangler d1 execute DB --file=cloudflare/d1-seed.sql --remote
```

## 7. Deploy Worker + static assets

```bash
npm run cf:deploy
```

After deploy, Wrangler returns your `workers.dev` URL.

## 8. Optional custom domain

In Cloudflare dashboard, attach a custom domain to the Worker.

## Notes

- I cannot create/login external accounts on your behalf, so Cloudflare account creation/login must be done by you.
- This migration path uses D1 (SQLite on Cloudflare) instead of your local MySQL server.
- `/api/projects/:id/files` currently returns `[]` in Worker because attachments are not stored in `archive.db`.
