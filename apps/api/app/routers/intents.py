"""Intent taxonomy and the auto-suggest endpoint."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import Principal, require_any
from app.db.models import Intent
from app.db.session import get_session
from app.schemas.common import Envelope
from app.schemas.misc import IntentCandidateOut, IntentNode, SuggestIn, SuggestOut
from app.services import intents as intent_service

router = APIRouter(prefix="/intents", tags=["intents"])


@router.get("", response_model=Envelope[list[IntentNode]])
async def taxonomy(
    _: Principal = Depends(require_any), session: AsyncSession = Depends(get_session)
) -> Envelope[list[IntentNode]]:
    rows = (await session.scalars(select(Intent).order_by(Intent.code))).all()
    parents = [r for r in rows if r.parent_id is None]
    return Envelope(
        data=[
            IntentNode(
                code=p.code,
                label=p.label,
                children=[
                    IntentNode(code=c.code, label=c.label) for c in rows if c.parent_id == p.id
                ],
            )
            for p in parents
        ]
    )


@router.post("/suggest", response_model=Envelope[SuggestOut])
async def suggest(body: SuggestIn, _: Principal = Depends(require_any)) -> Envelope[SuggestOut]:
    """Top 3 intents with confidence; below 0.55 the UI shows 'needs a human'."""
    result = await asyncio.to_thread(intent_service.suggest, body.text)
    return Envelope(
        data=SuggestOut(
            top=[IntentCandidateOut(**c.model_dump()) for c in result.top],
            needs_human=result.needs_human,
            rule=result.rule,
            reason=result.reason,
        )
    )
