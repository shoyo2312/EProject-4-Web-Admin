# TikTok Admin Console

Admin dashboard for the `tiktok-backend` microservices monorepo. Separate Next.js app —
no shared bundle or JWT handling with the public client at `../tiktok-cloned`.

Stack: Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · lucide-react · Geist.

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # lint, typecheck, the lib tests and a production build
```

`npm test` runs the tests alone: every `lib/**/__tests__/*.test.mjs`, beside the module it tests,
under Node's built-in test runner. They import the `.ts` modules directly, so they need a Node that strips types on its own
(22.18 or newer).

## Screens

Two data sources behind one interface, switched by `ADMIN_USE_MOCK` (see `.env.example`):
mock (default, no backend needed, no login) or live through api-gateway on `:8080`.
`lib/api/types.ts` mirrors the Java response records 1-1, so pages are identical either way.

| Section | Routes | What it is |
|---|---|---|
| Overview | `/dashboard`, `/analytics` | Platform figures and trends from admin-service and analytics-service |
| Moderation | `/moderation/reports`, `/moderation/review`, `/moderation/actions`, `/moderation/terms` | The report queue and ledger, the videos automatic moderation held for a person, the audit log, and the terms admins add to text moderation's word list or exempt from it |
| Management | `/users`, `/videos`, `/comments` | The directories, each account's and video's own page, and one video's comment thread at a time |
| System | `/settings`, `/trash`, `/notifications` | The classifiers' thresholds (frames and text), videos their owners deleted, and the bell's whole feed |

`/system/queues` is marked `SOON` in the sidebar and renders a page listing the backend gap
that blocks it.

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
make run-chat       # :8088 — live updates; without it pages refresh only on navigation
```

Services must be started via `make`; launched another way they miss `JWT_SECRET` and
401 at the gateway. Sign in at `/login` with an account whose role is `ADMIN` —
anything else is rejected by this app before a session cookie is issued.

Live updates reach the browser through `/api/live`, which relays chat-service's socket using
Node's built-in `WebSocket`, so they need Node 22 or newer.

Session handling: `POST /api/session` calls auth-service through the gateway, checks
`role === "ADMIN"` via `/api/v1/auth/me`, then stores the access and refresh tokens in
httpOnly cookies. No token is ever readable by client JavaScript; every API call runs
server-side. `DELETE /api/session` revokes the refresh token and clears the cookies.

Set `ADMIN_TRUST_PROXY=true` only when a proxy in front of this app overwrites
`X-Forwarded-For`. The sign-in and password-reset routes then relay it, so auth-service's
security log records the admin's own address. Left unset, they do not relay it, because a
caller could otherwise set the header themselves and get past the gateway's per-IP limit.

Every moderation action admin-service publishes has a consumer: video-service
(takedown/restore/purge), auth-service (ban/unban, signing an account out),
interaction-service (comment removal) and notification-service (warnings, which reach the
account, the video's owner or the comment's author). `DISMISS_REPORT` is recorded and never
published, so the Audit Log marks it "Recorded only".

## Design notes

Dark rail beside a light workspace (dark theme from the topbar toggle, stored in the `admin_theme` cookie): rounded cards with a hairline border and a soft shadow, one indigo accent for anything selected or primary, status colours as dot pills. Tokens live in `app/globals.css`.
Colour is reserved for status — green resolved, amber pending, grey dismissed, red
destructive.

Mock data uses a seeded PRNG and a fixed clock (`lib/mock/random.ts`) so server and
client renders match — `Math.random()` / `Date.now()` would break hydration.

Snowflake ids are parsed as strings (`lib/api/json.ts`). They are Java `Long`s serialized
as bare JSON numbers up to 19 digits, past `Number.MAX_SAFE_INTEGER`; plain `JSON.parse`
rounds them and every subsequent lookup 404s.

Desktop-first. Below `xl` (1280px) the tables move their secondary columns into each row's
expandable detail, so nothing is out of reach on a narrow screen.
