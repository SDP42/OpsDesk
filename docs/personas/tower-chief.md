# Tower Chief (escalation manager)

| Role in RBAC | Demo sign-in | Home screen |
| --- | --- | --- |
| `escalation_manager` | `rahul.kapoor@opsdesk.demo` | `/tower/escalations` |

**What they need:** direct escalations, sorted by the guest's check-in and LCD.

## A day in OpsDesk

1. Escalations arrive in under a second over server-sent events, each with the agent's reason.
2. The queue is sorted by check-in, so the guest landing soonest comes first.
3. Accepts, reassigns or resolves.
4. When a **Storm Cell** forms, sends one approved broadcast to every affected agency.
5. At shift end, reviews the **Follow-the-Sun** plan before urgent work moves region.

## Features they use

- Escalations queue
- Storm Cells and broadcast
- Follow-the-Sun handoffs with briefs
- Wall Mode on the floor TV

## Tip

Broadcast from the Storm Cell rather than replying ticket by ticket: every linked flight gets the same answer and a timeline entry.

[← All personas](README.md)
