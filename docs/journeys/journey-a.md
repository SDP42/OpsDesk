# Journey A: Context and linkage

**Proves:** Problem 1 · **Persona:** Pilot · **Automated by:** `e2e/journeys/journey-a.spec.ts`

## Steps

1. Sign in as the Pilot.
2. File "Refund for TBOH-88213 still not received".
3. Intent suggests *Refund > Delay*; the booking panel shows two earlier cases.
4. The new flight links both, fires the **Third-Contact Guardian** and raises priority.
5. The timeline records created, intent, linked, guardian, SLA and routed events.

[← All journeys](README.md)
