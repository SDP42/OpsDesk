"""Demo login with httpOnly JWT cookie, logout and /me."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.rbac import Principal, require_any
from app.core.security import create_access_token, verify_password
from app.db.base import utcnow
from app.db.models import User
from app.db.seed.fixtures import DEMO_ACCOUNTS
from app.db.session import get_session
from app.schemas.auth import DemoAccount, LoginIn, MeOut, PreferencesIn
from app.schemas.common import Envelope, Ok
from app.services.audit import audit
from app.services.serializers import agency_brief

router = APIRouter(prefix="/auth", tags=["auth"])
me_router = APIRouter(tags=["auth"])

_attempts: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit(key: str) -> None:
    """Sliding one-minute window per (IP, account): stops brute force on any one account
    without locking out a whole office that shares an IP."""
    limit = get_settings().login_rate_limit_per_minute
    window = _attempts[key]
    now = time.monotonic()
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= limit:
        raise AppError(429, "rate_limited", "Too many login attempts; try again in a minute")
    window.append(now)


def _me(user: User) -> MeOut:
    return MeOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        callsign=user.callsign,
        region=user.region,
        availability=user.availability,
        agency=agency_brief(user.agency) if user.agency else None,
        data_mode=user.data_mode,
        onboarded=user.onboarded_at is not None,
    )


@router.post("/login", response_model=Envelope[MeOut])
async def login(
    body: LoginIn,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> Envelope[MeOut]:
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"{ip}:{body.email.lower()}")
    user = await session.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        raise AppError(401, "invalid_credentials", "Callsign or password is incorrect")
    settings = get_settings()
    token = create_access_token(user.id, user.role, {"agency_id": user.agency_id})
    response.set_cookie(
        settings.session_cookie_name,
        token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=settings.jwt_expires_minutes * 60,
        path="/",
    )
    audit(
        session,
        Principal(user.id, user.name, user.role, user.agency_id, user.region),
        "auth.login",
        "user",
        user.id,
        ip=ip,
    )
    await session.commit()
    return Envelope(data=_me(user))


@router.post("/logout", response_model=Envelope[Ok])
async def logout(response: Response) -> Envelope[Ok]:
    response.delete_cookie(get_settings().session_cookie_name, path="/")
    return Envelope(data=Ok())


@router.get("/demo-accounts", response_model=Envelope[list[DemoAccount]])
async def demo_accounts(
    session: AsyncSession = Depends(get_session),
) -> Envelope[list[DemoAccount]]:
    """The four callsign cards on /login (demo-only; emails come from the seed)."""
    personas = [
        ("requester", "Pilot", "/pilot"),
        ("agent", "Controller", "/tower"),
        ("escalation_manager", "Tower Chief", "/tower/escalations"),
        ("lead", "Airport Director", "/tower"),
        ("supplier", "Supplier Partner", "/partner"),
    ]
    settings = get_settings()
    # One-click demo login outside production only; the password lives in settings, not code.
    demo_password = settings.demo_password if settings.app_env != "production" else None
    out: list[DemoAccount] = []
    for role, persona, home in personas:
        user = await session.scalar(select(User).where(User.email == DEMO_ACCOUNTS[role]))
        if user:
            out.append(
                DemoAccount(
                    role=role,
                    persona=persona,
                    name=user.name,
                    email=user.email,
                    region=user.region,
                    home=home,
                    demo_password=demo_password,
                )
            )
    return Envelope(data=out)


@me_router.get("/me", response_model=Envelope[MeOut])
async def me(
    principal: Principal = Depends(require_any), session: AsyncSession = Depends(get_session)
) -> Envelope[MeOut]:
    user = await session.get(User, principal.id)
    assert user is not None
    return Envelope(data=_me(user))


@me_router.patch("/me/preferences", response_model=Envelope[MeOut])
async def preferences(
    body: PreferencesIn,
    principal: Principal = Depends(require_any),
    session: AsyncSession = Depends(get_session),
) -> Envelope[MeOut]:
    """Switch between the demo airspace and live data, and mark onboarding complete."""
    user = await session.get(User, principal.id)
    assert user is not None
    if body.data_mode:
        user.data_mode = body.data_mode
    if body.onboarded is not None:
        user.onboarded_at = utcnow() if body.onboarded else None
    audit(
        session, principal, "user.preferences", "user", user.id, body.model_dump(exclude_none=True)
    )
    await session.commit()
    await session.refresh(user)
    return Envelope(data=_me(user))
