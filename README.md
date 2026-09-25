# mockprep client

This repo holds the student site and the admin panel for mockprep, a mock-test platform for Indian
competitive exams. The API, worker and shared types are in
[test-admin-server](https://github.com/anmolbisht2308/test-admin-server).

| Package           | What it is                                                              | Deployed to       |
| ----------------- | ----------------------------------------------------------------------- | ----------------- |
| `apps/web`        | Student site (Next.js 15 App Router, Tailwind v4, shadcn/ui), port 3000 | Vercel project #1 |
| `apps/admin`      | Admin panel (same stack), port 3001                                     | Vercel project #2 |
| `packages/ui`     | `@mockprep/ui`: shared components and `QuestionRenderer`                | bundled into apps |
| `packages/config` | Shared tsconfig, eslint and prettier config                             | not deployed      |

`@mockprep/types` (shared types and Zod schemas) is installed from a
[test-admin-server GitHub Release](https://github.com/anmolbisht2308/test-admin-server/releases)
tarball, pinned by version. See the server README for how to release a new version.

## Local development

Requirements: Node 22.12+ and pnpm (`corepack enable`). The api must be running from the server
repo, which provides `http://localhost:4000`.

```bash
# terminal 1: server repo
cd ../test-admin-server && docker compose up -d && pnpm dev

# terminal 2: this repo
corepack enable
pnpm install
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
pnpm dev
```

- Student site: http://localhost:3000. The status page is at http://localhost:3000/status.
- Admin: http://localhost:3001. The status page at http://localhost:3001/status also has the
  QuestionRenderer demo.

Each status page calls `GET /health` and shows API, DB and Redis as green or red chips. The api's
`CORS_ORIGINS` must include both origins. The default `.env.example` in the server repo already
does.

| Command          | What it does                                             |
| ---------------- | -------------------------------------------------------- |
| `pnpm dev`       | web + admin in dev mode (Turbopack)                      |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` everywhere               |
| `pnpm lint`      | eslint (next/core-web-vitals) + `prettier --check .`     |
| `pnpm format`    | prettier write                                           |
| `pnpm test`      | vitest (jsdom for `packages/ui`)                         |
| `pnpm build`     | `next build` for both apps (needs `NEXT_PUBLIC_API_URL`) |

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
3. Add an environment variable for Production and Preview:

| Variable              | web | admin | Value                                                                                |
| --------------------- | :-: | :---: | ------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL` |  ✓  |   ✓   | the Render api URL, e.g. `https://mockprep-api.onrender.com`, with no trailing slash |

4. Deploy. Then repeat steps 1 to 4 with **Root Directory** `apps/admin` for the admin project.
5. Add both Vercel URLs, or your custom domains, to `CORS_ORIGINS` on the Render api, then redeploy
   the api. If you skip this, the status pages show "API unreachable".
6. Open `/status` on both deployments. All three chips should be green.

`NEXT_PUBLIC_API_URL` is baked in at build time, so redeploy after you change it. `lib/env.ts`
validates it, and the build fails if it is missing or not a URL. No other variables are needed yet.
Nothing secret may ever go in a `NEXT_PUBLIC_*` variable.

No `vercel.json` is needed. `@mockprep/types` comes from a public release URL, so installs need no
npm token.

## CI

`.github/workflows/ci.yml` runs on every PR and every push: install, typecheck, lint, test,
build.
