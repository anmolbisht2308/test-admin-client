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

1. Go to `/login` and enter any Indian mobile number (or switch to **Email**).
2. In dev, the api prints the code in terminal 1: `DEV OTP for +91…: 123456` for phone, or
   `DEV EMAIL to …: Your mockprep sign-in code is 123456` for email.
3. Enter the code. Onboarding asks for your name, target exams and language, then you land on
   `/home`.
4. Exam pages are at `/exams` and `/exams/<slug>`.

**Admin: http://localhost:3001**

1. Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from the server's `.env`.
2. The first sign-in shows a QR code. Scan it with an authenticator app and enter the 6-digit
   code.
3. The sidebar has:
   - **Tests**: create a test from an exam template, "Fill all sections" by rule, preview as
     student, publish.
   - **Question bank**: search and filter, bulk tag/delete, duplicates, the editor with a live
     student view, and **Import Excel** (download the template, check the file, import).
   - **Paper uploads**: upload a question-paper PDF (+ answer key, solutions) and get a draft
     test. The progress page shows each step. **Review** opens a full-screen screen with the
     flagged questions, a student view you can click to set the answer, an editor and the
     original PDF at the question's page. Keys: `J`/`K` next/previous, `A`–`E` or `1`–`5` set the
     answer, `Enter` approve and next, `Ctrl+S` save, `P` show/hide the PDF. Try it with
     `sbi-paper.pdf` + `sbi-key.pdf` from the server repo's `apps/worker/test/fixtures`. How the
     pipeline works (and the free Gemini key for scanned papers) is in the server README.
   - **Exams**, **Exam templates** and **Taxonomy**.
   - **Status**: health chips and the QuestionRenderer demo.

Published tests show as cards on the student exam page (`/exams/<slug>`) with **Start test**
(or **Resume test**).

**Taking a test** (`/test/start/<testId>` → `/test/<attemptId>` → `/results/<attemptId>`):

- **Instructions come first.** They are built from the test's template, and the clock starts only
  on "I am ready to begin".
- **The screen follows the template's skin** (`ibps`, `ssc`, `nta`, `upsc`, `generic`): timer
  (amber under 5 min, red under 1), section tabs (locked in order for `locked_sequential`), EN/HI
  toggle, passage side by side on wide screens, keypad for numeric answers, and the standard
  palette colours. On phones the palette is a bottom sheet, and you swipe for next/previous.
- **Choosing an option doesn't save it.** Like the real CBT, only **Save & Next** or **Mark for
  Review & Next** does.
- **Answers are kept safe.** They are kept in IndexedDB and sent every 5 s. The badge shows
  Saved / Saving / Offline. A refresh or another device resumes on the same question with the
  server's time.
- **Submitting.** Submit shows a summary per section. At zero the test submits by itself.

**After the test** (`/results/<attemptId>`):

- **The result** leads with score, rank and percentile (first attempts only). Then comes one
  sentence of advice, strong and weak topics, the cut-off check, and charts (Recharts, loaded only
  on this page): sections, you vs topper vs average, a topic heatmap, and time vs accuracy.
- **Solutions** (`…/solutions`) show one question at a time with filters (all / wrong / skipped /
  marked), your answer vs the key, the explanation, and the % of students who got it right. You
  can **Save for revision** or **Report an error**.
- **Re-attempt wrong questions** makes a private practice test. `/revision` is the saved list.
  `/home` shows your tests and the score trend.

**Admin:**

- **Reports** is the queue of students' error reports.
- The question page shows nightly stats.
- A test's page has **Expected cut-offs** and **Change answer key & re-score**. Re-scoring updates
  every attempt and every rank.

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

### Payments

The api decides which provider is used (`PAYMENTS_PROVIDER` in the server repo), and the web
app follows the order it gets back:

- `razorpay`: Razorpay Checkout (`checkout.js`, loaded only when the student clicks Pay). On
  success the app calls `/api/payments/verify`, and the plan unlocks at once. If verify can't get
  through, the app polls the order, because the webhook grants access anyway.
- `fake` (local dev): a "Test payment" panel with three choices: pay, pay and close the browser
  (webhook only), or fail.
- `free` (100 % coupon): nothing to pay.

Paid test cards show "Unlock with a plan" (`/pricing?exam=…`). The start page shows the plans
instead of the instructions. A purchase updates a shared access store, which other tabs also
receive through a BroadcastChannel, so locked mocks open without a reload. `/purchases` lists
each plan with its validity, invoice and credit note PDFs, and the student's referral link
(`/login?ref=CODE`).

Admin: **Orders** (filters, invoice PDFs, refund with a reason), **Revenue** (daily, by plan,
coupons), **Plans**, **Coupons** (plus referral credits) and **Manual access**. Money,
refunds and plans need the superadmin or finance role; support can see orders and grant access.

## Deploy to Vercel

Create **two Vercel projects** from this same repo, one per app. The free **Hobby** plan is fine
while testing. Vercel's Hobby plan is for non-commercial use, so move both projects to **Pro**
before the site starts earning.

1. On Vercel, click **Add New → Project** and import `test-admin-client`.
2. Set **Root Directory** to `apps/web`. The framework preset is detected as Next.js. Vercel detects
   pnpm from the lockfile and installs from the repo root. Leave the install and build commands as
   they are.
3. Add the environment variables below for Production and Preview.
4. Deploy. Then repeat steps 1 to 4 with **Root Directory** `apps/admin` for the admin project.
5. Open `/status` on both deployments. All three chips should be green.

| Variable                       | web | admin | Value                                                                                                                                               |
| ------------------------------ | :-: | :---: | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_ORIGIN`                   |  ✓  |   ✓   | Render api URL, e.g. `https://mockprep-api.onrender.com`, with no trailing slash. Server-only                                                       |
| `NEXT_PUBLIC_SITE_URL`         |  ✓  |       | public URL of the student site (canonical links, JSON-LD)                                                                                           |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |  ✓  |       | Google OAuth web client id; it must also be in the api's `GOOGLE_CLIENT_IDS`. Optional second sign-in method                                        |
| `NEXT_PUBLIC_PHONE_LOGIN`      |  ✓  |       | `false` on the free setup (no SMS), which hides phone OTP and shows only Google sign-in. `true` (default) once MSG91 is configured                  |
| `NEXT_PUBLIC_EMAIL_LOGIN`      |  ✓  |       | `true` (default): students can sign in with a code sent by email (the api sends it via Brevo's free plan). This is the main login on the free setup |

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
