# Frequently asked questions

## Do I need a GPU or a paid AI key?

No. Every model runs on a laptop CPU. The pretrained MiniLM model (about 90 MB) downloads once on the first `make seed`; set `EMBEDDINGS_ENABLED=false` to run fully offline on TF-IDF.

## Why does a ticket say "needs a human" for intent?

The intent ensemble returns its top three guesses with confidence. Below 0.55 the UI does not pretend: it asks a person to pick.

## Why did my flight go to that controller?

Open the flight and press **Why**. Vectoring shows every point it awarded (region, priority, shift, availability, skill, load) and the runners-up.

## Can an agency see another agency's tickets?

No. Requesters are scoped to their own agency in `app/core/rbac.py`; any other agency's ticket returns 404, and a test enforces it.

## Why is the SLA shorter for some P3 tickets?

Wheels-Up multiplies the base target by an urgency factor from the guest's check-in or LCD: within 12 hours it is a quarter of the normal time.

## Is there really no export limit?

Exports stream with keyset pagination, so there is no 3,000-row cap. `make seed-big` loads 60,000 rows to show it.

## Does OpsDesk work with our HR system?

The Crew Roster reads leave, weekly-off and shift data through a Darwinbox adapter. Without credentials it runs on simulated data, so demos still work.

## Which database does it use?

SQLite in WAL mode by default. Set `DATABASE_URL` to a PostgreSQL URL for production; Alembic migrations cover both.

## How do I reset the demo?

Run `make seed`. Seed data is generated relative to now, so run it shortly before a demo.

## Where are the models and their licences listed?

In [`docs/MODELS.md`](MODELS.md), with measured accuracy.
