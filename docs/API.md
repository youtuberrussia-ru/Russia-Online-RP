# API reference — current foundation

Base URL in local development: `http://localhost:3000`. Protected endpoints require `Authorization: Bearer <token>`. Tokens are short-lived. This document describes implemented foundation endpoints, not a promise that the complete game backend is finished.

## Health
- `GET /health` — API process health only; does not prove database or game-world health.

## Authentication
- `POST /v1/auth/register` — body: `{ "email", "password", "nickname" }`.
- `POST /v1/auth/login` — body: `{ "email", "password" }`.
- Email verification, password reset, MFA, session listing/revocation and email delivery are not implemented yet. Do not expose this API publicly until those launch requirements and abuse controls are complete.

## Player
- `GET /v1/player/me` — authenticated account, profile, active organization memberships and wallet balance.
- `POST /v1/player/reports` — authenticated report. Body: `{ "category": "PLAYER|BUG|CHEATING|OTHER", "description": "...", "targetId": "optional" }`.
- `POST /v1/player/organizations/applications` — authenticated application. Body: `{ "organizationCode": "...", "answers": { "question": "answer" } }`.
- `POST /v1/player/daily-rewards/claim` — authenticated daily reward claim. Server determines the UTC day and reward; duplicate same-day claims are blocked.

## Game catalogue
- `GET /v1/game/organizations` — public catalogue of the 11 official organizations and configured ranks.

## Organization leader
- `GET /v1/org-leader/:code/applications` — pending applications; requires active rank 10 or 11 membership in that organization.
- `POST /v1/org-leader/:code/applications/:id/review` — body: `{ "decision": "ACCEPT|REJECT", "note": "..." }`; requires active rank 10 or 11 membership.

## Admin
- `GET /v1/admin/me` — current admin/owner identity.
- `GET /v1/admin/overview` — initial operational summary.
- `POST /v1/admin/staff/appoint` — owner only; body: `{ "userId", "role", "reason" }`.
- `POST /v1/admin/staff/revoke` — owner only; body: `{ "userId", "reason" }`.
- `GET /v1/admin/reports?status=OPEN` — permission-gated report queue.
- `PATCH /v1/admin/reports/:id` — permission-gated review; body: `{ "status": "IN_REVIEW|RESOLVED|REJECTED", "resolution": "..." }`.

## Security notes
- The current JWT setup is a development foundation. Add MFA for privileged accounts, verified email, refresh-token rotation/revocation, account recovery and production secret management before launch.
- Rate limiting currently exists at API level; per-route and per-account policies still need tuning.
- Anti-cheat ban service is not connected to a live game simulation. It must receive corroborated server-side evidence only.
- DDoS mitigation requires provider/network-level protection and CDN/WAF; API code alone is insufficient.
- Do not expose admin or owner endpoints to public traffic until a full security review is complete.
