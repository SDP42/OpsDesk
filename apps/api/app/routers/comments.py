"""Internal notes vs external replies: separate routes, separate permissions."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import Principal, can_read_internal, ensure_visible, require_any, require_staff
from app.db.models import Comment
from app.db.session import get_session
from app.schemas.common import Envelope
from app.schemas.conversations import CommentIn, CommentOut
from app.services import tickets as svc
from app.services.audit import audit, timeline
from app.services.serializers import user_brief

router = APIRouter(prefix="/tickets/{ticket_id}/comments", tags=["comments"])


def _out(c: Comment, hide_author: bool = False) -> CommentOut:
    author = user_brief(c.author)
    if hide_author and author and author.role != "requester":
        author = author.model_copy(update={"name": author.callsign or "Tower", "id": ""})
    return CommentOut(id=c.id, visibility=c.visibility, body=c.body, author=author,
                      created_at=c.created_at)


@router.get("", response_model=Envelope[list[CommentOut]])
async def list_comments(ticket_id: str, principal: Principal = Depends(require_any),
                        session: AsyncSession = Depends(get_session)) -> Envelope[list[CommentOut]]:
    ticket = ensure_visible(await svc.load_ticket(session, ticket_id), principal)
    stmt = select(Comment).where(Comment.ticket_id == ticket.id)
    if not can_read_internal(principal):
        stmt = stmt.where(Comment.visibility == "external")
    rows = (await session.scalars(stmt.order_by(Comment.created_at))).all()
    return Envelope(data=[_out(c, hide_author=principal.is_requester) for c in rows])


async def _post(ticket_id: str, body: CommentIn, visibility: str, principal: Principal,
                session: AsyncSession) -> CommentOut:
    ticket = ensure_visible(await svc.load_ticket(session, ticket_id), principal)
    comment = Comment(ticket_id=ticket.id, visibility=visibility, body=body.body,
                      author_id=principal.id)
    session.add(comment)
    await session.flush()
    timeline(session, ticket.id, "internal_note" if visibility == "internal" else "external_reply",
             principal, {"comment_id": comment.id, "preview": body.body[:120]})
    audit(session, principal, f"comment.{visibility}", "ticket", ticket.id, {"comment": comment.id})
    if principal.is_requester and ticket.status == "pending":
        ticket.status = "open"
        timeline(session, ticket.id, "status_changed", principal,
                 {"from": "pending", "to": "open", "note": "Pilot replied"})
    await session.commit()
    await session.refresh(comment)
    svc.publish_update(ticket, f"comment.{visibility}")
    return _out(comment, hide_author=principal.is_requester)


@router.post("/internal", response_model=Envelope[CommentOut], status_code=201)
async def post_internal(ticket_id: str, body: CommentIn, principal: Principal = Depends(require_staff),
                        session: AsyncSession = Depends(get_session)) -> Envelope[CommentOut]:
    """Internal note: staff only, never serialised on requester routes."""
    return Envelope(data=await _post(ticket_id, body, "internal", principal, session))


@router.post("/external", response_model=Envelope[CommentOut], status_code=201)
async def post_external(ticket_id: str, body: CommentIn, principal: Principal = Depends(require_any),
                        session: AsyncSession = Depends(get_session)) -> Envelope[CommentOut]:
    """External reply: visible to the Pilot."""
    return Envelope(data=await _post(ticket_id, body, "external", principal, session))
