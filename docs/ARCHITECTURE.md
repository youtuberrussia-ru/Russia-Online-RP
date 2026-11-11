# Technical architecture

## Product direction
RUSSIA ONLINE RP is an original mobile open-world role-play game. Genre conventions may be familiar, but map, visual identity, code, interface, missions, writing and assets must be independently created.

## Target architecture
- Android game client: planned Unity 3D client, optimized for low/mid-range devices. The client is presentation and input only.
- Authoritative game services own player state, movement validation, combat outcomes, vehicles, inventory, organizations and economy. The first server-side movement integrator and in-memory world session manager exist in `server/src/world/`; they are covered by unit tests but are not yet connected to realtime sockets, persistent multi-instance room state or collision geometry.
- API: TypeScript/Fastify service in server/.
- Database: PostgreSQL through Prisma. Currency uses integer BigInt units, never floating point.
- Separate owner/developer, admin and organization-leader experiences.
- Community: website, forum/community, wiki, status page, Telegram news/support/bot. Discord is excluded.

## Security boundaries
1. Passwords use Argon2id hashes; never store or log plaintext passwords.
2. Short-lived sessions; privileged access must add MFA before production.
3. Every privileged action is checked server-side.
4. Only the configured owner can appoint/remove server-admin positions or change owner-level settings.
5. GA/ZGA have broad operational permissions but cannot appoint staff or change owner access.
6. Admin actions require a reason and create an audit record.
7. Economy changes are server-side ledger entries with idempotency keys; negative balances are rejected.
8. Permanent cheat bans require multiple independent corroborated server-side signals. Suspicion alone is not enough; appeals and owner review are launch requirements.
9. DDoS mitigation needs hosting/network provider filtering plus CDN/WAF. Application code alone cannot stop volumetric attacks.

## Current implementation boundary
This is a backend foundation, not a playable multiplayer game. It currently provides registration/login, database models, 11 organization/rank seed data, initial admin checks, economy ledger primitive, and a conservative anti-cheat ban service. Realtime world simulation, Android 3D client, MFA/email verification, appeals, vehicle purchasing and ownership persistence now have an initial API foundation; spawning, parking, driving physics, garages, properties, inventory and deployment remain later milestones.