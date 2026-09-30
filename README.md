# Family Budgeter

Upload PDF bank statements, get back a Google Sheet with all transactions and
a category breakdown. Two apps:

- `apps/web` — Next.js + shadcn/ui upload page, deployed to **Vercel**.
- `apps/server` — the extraction/categorization/sheet-writing pipeline
  (Claude Agent SDK + TypeSafe/Jev + Google Sheets), deployed to **GCP Cloud
  Run** (it spawns a native subprocess, which doesn't fit serverless
  functions).

## One-time setup

### 1. GCP project + service account

1. Create a GCP project (or reuse one) and enable the **Google Sheets API**.
2. Create a service account, then create a JSON key for it and download it.
3. Create one Google Sheet manually at sheets.google.com.
4. Share that sheet with the service account's `client_email` (Editor) and
   both spouses' Google accounts.
5. Copy the sheet's ID from its URL
   (`https://docs.google.com/spreadsheets/d/<THIS PART>/edit`).

   This sheet is now a **fallback only** — the app writes into it when a user
   uploads without picking a Drive folder in the browser. See step 3 below for
   the primary "create a new sheet in a picked folder" path.

### 2. Google Drive folder picker (OAuth)

The "Select Google Drive folder" button lets each user create a brand-new
sheet directly in their own Drive, using their own Google account rather
than the service account. It's a custom in-app folder browser
(`apps/web/components/drive-folder-picker.tsx`) built directly on the Drive
REST API (`files.list`), not Google's own Picker widget — the Picker widget
turned out to 401 unpredictably when embedded as an iframe in local dev
(Google's own origin-verification for the framed request, unrelated to any
config here), so there's no Picker API, API key, or app ID to set up.

1. In the same GCP project, enable the **Google Drive API**.
2. Go to **APIs & Services → Credentials** and create an **OAuth 2.0 Client
   ID** (application type: Web application). Add Authorized JavaScript
   origins for `http://localhost:3000` (local dev) and your Vercel
   production URL. This is `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
3. On the **OAuth consent screen**, leave the publishing status as
   **Testing** and add both spouses' Google accounts as **test users**.
   This app only ever has two known users, and Testing mode (up to 100 named
   test users, indefinitely) avoids Google's app-verification process
   entirely — verification is only required once an app moves to
   "In production" status while requesting sensitive scopes like the Drive
   scopes used here. Expect users to see an "unverified app" warning during
   consent and need to click through it — that's expected and fine.

### 3. API keys

- An Anthropic API key (console.anthropic.com) for `ANTHROPIC_API_KEY`.
- A TypeSafe API key for `TYPESAFE_API_KEY`.
- Make up a random string for `BACKEND_API_KEY` — it's the shared secret
  between the web app and the backend, not a third-party credential.

## Local development

```bash
npm install   # installs both apps' dependencies (npm workspaces)
```

Server (needs Node 22+ — `googleapis` requires it):

```bash
cd apps/server
cp .env.example .env   # fill in the values from the one-time setup above
npm run dev             # listens on :8080
```

Web app, in another terminal:

```bash
cd apps/web
cp .env.example .env.local
# BACKEND_URL=http://localhost:8080
# BACKEND_API_KEY=<same value as apps/server/.env>
# NEXT_PUBLIC_GOOGLE_CLIENT_ID — from the "Google Drive folder picker" setup above
npm run dev              # http://localhost:3000
```

## Deploying

### Backend → GCP Cloud Run

From the repo root (the Dockerfile expects the root as build context, since
the npm workspaces lockfile lives there):

```bash
gcloud run deploy family-budgeter-server \
  --source . \
  --dockerfile apps/server/Dockerfile \
  --region <your-region> \
  --min-instances 1 \
  --set-env-vars ANTHROPIC_API_KEY=...,TYPESAFE_API_KEY=...,GOOGLE_SHEET_ID=...,BACKEND_API_KEY=... \
  --set-secrets GOOGLE_SERVICE_ACCOUNT_KEY=<secret-name>:latest
```

`--min-instances 1` keeps a warm container so uploads don't pay a subprocess
cold-start every time. Put the service account JSON in Secret Manager rather
than passing it as a plain env var.

### Frontend → Vercel

Deploy `apps/web` with its Root Directory set to `apps/web` in the Vercel
project settings. Set these project environment variables:

- `BACKEND_URL` — the Cloud Run service URL from the step above.
- `BACKEND_API_KEY` — the same value set on the backend.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — from the "Google Drive folder picker"
  setup step, with the production Vercel URL added to that OAuth client's
  Authorized JavaScript origins.

## Verifying end-to-end

1. `curl -F statements=@statement.pdf -H "x-api-key: $BACKEND_API_KEY" http://localhost:8080/upload`
   against the local server first — confirms the pipeline and the target
   sheet update independent of the frontend.
2. Upload a real PDF through the browser UI (local or deployed) and confirm
   the success state links to the right sheet.
3. Check the sheet: transaction count matches the statement, amounts have
   correct signs, categories look reasonable, and the Category Breakdown
   totals reconcile with the sum of Transactions.
4. Upload a second, different statement and confirm the sheet is replaced,
   not appended to.
5. Try a scanned/image-only or empty PDF and confirm a sensible warning/error
   shows up instead of a silent empty sheet.
6. Click "Select Google Drive folder", complete the Google consent prompt,
   and pick a folder you own. Upload a statement and confirm the success
   link points to a **new** spreadsheet inside that folder (with both tabs
   populated), rather than the fallback `GOOGLE_SHEET_ID` sheet. Then upload
   again without picking a folder and confirm it falls back to the
   `GOOGLE_SHEET_ID` sheet as before.
