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

| Repo | Contains | Hosting |
|---|---|---|
| test-admin-server | apps/api, apps/worker, packages/types, packages/config | Render |
| **test-admin-client** (this repo) | apps/web, apps/admin, packages/ui, packages/config | Vercel |

Shared TS types + Zod schemas come from `@mockprep/types`, which is **owned by test-admin-server**
and published to GitHub Packages. This repo depends on it at a pinned version. Never redefine or
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
              Markdown + KaTeX, sanitised with DOMPurify, client-side only)
  config/     @mockprep/config — shared tsconfig, eslint, prettier, Tailwind preset
```

Both apps read the API base URL from `NEXT_PUBLIC_API_URL`. No Next.js API routes that duplicate
server logic — business logic lives in the api.

## 4. Commands

Run from repo root (Turborepo fans out to every package):

```
pnpm install          # install all workspaces
pnpm dev              # web + admin in dev mode (needs the server repo's api running)
pnpm typecheck        # tsc --noEmit everywhere
pnpm lint             # eslint + prettier --check
pnpm test             # vitest (+ component tests)
pnpm build            # next build for both apps + package builds
pnpm --filter @mockprep/web <script>   # run a script in one package
```

(Commands become real in Phase 1; update this section if any change.)

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
- Keyboard-friendly for high-volume work (review screens get shortcuts).

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

| # | Phase | Status |
|---|---|---|
| 0 | Project context (CLAUDE.md) | done |
| 1 | Setup: monorepos, CI/CD, deploys, /health | |
| 2 | Auth + exam catalogue + exam templates | |
| 3 | Question bank + test builder | |
| 4 | PDF → test pipeline | |
| 5 | Test engine | |
| 6 | Results + analysis | |
| 7 | Payments | |
| 8 | Live tests + notifications | |
| 9 | More exams + hardening + launch | |

**Current phase: 0 (complete) — next: Phase 1.**

## 9. Change log

- Phase 0: CLAUDE.md created. Decision: two monorepos (server / client), `@mockprep` scope,
  `@mockprep/types` owned and published by test-admin-server.
