"""Tower Radio: a persona-aware assistant that answers in plain English.

Pure, deterministic parsing (no paid API): the question is mapped to an intent
plus filters using small lexicons, with a reason that explains how it was read.
The service layer executes the plan against the database and composes the reply.
An optional LLM can rephrase answers later via ANTHROPIC_API_KEY.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

REGIONS = {
    "india": "IN",
    "mumbai": "IN",
    "delhi": "IN",
    "goa": "IN",
    "uae": "AE",
    "dubai": "AE",
    "abu dhabi": "AE",
    "emirates": "AE",
    "uk": "UK",
    "london": "UK",
    "britain": "UK",
    "manchester": "UK",
    "edinburgh": "UK",
    "sea": "SEA",
    "singapore": "SEA",
    "asia": "SEA",
    "bangkok": "SEA",
    "malaysia": "SEA",
}
SLA_WORDS = {
    "breach": "breached",
    "breached": "breached",
    "overdue": "breached",
    "late": "breached",
    "critical": "critical",
    "urgent": "critical",
    "at risk": "at_risk",
    "risky": "at_risk",
}
PERSONA_HELP = {
    "requester": [
        "Where is my refund for TBOH-88213?",
        "Show my open flights",
        "How do I file a new flight?",
        "Why was my case linked?",
    ],
    "agent": [
        "What should I work on first?",
        "Show breached flights in UAE",
        "Find OD-24817",
        "How is routing decided?",
    ],
    "escalation_manager": [
        "How many escalations are waiting?",
        "Which escalations check in soonest?",
        "Explain the wheels-up clock",
        "Show critical flights",
    ],
    "lead": [
        "Give me today's tower briefing",
        "Which agencies are most turbulent?",
        "How many flights breached this week?",
        "How do exports scale?",
    ],
    "supplier": [
        "Which channels need my reply?",
        "How fast do we usually respond?",
        "What does locked recipient mean?",
    ],
}

KNOWLEDGE = {
    "routing": "Vectoring scores every controller on region match (40, adjacent 15), priority fit up to 30, "
    "being on shift (15), availability (online 10, busy 4, away excluded), intent skill (10) and "
    "load headroom (up to 12). Presets double one weight. Every decision is stored with a one-line reason.",
    "sla": "The wheels-up clock starts from the priority target (P1 1h, P2 4h, P3 8h, P4 24h) and shrinks as "
    "check-in or LCD nears: within 12 hours it is a quarter of the target. Under 60% elapsed is on course, "
    "60 to 85 is at risk, above 85 is critical, past 100 is breached.",
    "linking": "Flights link automatically: same TBOH at strength 1.0, same agency and intent within 30 days at 0.8, "
    "and similar wording by TF-IDF at 0.5 to 0.7. On the third contact in 14 days the Guardian raises "
    "priority and alerts the Tower Chief.",
    "export": "The Black Box streams CSV or NDJSON with keyset pagination, so memory stays flat and there is no row "
    "cap. The scale path is CDC into Kafka and ClickHouse, with nightly Parquet snapshots.",
    "frequency": "A Frequency is a side conversation with its own recipients. Suppliers and locked recipients stay "
    "when the flight is transferred; a handoff check shows who stays, joins or drops.",
    "file": "Open the Pilot board, press New flight, describe what happened and add your TBOH. The tower suggests "
    "the intent, shows earlier cases on the booking and routes it with a visible reason.",
    "escalate": "Press Escalate (or E) on a flight, give a reason, and it moves to the Tower Chief's queue with a "
    "new owner within a second. The timeline records it.",
    "locked": "A locked recipient cannot be dropped by a transfer. Suppliers are locked by default so the "
    "conversation never breaks when ownership changes.",
}


class AssistantPlan(BaseModel):
    intent: str
    filters: dict[str, str] = Field(default_factory=dict)
    topic: str | None = None
    reason: str


def _region(q: str) -> str | None:
    for word, code in REGIONS.items():
        if re.search(rf"\b{re.escape(word)}\b", q):
            return code
    return None


def _sla(q: str) -> str | None:
    for word, state in SLA_WORDS.items():
        if word in q:
            return state
    return None


def plan(question: str, role: str) -> AssistantPlan:
    """Map a free-text question to an intent and filters, with the reading explained."""
    q = question.lower().strip()
    if not q:
        return AssistantPlan(intent="help", reason="Empty question")

    m = re.search(r"\bod-?\s?(\d{4,6})\b", q)
    if m:
        return AssistantPlan(
            intent="find_ticket",
            filters={"number": f"OD-{m.group(1)}"},
            reason=f"Callsign OD-{m.group(1)} mentioned",
        )
    m = re.search(r"\btboh-?\s?(\d{3,10})\b", q)
    if m:
        return AssistantPlan(
            intent="find_tboh",
            filters={"tboh": f"TBOH-{m.group(1)}"},
            reason=f"Booking TBOH-{m.group(1)} mentioned",
        )

    if re.search(r"\b(hi|hello|hey|good (morning|evening|afternoon))\b", q) and len(q) < 30:
        return AssistantPlan(intent="greeting", reason="Greeting")
    for topic, words in {
        "routing": [
            "routing",
            "routed",
            "vector",
            "assigned to me",
            "why was this assigned",
            "why omar",
            "why not",
        ],
        "sla": ["sla", "wheels-up", "wheels up", "clock", "fuel", "deadline"],
        "linking": ["linked", "linking", "link ", "third contact", "guardian", "constellation"],
        "export": ["export", "scale", "black box", "download", "csv"],
        "frequency": ["frequency", "side conversation", "handoff"],
        "locked": ["locked"],
        "file": ["file a", "new flight", "raise a", "create a", "open a ticket", "how do i file"],
        "escalate": ["how do i escalate", "how to escalate", "escalate a"],
    }.items():
        if any(w in q for w in words) and (
            "how" in q or "why" in q or "what" in q or "explain" in q
        ):
            return AssistantPlan(intent="explain", topic=topic, reason=f"Asked how {topic} works")

    if any(
        w in q
        for w in ["briefing", "summary", "overview", "how are we", "status of the tower", "today"]
    ):
        return AssistantPlan(intent="briefing", reason="Asked for a tower briefing")
    if any(
        w in q
        for w in ["turbulent", "churn", "unhappy", "angry agenc", "at-risk agenc", "agencies"]
    ):
        return AssistantPlan(intent="turbulence", reason="Asked about agency churn risk")
    if role == "supplier":
        return AssistantPlan(intent="supplier_inbox", reason="Supplier asking about their channels")
    if "escalat" in q:
        return AssistantPlan(
            intent="escalations",
            filters={k: v for k, v in {"region": _region(q)}.items() if v},
            reason="Asked about escalations",
        )
    if any(
        w in q
        for w in [
            "work on first",
            "next",
            "priority",
            "my queue",
            "my flights",
            "assigned to me",
            "my open",
        ]
    ):
        return AssistantPlan(intent="my_queue", reason="Asked what to work on")
    if role == "requester" and any(
        w in q for w in ["refund", "where is", "status", "my case", "update"]
    ):
        return AssistantPlan(intent="my_queue", reason="Pilot asking about their flights")

    filters: dict[str, str] = {}
    region, sla = _region(q), _sla(q)
    if region:
        filters["region"] = region
    if sla:
        filters["sla_state"] = sla
    if filters or any(w in q for w in ["show", "list", "how many", "count", "flights", "tickets"]):
        return AssistantPlan(
            intent="search",
            filters=filters,
            reason="Search" + "".join(f" · {k}={v}" for k, v in filters.items()),
        )
    return AssistantPlan(
        intent="help", reason="Could not map the question; offering persona suggestions"
    )
