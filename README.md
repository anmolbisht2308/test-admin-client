# mockprep client

This repo holds the student site and the admin panel for mockprep, a mock-test platform for Indian
competitive exams. The API, worker and shared types are in
[test-admin-server](https://github.com/anmolbisht2308/test-admin-server).

| Package               | What it is                                                              | Deployed to       |
| --------------------- | ----------------------------------------------------------------------- | ----------------- |
| `apps/web`            | Student site (Next.js 15 App Router, Tailwind v4, shadcn/ui), port 3000 | Vercel project #1 |
| `apps/admin`          | Admin panel (same stack), port 3001                                     | Vercel project #2 |
| `packages/ui`         | `@mockprep/ui`: shared components and `QuestionRenderer`                | bundled into apps |
| `packages/api-client` | `@mockprep/api-client`: fetch helper, auth provider, error helpers      | bundled into apps |
| `packages/config`     | Shared tsconfig, eslint and prettier config                             | not deployed      |

`@mockprep/types` (shared types and Zod schemas) is installed from a
[test-admin-server GitHub Release](https://github.com/anmolbisht2308/test-admin-server/releases)
tarball, pinned by version. See the server README for how to release a new version.

## How the apps talk to the api

Browsers never call the api directly. Each app sends same-origin `/api/*` requests, and a Next.js
rewrite (`next.config.ts`) forwards them to `API_ORIGIN`. This makes the httpOnly refresh cookies
first-party, so login works in Safari and in Chrome with third-party cookies blocked.
Server components, such as the exam pages, fetch `API_ORIGIN` directly and cache the result for
60 seconds.

- **Access token.** Kept in memory only, never in localStorage.
- **Refresh token.** An httpOnly `SameSite=Strict` cookie scoped to `/api/auth` (students) or
  `/api/admin/auth` (admins).
- **Refreshing.** `@mockprep/api-client` refreshes on a 401 and retries the request. It runs one
  refresh at a time, even across tabs (using Web Locks), because refresh tokens rotate.

## Local development

Requirements: Node 22.12+ and pnpm (`corepack enable`). The api must be running from the server
repo on `http://localhost:4000`.

```bash
# terminal 1: server repo
cd ../test-admin-server && docker compose up -d
pnpm --filter @mockprep/api seed     # exams, templates and the SEED_ADMIN_EMAIL superadmin
pnpm dev

# terminal 2: this repo
corepack enable
pnpm install
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
pnpm dev
```

**Student site: http://localhost:3000**

1. Go to `/login` and enter any Indian mobile number.
2. With `OTP_PROVIDER=console`, the api prints the code in terminal 1:
   `DEV OTP for +91…: 123456`.
3. Enter the code. Onboarding asks for your name, target exams and language, then you land on
   `/home`.
4. Exam pages are at `/exams` and `/exams/<slug>`.

**Admin: http://localhost:3001**

1. Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from the server's `.env`.
2. The first sign-in shows a QR code. Scan it with an authenticator app and enter the 6-digit
   code.
3. Next come exams, exam templates, the taxonomy tree and the status page (health chips +
   QuestionRenderer demo).

| Command          | What it does                                            |
| ---------------- | ------------------------------------------------------- |
| `pnpm dev`       | web + admin in dev mode (Turbopack)                     |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` everywhere              |
| `pnpm lint`      | eslint (next/core-web-vitals) + `prettier --check .`    |
| `pnpm format`    | prettier write                                          |
| `pnpm test`      | vitest (jsdom for `packages/ui`, `packages/api-client`) |
| `pnpm build`     | `next build` for both apps (needs `API_ORIGIN`)         |

### QuestionRenderer

Always render question content with this component:
`import { QuestionRenderer } from "@mockprep/ui/question-renderer"`.

- It takes Markdown (GFM tables, images) with LaTeX in `$...$` or `$$...$$`.
- It uses marked for Markdown, DOMPurify to sanitise, and KaTeX for the math.
- It renders only on the client, so the page never has hydration mismatches.
- It loads its libraries lazily on first use, so they stay out of every page's initial bundle.
- Write `\$` for a literal dollar sign. Currency such as `$5 and $6` stays plain text.

## Deploy to Vercel

Create **two Vercel projects** from this same repo, one per app.

1. On Vercel, click **Add New → Project** and import `test-admin-client`.
2. Set **Root Directory** to `apps/web`. The framework preset is detected as Next.js. Vercel detects
   pnpm from the lockfile and installs from the repo root. Leave the install and build commands as
   they are.
3. Add the environment variables below for Production and Preview.
4. Deploy. Then repeat steps 1 to 4 with **Root Directory** `apps/admin` for the admin project.
5. Open `/status` on both deployments. All three chips should be green.

| Variable                       | web | admin | Value                                                                                         |
| ------------------------------ | :-: | :---: | --------------------------------------------------------------------------------------------- |
| `API_ORIGIN`                   |  ✓  |   ✓   | Render api URL, e.g. `https://mockprep-api.onrender.com`, with no trailing slash. Server-only |
| `NEXT_PUBLIC_SITE_URL`         |  ✓  |       | public URL of the student site (canonical links, JSON-LD)                                     |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |  ✓  |       | optional: Google OAuth web client id. It must also be in the api's `GOOGLE_CLIENT_IDS`        |

`API_ORIGIN` is read at build time for the rewrites, so redeploy after you change it. The build
fails with a clear message if it is missing. Nothing secret may ever go in a `NEXT_PUBLIC_*`
variable.

**Google sign-in (optional).**

1. In Google Cloud Console, go to **APIs & Services → Credentials → Create OAuth client ID** and
   pick **Web application**.
2. Add your student-site URL (and `http://localhost:3000`) as an **Authorised JavaScript origin**.
3. Put the client id in `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web) and in `GOOGLE_CLIENT_IDS` (api).

No `vercel.json` is needed. `@mockprep/types` comes from a public release URL, so installs need no
npm token.

## CI

`.github/workflows/ci.yml` runs on every PR and every push: install, typecheck, lint, test,
build.
