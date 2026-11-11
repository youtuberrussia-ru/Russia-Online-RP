# Roadmap

## Phase 0 — repository foundation
- [x] Repository baseline and technical principles.
- [x] PostgreSQL models for accounts, profiles, wallets, organizations, admin staff, audit and bans.
- [x] Seed the 11 agreed official organizations with 11 ranks each.
- [x] Initial registration/login and organization catalogue APIs.
- [x] Server-side admin permission boundary and initial tests.
- [x] Economy ledger primitive and conservative anti-cheat ban service.
- [x] Initial server-authoritative movement integrator with input validation and unit tests.
- [x] In-memory world session registry with capacity, join/leave and server-state snapshot tests.
- [x] Authenticated HTTP world-session prototype with server-selected spawn, sequenced movement inputs and server-derived elapsed time.
- [ ] Replace process-local sessions with shared room state and realtime WebSocket transport; add collision geometry and reconnect handling.
- [ ] Run CI, Prisma validation, typecheck and tests; fix every reported issue.

## Phase 1 — accounts and operations
- [ ] Email verification, password reset, privileged MFA, session revocation and login throttling.
- [ ] Secure owner bootstrap that cannot be claimed by a player.
- [ ] Owner/developer dashboard, admin panel, leader panel and audit search.
- [ ] Player reports, moderation cases, ban appeals and evidence review.
- [x] Organization interview applications, leader review, active roster, audited promotions/demotions and dismissal with rank hierarchy boundaries.
- [ ] Organization salaries, duty, fleet, storage, department operations and complete employment history.

## Phase 2 — game services
- [ ] Authoritative player sessions and realtime transport (movement integrator exists; socket transport and room lifecycle remain).
- [x] Initial vehicle catalogue, player garage persistence and atomic idempotent purchases with wallet ledger integration.
- [ ] Vehicle spawning, parking, garage locations, ownership transfers, fuel, damage and server-authoritative driving.
- [ ] Movement, combat, inventory and interaction validation.
- [x] Initial server-controlled job catalogue, shift lifecycle and wallet-ledger payouts with duration and daily-income caps.
- [x] Player bank accounts, cash deposits/withdrawals, player-to-player transfers and separate idempotent ledgers.
- [ ] Businesses, properties, families and criminal factions.
- [ ] Daily/weekly tasks, achievements and server-controlled login rewards.
- [ ] Events, weather, world clock, leaderboards and in-game phone.

## Phase 3 — Android 3D client
- [ ] Original optimized city map and distinctive art direction.
- [ ] Character creator, animations, vehicles, interiors and UI.
- [ ] Low/medium/high graphics profiles and device testing.
- [ ] Client integration with authoritative services.

## Phase 4 — official ecosystem
- [ ] Website and player account cabinet.
- [ ] Forum/community, rules, suggestions, applications and appeals.
- [ ] Wiki, server status and incident page.
- [ ] Telegram news/support bot and notifications.
- [ ] CDN/WAF, upstream DDoS mitigation, backups, monitoring and incident response.

## Launch gates
No public launch until security review, tested backups/restore, economy exploit testing, moderation appeals, load tests, privacy/legal review and real-device Android performance testing are complete.