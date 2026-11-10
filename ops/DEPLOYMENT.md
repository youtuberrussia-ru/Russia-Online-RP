# Deployment and operations

Production deployment is not wired to an unverified free host. Select a provider with PostgreSQL backups, private networking, TLS, metrics, logs and suitable regional latency.

Required production controls:
- Managed PostgreSQL with encrypted backups and tested restoration.
- TLS everywhere; secrets stored in a provider secret manager, never Git.
- CDN/WAF and upstream DDoS filtering for website/API; game traffic needs provider-level mitigation for the chosen realtime protocol.
- Rate limits, connection quotas, abuse monitoring and alerting.
- Separate staging and production environments.
- Health checks, structured logs, retention policy and incident runbooks.
- No launch until load, security and recovery tests pass.