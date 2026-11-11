# API reference — current foundation

Base URL in local development: `http://localhost:3000`. Protected endpoints require `Authorization: Bearer <token>`. Tokens are short-lived. This document describes implemented foundation endpoints, not a promise that the complete game backend is finished.

## Health
- `GET /health` — API process health only; does not prove database or game-world health.

## Authentication
- `POST /v1/auth/register` — body: `{ "email", "password", "nickname" }`.
- `POST /v1/auth/login` — body: `{ "email", "password" }`; currently limited to 5 attempts per IP per 15 minutes.
- Registration is currently limited to 3 attempts per IP per hour. These are IP-level safeguards, not a substitute for per-account risk controls.
- Email verification, password reset, MFA, session listing/revocation and email delivery are not implemented yet. Do not expose this API publicly until those launch requirements and abuse controls are complete.

## Player
- `GET /v1/player/me` — authenticated account, profile, active organization memberships and wallet balance.
- `POST /v1/player/reports` — authenticated report. Body: `{ "category": "PLAYER|BUG|CHEATING|OTHER", "description": "...", "targetId": "optional" }`.
- `POST /v1/player/organizations/applications` — authenticated application. Body: `{ "organizationCode": "...", "answers": { "question": "answer" } }`.
- `GET /v1/player/vehicles` — authenticated player garage; returns vehicles owned by the current profile.\n- `POST /v1/player/vehicles/purchase` — authenticated purchase; body: `{ "vehicleCode": "sedan_01", "requestId": "<UUID>" }`. Purchase, wallet debit, ledger entry and vehicle ownership are committed atomically. Repeating the same request ID returns the original vehicle without charging again.\n- `POST /v1/player/daily-rewards/claim` — authenticated daily reward claim. Server determines the UTC day and reward; duplicate same-day claims are blocked.
- `POST /v1/player/ban-appeals` — authenticated appeal for an active ban; one pending appeal per ban. A banned account receives a short-lived, appeal-only token from login and cannot use it for normal player, leader or admin endpoints.

## Game catalogue
- `GET /v1/game/organizations` — public catalogue of the 11 official organizations and configured ranks.\n- `GET /v1/game/vehicles` — public server-owned starter vehicle catalogue and prices.

## World session prototype
- `POST /v1/world/join` — join this API process's in-memory world session; spawn is server-selected.
- `POST /v1/world/input` — submit sequenced movement axes only (`sequence`, `forward`, `strafe`, `turn`). Position, velocity, elapsed time and sprint state are never accepted from the client; elapsed time is derived from server timestamps.
- `GET /v1/world/snapshot` — current process-local player snapshots.
- `POST /v1/world/leave` — leave the process-local session.
- Important: this is an authenticated HTTP prototype, not realtime multiplayer. Sessions are lost on restart, state is not shared between instances, and collision/vehicle/combat systems plus WebSocket transport are not implemented.

## Organization leader
- `GET /v1/org-leader/:code/applications` — pending applications; requires active rank 10 or 11 membership in that organization.
- `POST /v1/org-leader/:code/applications/:id/review` — body: `{ "decision": "ACCEPT|REJECT", "note": "..." }`; requires active rank 10 or 11 membership.

## Admin
- `GET /v1/admin/me` — current admin/owner identity.
- `GET /v1/admin/overview` — initial operational summary.
- `GET /v1/admin/staff` — permission-gated active staff directory.
- `GET /v1/admin/players?q=nickname-or-email&take=30` — permission-gated player search.
- `POST /v1/admin/staff/appoint` — owner only; body: `{ "userId", "role", "reason" }`.
- `POST /v1/admin/staff/revoke` — owner only; body: `{ "userId", "reason" }`.
- `GET /v1/admin/reports?status=OPEN` — permission-gated report queue.
- `PATCH /v1/admin/reports/:id` — permission-gated review; body: `{ "status": "IN_REVIEW|RESOLVED|REJECTED", "resolution": "..." }`.
- `GET /v1/admin/ban-appeals` — security-review permission queue.
- `PATCH /v1/admin/ban-appeals/:id` — approve or deny an appeal; approval revokes the related active ban and writes an audit entry.

## Security notes
- The current JWT setup is a development foundation. Add MFA for privileged accounts, verified email, refresh-token rotation/revocation, account recovery and production secret management before launch.
- Rate limiting currently exists at API level; per-route and per-account policies still need tuning.
- Anti-cheat ban service is not connected to a live game simulation. It must receive corroborated server-side evidence only.
- DDoS mitigation requires provider/network-level protection and CDN/WAF; API code alone is insufficient.
- Do not expose admin or owner endpoints to public traffic until a full security review is complete.
