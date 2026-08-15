# TikTok Admin Console

Admin dashboard for the `tiktok-backend` microservices monorepo. Separate Next.js app —
no shared bundle or JWT handling with the public client at `../tiktok-cloned`.

Stack: Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · lucide-react · JetBrains Mono.

```bash
npm install
npm run dev        # http://localhost:3000
```

## Phase 1 scope

Two data sources behind one interface, switched by `ADMIN_USE_MOCK` (see `.env.example`):
mock (default, no backend needed, no login) or live through api-gateway on `:8080`.
`lib/api/types.ts` mirrors the Java response records 1-1, so pages are identical either way.

| Screen | Route | Backing endpoint |
|---|---|---|
| Overview | `/dashboard` | `GET /api/v1/admin/stats/summary`, `GET /api/v1/analytics/{engagement,revenue,signups}/daily` |
| Reports Queue | `/moderation/reports` | `GET /api/v1/admin/reports`, `POST /api/v1/admin/reports/{id}/resolve` |
| Audit Log | `/moderation/actions` | `GET /api/v1/admin/actions` |
| Inventory | `/inventory` | `GET /api/v1/inventory/{productId}`, `POST /api/v1/inventory/{productId}/restock` |

The remaining sidebar entries are marked `SOON` and render a page listing the exact
backend gap that blocks them.

## Running against the real backend

```bash
cp .env.example .env.local        # then set ADMIN_USE_MOCK=false
```

In the backend repo:

```bash
make infra-up
make run-gateway    # :8080 — the only host this app talks to
make run-admin      # :8096
make run-analytics  # :8097
```

Services must be started via `make`; launched another way they miss `JWT_SECRET` and
401 at the gateway. Sign in at `/login` with an account whose role is `ADMIN` —
anything else is rejected by this app before a session cookie is issued.

Session handling: `POST /api/session` calls auth-service through the gateway, checks
`role === "ADMIN"` via `/api/v1/auth/me`, then stores the access and refresh tokens in
httpOnly cookies. No token is ever readable by client JavaScript; every API call runs
server-side. `DELETE /api/session` revokes the refresh token and clears the cookies.

Still mock even in live mode: **Inventory** — inventory-service exposes
`GET /api/v1/inventory/{productId}` only, with no list endpoint to page through.

One backend caveat the UI states itself: **most moderation actions have no consumer.**
Only `TAKEDOWN_VIDEO` / `RESTORE_VIDEO` are consumed (video-service). `BAN_USER`,
`WARN_USER`, `SUSPEND_PRODUCT` and friends are written to `moderation_actions` and
published to `admin.moderation-events` with nothing subscribed, so the action has no
effect. The Audit Log marks these `no consumer`.

## Design notes

Neo-brutalist / monospace: flat surfaces, 1px borders, `#F1F1F1` canvas, no shadows.
Colour is reserved for status — green resolved, amber pending, grey dismissed, red
destructive. Tokens live in `app/globals.css`; light-only by design.

Mock data uses a seeded PRNG and a fixed clock (`lib/mock/random.ts`) so server and
client renders match — `Math.random()` / `Date.now()` would break hydration.

Snowflake ids are parsed as strings (`lib/api/json.ts`). They are Java `Long`s serialized
as bare JSON numbers up to 19 digits, past `Number.MAX_SAFE_INTEGER`; plain `JSON.parse`
rounds them and every subsequent lookup 404s.

Desktop-first (≥1280px). Mobile is out of scope for phase 1.
