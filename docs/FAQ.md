# Frequently asked questions

## Do I need a GPU or a paid AI key?

No. Every model runs on a laptop CPU. The pretrained MiniLM model (about 90 MB) downloads once on the first `make seed`; set `EMBEDDINGS_ENABLED=false` to run fully offline on TF-IDF.

## Why does a ticket say "needs a human" for intent?

The intent ensemble returns its top three guesses with confidence. Below 0.55 the UI does not pretend: it asks a person to pick.

## Why did my flight go to that controller?

Open the flight and press **Why**. Vectoring shows every point it awarded (region, priority, shift, availability, skill, load) and the runners-up.

## Can an agency see another agency's tickets?

No. Requesters are scoped to their own agency in `app/core/rbac.py`; any other agency's ticket returns 404, and a test enforces it.
