# 0008. Same-origin API proxy and httpOnly cookies

**Status:** accepted

## Context

Storing tokens in browser storage exposes them to scripts; cross-origin calls need CORS setup.

## Decision

The Next.js server proxies `/api` to FastAPI on the same origin, and the JWT lives in an httpOnly cookie.

## Consequences

Tokens are not readable by page scripts. The proxy also passes SSE through and sets security headers.
