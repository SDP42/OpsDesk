"""Admin: run the retention job on demand (Hangar demo)."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.rbac import Principal, require_lead
from app.db.base import utcnow
from app.db.session import get_session
from app.jobs.archive import POLICY, run_archive
from app.schemas.common import Envelope
from app.schemas.misc import ArchiveRunIn, ArchiveRunOut
from app.services.audit import audit

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/archive-run", response_model=Envelope[ArchiveRunOut])
async def archive_run(body: ArchiveRunIn | None = None, principal: Principal = Depends(require_lead),
                      session: AsyncSession = Depends(get_session)) -> Envelope[ArchiveRunOut]:
    days = body.older_than_days if body and body.older_than_days is not None else get_settings().archive_after_days
    now = utcnow()
    moved = await run_archive(session, now, days)
    audit(session, principal, "admin.archive_run", "archive", None, {"moved": moved, "days": days})
    await session.commit()
    return Envelope(data=ArchiveRunOut(archived=moved, cutoff=now - timedelta(days=days), policy=POLICY))
