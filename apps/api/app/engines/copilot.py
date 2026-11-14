"""Co-pilot Brief: one-click case summary from linked history (rule-based, no paid AI).

Summarises what happened, what was promised, what the agency is feeling and the
next best action, each line traceable to an input (the Why button).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class BriefInput(BaseModel):
    number: str
    title: str
    status: str
    priority: str
    intent_label: str | None
    sla_state: str
    hours_to_checkin: float | None
    contact_count: int
    guardian: bool
    linked: list[dict[str, str]]  # number, status, title
    last_external: str | None
    last_internal: str | None
    supplier_last_reply: str | None
    open_frequencies: int
    escalated: bool
    now: datetime


class BriefLine(BaseModel):
    label: str
    text: str
    why: str


class Brief(BaseModel):
    headline: str
    lines: list[BriefLine]
    next_action: str
    reply_draft: str


def build_brief(d: BriefInput) -> Brief:
    lines: list[BriefLine] = []
    open_links = [
        link for link in d.linked if link["status"] in {"new", "open", "pending", "escalated"}
    ]
    if d.linked:
        lines.append(
            BriefLine(
                label="History",
                text=f"{len(d.linked)} linked flights ({len(open_links)} still open): "
                + ", ".join(link["number"] for link in d.linked[:4])
                + ".",
                why="ticket_links on TBOH, agency + intent and text similarity",
            )
        )
    else:
        lines.append(
            BriefLine(
                label="History",
                text="First contact on this booking and intent.",
                why="no ticket_links",
            )
        )
    if d.guardian:
        lines.append(
            BriefLine(
                label="Agency mood",
                text=f"Contact #{d.contact_count} in 14 days: expect frustration, acknowledge the repeats.",
                why="Third-Contact Guardian fired",
            )
        )
    urgency = "no travel date"
    if d.hours_to_checkin is not None:
        urgency = (
            f"guest checks in in {d.hours_to_checkin:.0f}h"
            if d.hours_to_checkin < 72
            else f"check-in in {d.hours_to_checkin / 24:.0f} days"
        )
    lines.append(
        BriefLine(
            label="Clock",
            text=f"{d.sla_state.replace('_', ' ').capitalize()}; {urgency}.",
            why="Wheels-Up SLA engine",
        )
    )
    if d.supplier_last_reply:
        lines.append(
            BriefLine(
                label="Supplier",
                text=f"Last supplier word: “{d.supplier_last_reply[:140]}”",
                why="frequency_messages",
            )
        )
    elif d.open_frequencies:
        lines.append(
            BriefLine(
                label="Supplier",
                text="Supplier has not replied on the open Frequency yet.",
                why="no supplier message",
            )
        )
    if d.last_external:
        lines.append(
            BriefLine(
                label="Last reply to agency",
                text=f"“{d.last_external[:140]}”",
                why="latest external comment",
            )
        )

    if d.escalated:
        action = "Tower Chief owns it: confirm the fix with the supplier and close the loop with the agency."
    elif d.sla_state in {"critical", "breached"} and (d.hours_to_checkin or 999) <= 24:
        action = "Escalate to the Tower Chief now and call the supplier: check-in is within a day."
    elif d.open_frequencies and not d.supplier_last_reply:
        action = "Chase the supplier on the open Frequency, then update the agency with a time-bound promise."
    elif open_links:
        action = f"Merge context from {open_links[0]['number']} and answer both in one reply."
    else:
        action = "Reply to the agency with the status and a clear next update time."

    intent = d.intent_label or "your request"
    sorry = (
        " We know this is not the first time you have had to ask, and we are sorry."
        if d.guardian
        else ""
    )
    reply = (
        f"Hello, thanks for your patience on {d.number} ({intent}).{sorry} "
        f"We are on it now and will update you within the next 2 hours."
    )
    headline = f"{d.number} · {d.priority} · {intent}"
    return Brief(headline=headline, lines=lines, next_action=action, reply_draft=reply)
