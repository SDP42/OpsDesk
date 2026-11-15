"""Weather Radar (basic): top themes this week, week-over-week change, samples."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.rbac import Principal, require_roles
from app.db.base import utcnow
from app.db.models import Theme, Ticket, TicketTheme
from app.db.session import get_session
from app.engines.weather import ThemeObservation, aggregate_week, is_emerging, iso_week
from app.schemas.common import Envelope, StrictModel
from app.schemas.misc import InsightsOut, ThemeSample, ThemeWeekOut
from app.services.audit import audit

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/themes", response_model=Envelope[InsightsOut])
async def themes(
    week: str | None = Query(default=None, pattern=r"^\d{4}-W\d{2}$"),
    _: Principal = Depends(require_roles("agent", "lead")),
    session: AsyncSession = Depends(get_session),
) -> Envelope[InsightsOut]:
    target = week or iso_week(utcnow())
    year, wk = int(target[:4]), int(target[6:])
    week_start = datetime.fromisocalendar(year, wk, 1).replace(tzinfo=utcnow().tzinfo)
    since = week_start - timedelta(weeks=7)
    until = week_start + timedelta(weeks=1)
    rows = (
        await session.execute(
            select(Theme.code, Ticket.id, Ticket.agency_id, Ticket.created_at)
            .join(TicketTheme, TicketTheme.theme_id == Theme.id)
            .join(Ticket, Ticket.id == TicketTheme.ticket_id)
            .where(Ticket.created_at >= since, Ticket.created_at < until)
        )
    ).all()
    observations = [
        ThemeObservation(theme=c, ticket_id=t, agency_id=a, created_at=at) for c, t, a, at in rows
    ]
    weeks = aggregate_week(observations, target)
    theme_rows = {t.code: t for t in (await session.scalars(select(Theme))).all()}
    sample_ids = {sid for w in weeks for sid in w.sample_ticket_ids}
    samples = (
        {
            t.id: t
            for t in (await session.scalars(select(Ticket).where(Ticket.id.in_(sample_ids)))).all()
        }
        if sample_ids
        else {}
    )
    total = len({o.ticket_id for o in observations if iso_week(o.created_at) == target})
    out = [
        ThemeWeekOut(
            **w.model_dump(exclude={"sample_ticket_ids"}),
            product_link=theme_rows[w.theme].product_link if w.theme in theme_rows else None,
            samples=[
                ThemeSample(id=s.id, number=s.number, title=s.title)
                for sid in w.sample_ticket_ids
                if (s := samples.get(sid))
            ],
        )
        for w in weeks
    ]
    return Envelope(data=InsightsOut(week=target, total_tickets=total, themes=out))


class HeatmapOut(BaseModel):
    weeks: list[str]
    themes: list[dict[str, object]]  # {code, label, product_link, counts: [int], total, emerging}


@router.get("/heatmap", response_model=Envelope[HeatmapOut])
async def heatmap(
    weeks: int = Query(default=8, ge=2, le=26),
    principal: Principal = Depends(require_roles("agent", "lead")),
    session: AsyncSession = Depends(get_session),
) -> Envelope[HeatmapOut]:
    """Theme counts per ISO week for the Weather Radar heat map (oldest week first)."""
    now = utcnow()
    labels = [iso_week(now - timedelta(weeks=i)) for i in range(weeks - 1, -1, -1)]
    since = now - timedelta(weeks=weeks)
    rows = (
        await session.execute(
            select(Theme.code, Ticket.created_at)
            .join(TicketTheme, TicketTheme.theme_id == Theme.id)
            .join(Ticket, Ticket.id == TicketTheme.ticket_id)
            .where(Ticket.created_at >= since, Ticket.is_demo.is_(principal.data_mode == "demo"))
        )
    ).all()
    grid: dict[str, dict[str, int]] = {}
    for code, at in rows:
        grid.setdefault(code, {}).setdefault(iso_week(at), 0)
        grid[code][iso_week(at)] += 1
    themes = {t.code: t for t in (await session.scalars(select(Theme))).all()}
    out = []
    for code, t in themes.items():
        counts = [grid.get(code, {}).get(w, 0) for w in labels]
        out.append(
            {
                "code": code,
                "label": t.label,
                "product_link": t.product_link,
                "counts": counts,
                "total": sum(counts),
                "emerging": is_emerging(counts[-1], counts[:-1]),
            }
        )
    out.sort(key=lambda d: -sum(d["counts"]))  # type: ignore[arg-type]
    return Envelope(data=HeatmapOut(weeks=labels, themes=out))


class ProductLinkIn(StrictModel):
    product_link: str = Field(max_length=300)


@router.patch("/themes/{code}", response_model=Envelope[dict[str, str]])
async def set_product_link(
    code: str,
    body: ProductLinkIn,
    principal: Principal = Depends(require_roles("lead")),
    session: AsyncSession = Depends(get_session),
) -> Envelope[dict[str, str]]:
    """Attach a suggested product link or bug key to a theme (closes the feedback loop)."""
    theme = await session.scalar(select(Theme).where(Theme.code == code))
    if theme is None:
        raise not_found("Theme")
    theme.product_link = body.product_link or None
    audit(session, principal, "theme.product_link", "theme", theme.id, {"link": body.product_link})
    await session.commit()
    return Envelope(data={"code": code, "product_link": body.product_link})
