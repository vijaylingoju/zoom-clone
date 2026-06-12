import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    # Naive UTC: SQLite ignores DateTime(timezone=True), so storing naive UTC
    # everywhere keeps comparisons consistent; DTOs re-attach UTC on the way out.
    return datetime.now(UTC).replace(tzinfo=None)


def new_id() -> str:
    # UUIDv7 (time-ordered, index-friendly per PLAN §2.5); uuid4 fallback for Python < 3.14
    generator = getattr(uuid, "uuid7", uuid.uuid4)
    return str(generator())


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
