# Security

## Reporting a vulnerability

Please open a private security advisory on GitHub rather than a public issue. Include steps to reproduce and the affected endpoint or screen.

## What OpsDesk does today

- Passwords hashed with argon2; sessions are JWTs in httpOnly cookies, served same-origin through the Next.js proxy.
- Login rate limiting per IP and email.
- Role-based access control in one module (`apps/api/app/core/rbac.py`); cross-agency reads return 404 so IDs do not leak.
- Strict request validation: unknown fields are rejected.
- Security headers set by the edge server.
- An `audit_log` row for every change.
- No secrets in the repository; demo credentials exist only in local `.env` files and the seed script.

## Out of scope for the prototype

Multi-tenant isolation at the database level, SSO, and secret rotation are on the roadmap.
