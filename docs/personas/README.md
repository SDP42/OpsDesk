# Personas

The brief names five users. OpsDesk serves each with its own home screen and adds a sixth, the Supplier Partner.
Every persona signs in from the **Choose your callsign** cards on `/login` (demo password from `DEMO_PASSWORD`, used only by the seed).

| Persona | Brief role | Guide |
| --- | --- | --- |
| Pilot | Agency / Requester | [pilot.md](pilot.md) |
| Controller | Ops Agent | [controller.md](controller.md) |
| Tower Chief | Escalation Manager | [tower-chief.md](tower-chief.md) |
| Airport Director | Ops Lead / Governance | [director.md](director.md) |
| Weather desk | Product / Insights | [product.md](product.md) |
| Supplier Partner | our addition | [supplier.md](supplier.md) |

Access rules live in one place, `apps/api/app/core/rbac.py`: requesters see only their own agency (other agencies' flights return 404) and suppliers see only their own channels.
