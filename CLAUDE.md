# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A two-person household tool: upload PDF bank statements through a web page,
get back a Google Sheet with all transactions and a category breakdown. See
`README.md` for the one-time GCP setup (service account, Document AI
processor, Sheets sharing) and deployment steps — this file is about the
code, not the setup.

## Architecture

Two apps in an npm workspace (`apps/*`), deployed to **different platforms**
for one specific reason: `apps/server` uses the Claude Agent SDK, which
spawns a native Claude Code CLI subprocess. That doesn't fit serverless
functions, so the split is:

- `apps/web` — Next.js 16 + shadcn/ui. One page (`app/page.tsx`) with an
  upload form (`components/upload-form.tsx`). Its only backend logic is
  `app/api/upload/route.ts`, which receives the browser's `FormData` and
  forwards it server-side to `apps/server`, attaching a shared-secret
  `x-api-key` header (`BACKEND_API_KEY`, must match on both sides). Deployed
  to Vercel.
- `apps/server` — Fastify service that does the actual work, deployed to GCP
  Cloud Run (needs a persistent container, not serverless, for the subprocess
  reason above). One real route, `POST /upload` (`src/routes/upload.ts`),
  which buffers uploaded PDFs in memory (no disk, no database — nothing is
  retained after the response) and runs them through
  `src/pipeline/` in sequence:
  1. `ocr.ts` — runs each uploaded PDF through Google Document AI's
     synchronous `processDocument` API (a **Document OCR** processor, not a
     specialized parser) to get plain text, using the same service-account
     credentials as `writeSheet.ts`. Empty/unreadable OCR output becomes a
     warning, not a thrown error; only genuine API/auth failures abort the
     request. The sync API tops out around 15 pages per file — fine for
     ordinary statements, not solved further here.
  2. `extractTransactions.ts` — sends the OCR'd text (not the original PDF)
     to the Agent SDK's `query()` as plain text content blocks on a single
     streamed user message, using `outputFormat: { type: 'json_schema' }` to
     get typed structured output back on the final result message
     (`structured_output`), rather than a custom tool-call. Uses the `haiku`
     model alias — cheap is fine here since Document AI already did the hard
     part; this call only structures already-clean text into JSON.
     **Gotcha**: the schema passed here must NOT include a top-level
     `$schema` key — zod's `toJSONSchema()` adds one by default, and the
     Claude Code CLI's `--json-schema` flag fails trying to resolve it as a
     `$ref`. The code strips it before use; don't reintroduce it.
  3. `categorize.ts` — one TypeSafe (`@typesafe-ai/sdk`) `choice()` call per
     transaction, batched with concurrency (not one big call), classifying
     into the fixed list in `categories.ts`.
  4. `aggregate.ts` — pure function, sums by category and income/expense, no
     external calls.
  5. `writeSheet.ts` — writes both tabs. If the request includes a
     `driveTarget` (a Drive folder id + the end user's own OAuth access
     token, obtained client-side via the Picker button in `upload-form.tsx`),
     it creates a brand-new spreadsheet in that folder using the user's own
     Google auth. Otherwise it falls back to the service account writing
     into the fixed `GOOGLE_SHEET_ID` sheet (the original behavior). Either
     way, each upload session **clears and rewrites the sheet from
     scratch** — there is deliberately no cross-session dedup/history/
     database, and no server-side persistence of which folder/sheet was
     used.

`categories.ts` is the single source of truth for budget categories —
consumed by both the TypeSafe classification criteria and the sheet's row
order. Change categories there, not anywhere else.

Errors from any pipeline stage are `PipelineError` (`src/errors.ts`), tagged
with a `stage` (`ocr` | `extraction` | `categorization` | `sheet_write` |
`verification`) that flows
through to the HTTP error response so the frontend/curl caller knows which
stage failed. `categorize.ts` distinguishes systemic TypeSafe failures (auth/
connection — aborts the whole request) from per-item failures (falls back to
category `"Other"` and continues).

## Commands

Everything is run per-app; there is no root-level build/test/lint script.

```bash
npm install               # from repo root — installs both workspaces
```

**`apps/server`** (Node >=22 required — `googleapis` enforces this):
```bash
cd apps/server
npm run dev          # tsx watch, loads .env via node's --env-file flag
npm run build         # tsc -> dist/
npm run start         # node dist/server.js (production; expects real env vars, no .env file)
npm run typecheck     # tsc --noEmit
```
There is no test suite and no lint script in `apps/server` currently.

**`apps/web`**:
```bash
cd apps/web
npm run dev
npm run build         # also typechecks + lints (Next.js does this as part of build)
npm run lint
npm run typecheck
```

Local env files: `apps/server/.env` and `apps/web/.env.local` (see each
app's `.env.example`). Next.js hot-reloads `.env.local` changes in dev
without a restart; `apps/server` does not — restart `npm run dev` after
editing `apps/server/.env`.

## Working in this codebase

- `apps/server` targets Node 22+ specifically because `googleapis` requires
  it (TypeSafe only needs 20+). Don't lower `engines.node` without checking
  that constraint still holds.
- The Agent SDK's actual type definitions live in
  `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` — it's a large,
  frequently-changing surface, and outdated blog posts/training data about
  its shape are not reliable. Check the installed types before relying on
  an API shape (e.g. `outputFormat`, `query()` options, message types).
- `apps/web` was scaffolded on Next.js 16, which has real breaking changes
  from earlier Next versions. It ships version-matched docs at
  `node_modules/next/dist/docs/` and its own `apps/web/AGENTS.md` points
  there — read the relevant doc before assuming an older App Router
  convention still applies.
- The Docker build for `apps/server` (`apps/server/Dockerfile`) must be run
  with the **repo root** as build context (`docker build -f
  apps/server/Dockerfile .`), not `apps/server` itself — the npm workspaces
  lockfile lives at the root, and the Dockerfile copies both apps'
  `package.json` files to keep `npm ci` consistent with it, even though it
  only builds the server.
