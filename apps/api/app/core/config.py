"""Application settings and the routing/SLA tunables.

Every scoring weight lives here so the routing simulator can swap presets
without touching engine code.
"""

from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = API_ROOT.parents[1]
DATA_DIR = API_ROOT / "data"
SECRETS_DIR = API_ROOT / ".secrets"


class Settings(BaseSettings):
    """Runtime configuration, loaded from env vars and the repo-level .env file."""

    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), str(API_ROOT / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = f"sqlite+aiosqlite:///{DATA_DIR / 'opsdesk.db'}"
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 720
    session_cookie_name: str = "opsdesk_session"
    cookie_secure: bool = False
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    log_level: str = "INFO"
    scheduler_enabled: bool = True
    sla_tick_seconds: int = 60
    archive_after_days: int = 90
    login_rate_limit_per_minute: int = 10
    demo_password: str = "cleared-for-takeoff"
    anthropic_api_key: str = ""
    intent_model_path: Path = DATA_DIR / "intent_model.joblib"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [o.strip() for o in value.split(",") if o.strip()]
        return value

    @field_validator("database_url", mode="after")
    @classmethod
    def _resolve_sqlite_path(cls, value: str) -> str:
        """Resolve relative SQLite paths against apps/api so every cwd works."""
        prefix = "sqlite+aiosqlite:///"
        if value.startswith(prefix):
            raw = value[len(prefix) :]
            if raw and raw != ":memory:" and not raw.startswith("/"):
                return prefix + str((API_ROOT / raw).resolve())
        return value

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    def resolved_jwt_secret(self) -> str:
        """Return the configured JWT secret or a random one persisted on first run."""
        if self.jwt_secret:
            return self.jwt_secret
        path = SECRETS_DIR / "jwt_secret"
        if path.exists():
            return path.read_text().strip()
        SECRETS_DIR.mkdir(parents=True, exist_ok=True)
        generated = secrets.token_urlsafe(48)
        path.write_text(generated)
        path.chmod(0o600)
        return generated


@lru_cache
def get_settings() -> Settings:
    return Settings()


# ---------------------------------------------------------------------------
# Vectoring (routing) weights and presets. Spec section 8.1.
# ---------------------------------------------------------------------------

ROUTING_PRESETS: dict[str, dict[str, float]] = {
    "balanced": {
        "region": 1.0,
        "priority": 1.0,
        "time": 1.0,
        "avail": 1.0,
        "skill": 1.0,
        "load": 1.0,
    },
    "urgency_first": {
        "region": 1.0,
        "priority": 2.0,
        "time": 2.0,
        "avail": 1.0,
        "skill": 1.0,
        "load": 1.0,
    },
    "regional_affinity": {
        "region": 2.0,
        "priority": 1.0,
        "time": 1.0,
        "avail": 1.0,
        "skill": 1.0,
        "load": 1.0,
    },
    "fairness": {
        "region": 1.0,
        "priority": 1.0,
        "time": 1.0,
        "avail": 1.0,
        "skill": 1.0,
        "load": 2.0,
    },
}

# Regions that count as "adjacent" for partial region credit.
REGION_ADJACENCY: dict[str, set[str]] = {
    "IN": {"AE", "SEA"},
    "AE": {"IN", "UK"},
    "UK": {"AE"},
    "SEA": {"IN"},
}

REGION_TIMEZONES: dict[str, str] = {
    "IN": "Asia/Kolkata",
    "AE": "Asia/Dubai",
    "UK": "Europe/London",
    "SEA": "Asia/Singapore",
}

REGION_LABELS: dict[str, str] = {
    "IN": "India",
    "AE": "UAE",
    "UK": "UK",
    "SEA": "South-East Asia",
}

# ---------------------------------------------------------------------------
# Wheels-Up SLA. Spec section 8.2.
# ---------------------------------------------------------------------------

SLA_BASE_MINUTES: dict[str, int] = {"P1": 60, "P2": 240, "P3": 480, "P4": 1440}
# (max hours to check-in/LCD, factor); first match wins, else 1.0
SLA_URGENCY_STEPS: list[tuple[float, float]] = [(12, 0.25), (24, 0.40), (72, 0.60), (168, 0.80)]
SLA_AT_RISK_PCT = 60.0
SLA_CRITICAL_PCT = 85.0

# ---------------------------------------------------------------------------
# Linker. Spec section 8.3.
# ---------------------------------------------------------------------------

LINK_AGENCY_INTENT_DAYS = 30
LINK_SEMANTIC_THRESHOLD = 0.35
GUARDIAN_WINDOW_DAYS = 14
GUARDIAN_CONTACT_THRESHOLD = 3

# ---------------------------------------------------------------------------
# Intent classifier. Spec section 8.4.
# ---------------------------------------------------------------------------

INTENT_NEEDS_HUMAN_BELOW = 0.55
