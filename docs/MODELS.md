# OpsDesk model card

Every model in OpsDesk is free, open source and runs on a laptop CPU. None needs a paid API or a GPU.
Each one returns a human-readable reason, and each falls back to a simpler path if unavailable.

| Model | Where | Type | Licence | Trained on | Used for |
| --- | --- | --- | --- | --- | --- |
| **all-MiniLM-L6-v2** (pretrained) | `services/embeddings.py` | 384-d sentence embeddings, ONNX via `fastembed` | Apache-2.0 | Pretrained by sentence-transformers (1B+ sentence pairs) | Meaning-level ticket linking; intent ensemble head |
| **VADER** (pretrained) | `engines/frustration.py` | Rule-based sentiment lexicon | MIT | Human-rated sentiment lexicon | Frustration Radar |
| Intent TF-IDF + logistic regression | `engines/intent.py` | Word 1-2-gram + char 3-5-gram TF-IDF → multinomial LR | (ours) | 1,600 generated, labelled ticket texts | Intent suggestion |
| Intent MiniLM head | `engines/intent.py` | Logistic regression on MiniLM embeddings (C=2000) | (ours) | Same corpus, embedded | Ensemble with TF-IDF (weight 0.7) |
| Ghost Flights risk scorer | `engines/ghosts.py` | GradientBoostingClassifier (120 trees, depth 3) | (ours) | 4,000 synthetic labelled bookings | Predicting which bookings become tickets |
| Breach Forecast | `engines/forecast.py` | Log-normal Monte Carlo (NumPy, 4,000 runs) | (ours) | Historical resolution times per intent | Breach probability per action |
| Storm Cells | `engines/storms.py` | Sliding-window clustering + networkx merge | (ours) | n/a | Incident detection |

## Measured accuracy

| Check | Result |
| --- | --- |
| Intent, generated held-out set (500 texts) | ≥ 85% (test-enforced), typically ~99% |
| Intent, **hand-written phrasings** unlike the templates (`HARD_EVAL`, 25 texts) | **TF-IDF 76% → TF-IDF + MiniLM 88%**, mean top confidence 0.75 |
| Semantic linking | MiniLM cosine 0.59 for two refund paraphrases with almost no shared words vs 0.2 for an unrelated case (TF-IDF ≈ 0 for both) |
| Ghost Flights | Unconfirmed supplier + 36 h to check-in + slow supplier scores > 0.5; a healthy booking far out scores < 0.5 (test-enforced) |

`make seed` retrains the intent models and prints the hand-written accuracy every time.

## Explainability

* **Linker:** "Same meaning (MiniLM cosine 0.62)" or "Similar wording (TF-IDF cosine 0.41)".
* **Intent:** "TF-IDF + MiniLM ensemble: model says Refund > Delay at 81%"; below 55% the UI says *needs a human*.
* **Ghosts:** top drivers by feature ablation, e.g. "supplier has not confirmed (+38%)".
* **Frustration:** the signals that fired, e.g. "third time", "negative sentiment (VADER −0.65)".

## Operating notes

* The MiniLM model (~90 MB) downloads once into `apps/api/data/models/` (gitignored) on the first `make seed`.
* Set `EMBEDDINGS_ENABLED=false` to run fully offline. Linking and intent then use TF-IDF only.
* Tests run with embeddings disabled for determinism. The ensemble test runs only when the model is cached.
* All training data is synthetic or generated. No customer data is used to train anything.
