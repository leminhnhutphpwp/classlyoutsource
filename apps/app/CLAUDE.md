# CLAUDE.md — apps/app (Next.js 15)

Classly's main app (with login). React 19 + App Router. It is a **BFF**: the route handlers under
`src/app/api/*` run server-side and call Laravel using `BACKEND_URL`. The browser only makes
same-origin calls → no CORS, and tokens are attached server-side.

## Run

```bash
cp .env.example .env.local     # if missing
npm install
npm run dev                    # http://localhost:3000
```

Requires the backend running at `http://localhost:8000` (see `apps/api`).

## Environment (one switch to the backend)

- `BACKEND_URL` — **server-side**, used by the route handlers / BFF (`src/lib/api-route-helper.ts`,
  `src/app/api/auth/refresh/route.ts`). This is the primary switch variable.
- `API_BASE_URL` — used for the CSP `connect-src` in `next.config.mjs`.
- `NEXT_PUBLIC_*` — client-side (site URL, version, debug flag). Baked in at build time.

Only `.env.example` is committed; `.env.local` holds dev config (gitignored).

## Data flow

```
browser ──(same-origin /api/*)──▶ Next route handler (server) ──(BACKEND_URL)──▶ Laravel /api/v1
```

- `src/lib/api-client.ts`: `baseURL = API_CONFIG.BASE_URL || ''` → empty means call the Next route directly.
- Tokens live in HttpOnly cookies (set by the BFF), with an `Authorization: Bearer` header fallback.
- Token refresh goes through `src/app/api/auth/refresh/route.ts`.
- `src/lib/api-route-helper.ts` `handleBackendRequest(request, method, endpoint, opts)` is the single
  path the BFF uses to reach Laravel — new backend calls should go through it, not raw `fetch`.

## Build / Docker

- `output: 'standalone'` in `next.config.mjs` → lean Docker image (`.next/standalone`).
- ESLint is skipped during builds (`eslint.ignoreDuringBuilds`). Run `npm run lint` manually.
- CSP whitelists Zalo domains + `API_BASE_URL`; edit `next.config.mjs` when adding an external origin.

## Rules

- Never hardcode the Laravel URL in a client component — always go through a route handler (BFF).
- Keep secrets out of `NEXT_PUBLIC_*` (those ship to the browser).

