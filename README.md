# RUSSIA ONLINE RP

An original Android-first open-world role-play game project. The repository is being built in milestones: secure backend foundation first, then the realtime game services, the Android 3D client and the player community ecosystem.

## Product principles

- Original map, branding, art, interface, writing and gameplay; no copying protected competitor assets.
- One shared launch world and economy, with an architecture that can scale later.
- Server-authoritative player state, movement, combat and economy.
- Optional donations and a separate transparent store are planned; paid items must remain cosmetic or convenience-focused, never pay-to-win.
- Optimized Android client targeting low- and mid-range devices.
- Separate owner/developer, admin and organization-leader permissions.
- Transparent moderation, evidence review and appeals.

## Current repository contents

- TypeScript API built on Fastify.
- PostgreSQL data model managed with Prisma.
- Email/password registration and login foundation (email verification and recovery are not yet implemented).
- Player profile and organization catalogue endpoints.
- 11 agreed official organizations with 11 starting ranks each.
- Organization application submission and leader review foundation.
- Player report submission and admin review workflow.
- Daily login reward claim foundation with server-side date/streak records.
- Owner-only admin appointment and revocation endpoints.
- Permission matrix, audit log, economy ledger primitive and conservative confirmed-cheat ban service.
- GitHub Actions CI for Prisma validation, type checking, tests and build.

## Important status note

This is an active backend foundation, **not yet a playable game or production-ready service**. The Android 3D client, realtime multiplayer simulation, map, characters, vehicles, jobs, properties, chat, full developer/admin/leader web panels, email delivery, MFA, anti-cheat signal collection, production hosting, CDN/WAF and upstream DDoS mitigation remain planned implementation work.

## Local server setup

1. Install Node.js 22 or newer and PostgreSQL.
2. Copy `.env.example` to `.env` and set a strong random `JWT_SECRET`, database URL and allowed CORS origins.
3. Install dependencies with `npm install`.
4. Generate Prisma client with `npm run db:generate`.
5. Validate schema with `npm run db:validate`.
6. Apply a reviewed Prisma migration before running against a database.
7. Seed the agreed organizations with `npm --workspace server run db:seed`.
8. Start the API with `npm --workspace server run dev`.

Do not deploy with example secrets. Do not set `OWNER_USER_ID` until the intended owner account exists and has been independently verified.

## Store preview\n\nA separate static mini-store is published through GitHub Pages. The catalogue is a preview only: checkout and real-money payments remain disabled until an eligible adult account holder completes the required provider, legal, privacy, refund and tax setup.\n\n## Documentation

- `docs/GAME_DESIGN.md` — agreed gameplay and organization baseline.
- `docs/ARCHITECTURE.md` — technical architecture and trust boundaries.
- `docs/ROADMAP.md` — remaining milestones and launch gates.
- `docs/API.md` — current API endpoints.
- `ops/DEPLOYMENT.md` — production infrastructure requirements.
