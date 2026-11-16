# 0004. Server-sent events for real time

**Status:** accepted

## Context

Escalations and new flights must appear in under a second, but the traffic is one-way: server to browser.

## Decision

Server-sent events via `sse-starlette`, passed through the Next.js proxy.

## Consequences

Simpler than WebSockets and works through standard HTTP. Client-to-server actions stay as REST calls.
