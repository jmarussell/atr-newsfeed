# Cloudflare Workers/D1 Future Setup

This is a dormant scaffold for moving the ATR newsfeed from Google Sheets to a Cloudflare D1-backed API later.

The live `index.html` still reads from Google Sheets. Do not switch production to D1 until the workflow is approved and tested.

## What Is Included

- `worker/src/index.js` - small Cloudflare Worker API
- `worker/migrations/0001_init.sql` - D1 schema
- `wrangler.toml` - Worker/D1 config placeholder
- `package.json` - Wrangler scripts

## API Shape

Read feed items:

```bash
GET /api/feed?limit=20&offset=0
```

Publish an item:

```bash
POST /api/publish
Authorization: Bearer <PUBLISH_TOKEN>
Content-Type: application/json

{
  "date": "2026-07-14",
  "blurb": "Finished ATR-style feed blurb",
  "source": "Reuters",
  "url": "https://www.reuters.com/...",
  "submitted_by": "sai",
  "original_url": "https://www.reuters.com/...",
  "original_text": "Optional raw input"
}
```

## Cloudflare Setup Later

Run these only when Sai/Jon explicitly approve moving beyond the Sheet prototype.

```bash
npm install
npx wrangler login
npx wrangler d1 create atr-newsfeed
```

Copy the returned D1 `database_id` into `wrangler.toml`, replacing `REPLACE_WITH_D1_DATABASE_ID`.

Then:

```bash
npx wrangler d1 migrations apply atr-newsfeed --remote
npx wrangler secret put PUBLISH_TOKEN
npx wrangler deploy
```

## Guardrails

- Keep `@asiatechreview` as an output/backfill source, not the source of record.
- Use D1 only after approval.
- Publish endpoint must stay token-protected.
- The bot must verify DB write plus public feed readback before reporting success.
- Bulletin/channel posting should happen only after feed publish succeeds.
