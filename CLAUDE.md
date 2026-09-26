# CLAUDE.md — mockprep client (test-admin-client)

Read this at the start of every session. Keep it under 200 lines and up to date.

## 1. Product

mockprep is a mock-test platform for Indian competitive exams. Students take full-length mocks in
an interface identical to the real exam and get score, rank, percentile and solutions.
Core differentiator: an admin uploads a question-paper PDF (+ optional answer key / solutions) and
the system creates a publish-ready test with minimal manual work (review only flagged questions).
Content is bilingual (English + Hindi). Most students are on low-end Android phones on slow networks.

Exam families:

- Banking: SBI PO / Clerk, IBPS PO / Clerk
- SSC: CGL, CHSL
- UPSC Prelims: GS Paper I + CSAT
- Defence: NDA, CDS
- Engineering: JEE Main, JEE Advanced

## 2. Two repos, one system

The product is split across two pnpm + Turborepo monorepos:

| Repo                              | Contains                                               | Hosting |
| --------------------------------- | ------------------------------------------------------ | ------- |
| test-admin-server                 | apps/api, apps/worker, packages/types, packages/config | Render  |
| **test-admin-client** (this repo) | apps/web, apps/admin, packages/ui, packages/config     | Vercel  |

Shared TS types + Zod schemas come from `@mockprep/types`, which is **owned by test-admin-server**
and released as a tarball on a server GitHub Release (`types-v<version>`). `apps/*` and
`packages/ui` depend on that release URL — bump all three together. Never redefine or
copy API types/schemas here — if a type is missing or wrong, change it in the server repo first.
For local cross-repo work, `pnpm link` the server's `packages/types` into this checkout.

## 3. Repo layout (this repo)

```
apps/
  web/        Next.js 15 App Router, TypeScript, Tailwind v4, shadcn/ui — student site
              (catalogue, exam pages, test screen /test/[attemptId], results, purchases)
  admin/      Next.js 15 App Router, same UI stack — admin panel
              (exams + templates, question bank, test builder, PDF upload + review, orders)
packages/
  ui/         @mockprep/ui — shared components (shadcn-based primitives, QuestionRenderer:
              Markdown + KaTeX, sanitised with DOMPurify, client-side only). Ships TS source,
              compiled by Next via transpilePackages. `styles.css` = theme tokens (import after
              tailwindcss in each app's globals.css). QuestionRenderer is imported from
              `@mockprep/ui/question-renderer` (not the barrel) so KaTeX CSS/JS load only where used.
  api-client/ @mockprep/api-client — createApiClient (same-origin fetch, in-memory access token,
              refresh-once-and-retry on 401, refresh serialised across tabs via Web Locks; rawBody for
              files, fetchRaw for downloads), AuthProvider/useAuth, ApiError, errorMessage(), fieldErrors()
  config/     @mockprep/config — shared tsconfig (base, nextjs, react-library), eslint, prettier
web:   app/ (/, /login, /onboarding, /home, /exams, /exams/[slug] ISR 60 s, /status),
       components/, lib/ (env.ts public env, server-api.ts, exams.ts, use-require-student.ts)
admin: app/login, app/(panel)/* behind AdminShell (sidebar + guard): tests (list, new, [id] builder,
       [id]/preview, [id]/review), uploads (list, new, [id] progress), questions (bank, new, [id]
       editor + versions, import, duplicates), exams, templates, taxonomy, status. components/
       (question-editor, question-preview, test-builder, review-screen, forms), lib/ (roles,
       use-api-query, format (snippet, IST helpers), upload (figures + paper files), review)
```

**Api access:** browsers call same-origin `/api/*`; `next.config.ts` rewrites to `API_ORIGIN`
(server-only env) so refresh cookies are first-party. Server Components fetch `API_ORIGIN`
directly (`lib/server-api.ts`). No Next.js API routes — business logic lives in the api.
**Auth:** web uses `/api/auth/*` (cookie `mp_rt`), admin uses `/api/admin/auth/*` (cookie
`mp_art`). Page guards are client-side (`useRequireStudent`, `AdminShell`); the api enforces
roles. Hide write actions with `canEditContent(role)`.

## 4. Commands

Run from repo root (Turborepo fans out to every package):

```
pnpm install          # install all workspaces
pnpm dev              # web + admin in dev mode (needs the server repo's api running)
pnpm typecheck        # next typegen + tsc --noEmit everywhere
pnpm lint             # eslint (next/core-web-vitals) + prettier --check
pnpm test             # vitest (jsdom + Testing Library in packages/ui)
pnpm build            # next build for both apps (needs API_ORIGIN)
pnpm format           # prettier --write .
pnpm --filter @mockprep/web <script>   # run a script in one package
```

Env: copy `apps/*/.env.example` → `.env.local`. web: `API_ORIGIN`, `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_PHONE_LOGIN` (false on the free setup),
`NEXT_PUBLIC_EMAIL_LOGIN` (email codes, default true); admin: `API_ORIGIN`. Adding an env var = `lib/env.ts`
(public vars referenced literally so Next inlines them) + `.env.example` + README table +
`turbo.json` globalEnv (Turbo strips undeclared vars) + CI env.
Ports: web 3000, admin 3001, api 4000.

## 5. Conventions

**TypeScript**

- `strict: true`; no `any` (use `unknown` + narrowing). No `@ts-ignore` without a comment why.
- Request/response shapes and form validation use Zod schemas from `@mockprep/types`.

**API usage**

- API errors arrive as `{ error: string, details?: unknown }`; show `error` to the user, log
  `details`. One shared fetch helper per app handles auth refresh and error parsing.

