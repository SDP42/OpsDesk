# Engine reference

The engines in `apps/api/app/engines` are **pure**: no database and no HTTP. Typed Pydantic inputs go in, typed outputs come out,
and every output carries a human-readable reason (the Why button). The service layer loads data, calls an engine and stores the result.

| Engine | One line |
| --- | --- |
| [Vectoring](vectoring.md) | Routes each flight to a controller with a point-by-point reason |
| [Wheels-Up SLA](wheels-up.md) | Deadlines that tighten as the guest's check-in nears |
| [Linker](linker.md) | Connects related cases and runs the Third-Contact Guardian |
| [Intent](intent.md) | TF-IDF + MiniLM ensemble that suggests the problem type |
| [Intent taxonomy](intent-taxonomy.md) | 10 parents, 25 sub-intents and the generated training corpus |
| [Lifecycle](lifecycle.md) | The status state machine |
| [Weather Radar](weather.md) | Weekly themes and emerging spikes |
| [Ghost Flights](ghosts.md) | Predicts which bookings will become tickets |
| [Storm Cells](storms.md) | Groups bursts of related tickets into one incident |
| [Breach Forecast](forecast.md) | Monte Carlo breach odds per action |
| [Frustration Radar](frustration.md) | Agency mood from message text |
| [Promise Tracker](promises.md) | Commitments extracted from replies |
| [Crew Roster](roster.md) | HR-aware availability and orphan risk |
| [Routing simulator](simulator.md) | Replays a day under each routing preset |
| [Ask the Tower](nlq.md) | Plain-English queries into filter chips |
| [Tower Radio](assistant.md) | Persona-aware voice and text assistant |
| [Co-pilot Brief](copilot.md) | One-click, traceable case summary |
| [Follow-the-Sun](follow-the-sun.md) | Holiday-aware regional handoffs |

Models, licences and measured accuracy are in [`docs/MODELS.md`](../MODELS.md).
