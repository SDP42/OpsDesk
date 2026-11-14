"""Weather Radar (basic): top themes this week, week-over-week change, samples."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import Principal, require_roles
from app.db.base import utcnow
from app.db.models import Theme, Ticket, TicketTheme
from app.db.session import get_session
from app.engines.weather import ThemeObservation, aggregate_week, iso_week
from app.schemas.common import Envelope
from app.schemas.misc import InsightsOut, ThemeSample, ThemeWeekOut

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/themes", response_model=Envelope[InsightsOut])
async def themes(week: str | None = Query(default=None, pattern=r"^\d{4}-W\d{2}$"),
                 _: Principal = Depends(require_roles("agent", "lead")),
                 session: AsyncSession = Depends(get_session)) -> Envelope[InsightsOut]:
    target = week or iso_week(utcnow())
    year, wk = int(target[:4]), int(target[6:])
    week_start = datetime.fromisocalendar(year, wk, 1).replace(tzinfo=utcnow().tzinfo)
    since = week_start - timedelta(weeks=7)
    until = week_start + timedelta(weeks=1)
    rows = (await session.execute(
        select(Theme.code, Ticket.id, Ticket.agency_id, Ticket.created_at)
        .join(TicketTheme, TicketTheme.theme_id == Theme.id)
        .join(Ticket, Ticket.id == TicketTheme.ticket_id)
        .where(Ticket.created_at >= since, Ticket.created_at < until)
    )).all()
    observations = [ThemeObservation(theme=c, ticket_id=t, agency_id=a, created_at=at)
                    for c, t, a, at in rows]
    weeks = aggregate_week(observations, target)
    theme_rows = {t.code: t for t in (await session.scalars(select(Theme))).all()}
    sample_ids = {sid for w in weeks for sid in w.sample_ticket_ids}
    samples = {t.id: t for t in (await session.scalars(
        select(Ticket).where(Ticket.id.in_(sample_ids)))).all()} if sample_ids else {}
    total = len({o.ticket_id for o in observations if iso_week(o.created_at) == target})
    out = [
        ThemeWeekOut(**w.model_dump(exclude={"sample_ticket_ids"}),
                     product_link=theme_rows[w.theme].product_link if w.theme in theme_rows else None,
                     samples=[ThemeSample(id=s.id, number=s.number, title=s.title)
                              for sid in w.sample_ticket_ids if (s := samples.get(sid))])
        for w in weeks
    ]
    return Envelope(data=InsightsOut(week=target, total_tickets=total, themes=out))
