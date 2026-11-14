"""Tower Radio assistant: persona-aware answers for the chatbot and voice radio."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import Principal, require_any
from app.db.session import get_session
from app.engines.assistant import PERSONA_HELP
from app.schemas.common import Envelope, StrictModel
from app.services.assistant import AssistantAnswer, answer
from app.services.audit import audit

router = APIRouter(prefix="/assistant", tags=["assistant"])


class AskIn(StrictModel):
    question: str = Field(min_length=1, max_length=500)
    channel: str = Field(default="text", pattern="^(text|voice)$")


@router.post("/ask", response_model=Envelope[AssistantAnswer])
async def ask(
    body: AskIn,
    principal: Principal = Depends(require_any),
    session: AsyncSession = Depends(get_session),
) -> Envelope[AssistantAnswer]:
    result = await answer(session, principal, body.question)
    audit(
        session,
        principal,
        "assistant.ask",
        "assistant",
        None,
        {"channel": body.channel, "understood": result.understood},
    )
    await session.commit()
    return Envelope(data=result)


@router.get("/suggestions", response_model=Envelope[list[str]])
async def suggestions(principal: Principal = Depends(require_any)) -> Envelope[list[str]]:
    return Envelope(data=PERSONA_HELP.get(principal.role, PERSONA_HELP["agent"]))
