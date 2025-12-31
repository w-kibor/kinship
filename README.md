## Kinship — Emergency Contact Mesh (PWA)

Low-bandwidth “I’m safe” heartbeat for a Circle of 5, with offline-first sync, last-known location, and SMS fallback stubs.

### Getting started

```bash
npm install
npm run dev
# visit http://localhost:3000
```

### Env vars
Copy `.env.local.example` to `.env.local` and fill in real values:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — for backend jobs (not used in the mock API yet)
- `TWILIO_*`, `KINSHIP_SMS_*` — for SMS webhook glue (not wired yet in this stub)

### What’s implemented
- Next.js 16 (App Router) + TypeScript + Tailwind v4
- TanStack Query with offline-first mutations and localStorage persistence
- Service worker (`public/sw.js`) caching shell/assets, queueing failed status POSTs, and flushing on `sync`/online
- Mock API at `/api/status` with in-memory circle-of-5 state for local prototyping
- PWA manifest + installable shell; manifest uses SVG placeholder icons

### Operational notes
- When offline, “I am safe”/“I need help” is queued by the service worker and resent once connectivity returns.
- Location grab uses `navigator.geolocation` with a 4s timeout; fails gracefully if denied/unavailable.
- Battery level is best-effort via `navigator.getBattery` where supported.

### Next steps
- Wire Supabase tables (profiles/circles/statuses) + RLS, replace mock API route with Supabase edge function.
- Add Twilio webhook to accept `SAFE <PIN> <LAT,LNG>` SMS and insert status.
- Replace manifest icons with real 192/512 PNGs; tune caching strategy.
