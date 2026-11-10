# Roadmap

## Phase 0 — repository foundation
- [x] Repository baseline and technical principles.
- [x] PostgreSQL models for accounts, profiles, wallets, organizations, admin staff, audit and bans.
- [x] Seed the 11 agreed official organizations with 11 ranks each.
- [x] Initial registration/login and organization catalogue APIs.
- [x] Server-side admin permission boundary and initial tests.
- [x] Economy ledger primitive and conservative anti-cheat ban service.
- [x] Initial server-authoritative movement integrator with input validation and unit tests.\n- [x] In-memory world session registry with capacity, join/leave and server-state snapshot tests.
- [ ] Run CI, Prisma validation, typecheck and tests; fix every reported issue.

## Phase 1 — accounts and operations
- [ ] Email verification, password reset, privileged MFA, session revocation and login throttling.
- [ ] Secure owner bootstrap that cannot be claimed by a player.
- [ ] Owner/developer dashboard, admin panel, leader panel and audit search.
- [ ] Player reports, moderation cases, ban appeals and evidence review.
- [ ] Organization interviews, hiring/firing, rank changes, salaries, duty, fleet, storage and history.

## Phase 2 — game services
- [ ] Authoritative player sessions and realtime transport (movement integrator exists; socket transport and room lifecycle remain).
- [ ] Movement, vehicle, combat, inventory and interaction validation.
- [ ] Bank, jobs, businesses, properties, families and criminal factions.
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