**Data display**

- Money arrives as integer paise; format to ₹ only at display time. Never do money math in floats.
- Times arrive in UTC; always display in Asia/Kolkata.

**Question content**

- Question text, options, passages and solutions are Markdown with LaTeX in `$...$` / `$$...$$`.
  Always render through `@mockprep/ui` QuestionRenderer (sanitised). Never
  `dangerouslySetInnerHTML` question content anywhere else.

**Exam templates**

- Every exam difference — sections, counts, timers, marking, option count, section switching,
  UI skin (ibps | ssc | upsc | nta | generic) — comes from the exam template sent by the API.
  Never hard-code exam rules or branch on exam names in UI code.

**Student UI**

- Mobile first. The student test screen must work on a 360px-wide Android on slow 3G:
  small JS bundles, no heavy libraries on the test route, touch targets >= 44px.
- The client never has correct answers or solutions before submit; don't build UI that expects them.

**Admin UI**

- Calm, neutral palette with one accent colour. One primary action per screen.
- Question "student view" previews use `components/question-preview.tsx` (QuestionRenderer inside).
- Figures upload via `lib/upload.ts` (presign → PUT with `credentials: "omit"` → store fileUrl).
- Datetime inputs are entered and shown in IST (`toIstInput` / `fromIstInput`), stored as UTC.
- Keyboard-friendly for high-volume work. Review screen: J/K, A–E/1–5, Enter approve & next,
  Ctrl+S, P (PDF). Changing an answer sets `answerSource: "manual"` (clears the AI flag).

**Security**

- No secrets in code. Only `NEXT_PUBLIC_*` vars reach the browser, and they must be non-secret.
  `.env.example` in each app lists every variable with no values.

## 6. Definition of done (every task)

1. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass.
2. New endpoints (server repo) have tests; new UI logic worth testing (e.g. timers, palette state,
   answer sync) has a test here.
3. If structure, commands, env vars or conventions changed → CLAUDE.md updated (both repos if shared).
4. Conventional commit message (`feat(web): ...`, `fix(admin): ...`, `feat(ui): ...`).

## 7. Do not

- Do not add a new library without stating why (and why an existing one doesn't do it).
- Do not substitute any part of the fixed stack (Next.js 15, Tailwind v4, shadcn/ui, pnpm, Turborepo).
- Do not put secrets in code or in `NEXT_PUBLIC_*` variables.
- Do not request, cache or render answers/solutions on the student client before submit.
- Do not hard-code exam patterns; read them from the template.
- Do not copy types or Zod schemas from `@mockprep/types` into this repo.
- Do not build features from later phases. If something later is needed, leave a `TODO(phase N)`.

## 8. Phases

Build order; each phase ends deployable and clickable. Start each in a fresh session in plan mode.

| #   | Phase                                     | Status |
| --- | ----------------------------------------- | ------ |
| 0   | Project context (CLAUDE.md)               | done   |
| 1   | Setup: monorepos, CI/CD, deploys, /health | done   |
| 2   | Auth + exam catalogue + exam templates    | done   |
| 3   | Question bank + test builder              | done   |
| 4   | PDF → test pipeline                       | done   |
| 5   | Test engine                               |        |
| 6   | Results + analysis                        |        |
| 7   | Payments                                  |        |
| 8   | Live tests + notifications                |        |
| 9   | More exams + hardening + launch           |        |

**Current phase: 4 (complete) — next: Phase 5.**

## 9. Change log

- Phase 0: CLAUDE.md created. Decision: two monorepos (server / client), `@mockprep` scope,
  `@mockprep/types` owned and published by test-admin-server.
- Phase 1: web + admin (Next 15.5, Tailwind v4, next-themes toggle, /status with health chips),
  packages/ui (Button, Card, Badge, Input, ThemeProvider/Toggle, ServiceStatus, QuestionRenderer
  with admin demo), CI on every push/PR, Vercel = two projects (root dirs apps/web, apps/admin).
- Phase 2: Next rewrites proxy /api/* (first-party cookies; NEXT_PUBLIC_API_URL → API_ORIGIN),
  packages/api-client, web login (OTP + optional Google) → onboarding → /home, /exams +
  /exams/[slug] (ISR 60 s, metadata, JSON-LD); admin login + forced TOTP setup, sidebar shell,
  exam/template editors (validated live with the shared Zod schemas), taxonomy tree. ui adds
  Label, Textarea, Select (native), Field, Alert, Table. Types pinned to types-v0.2.0.
- Phase 3: admin question bank (filters, search, bulk tag/delete, duplicates), question editor
  (EN/HI tabs, click-to-mark-correct, numeric ranges, taxonomy tags, figure upload, live student
  view), Excel/CSV import with row report, test builder (fill all by rule, per-section fill, bank
  picker, live checks, publish/unpublish, IST scheduling), student-paper preview; web exam page
  shows published test cards (attempts in Phase 5). Types pinned to types-v0.3.0.
- Free-tier setup: `NEXT_PUBLIC_PHONE_LOGIN=false` hides phone OTP (no paid SMS); email-code login
  (Mobile/Email toggle when both on) + Google; Vercel Hobby until launch. Types → types-v0.4.0.
- Phase 4: admin Paper uploads (exam picker, 3 drop zones, AI/text badge), progress page (1.5 s
  poll, steps, log, summary), full-screen review (list + student view/editor + PDF at #page=N,
  approve all answered, publish with confirm-to-force), tests list "to review". Types → v0.5.0.
