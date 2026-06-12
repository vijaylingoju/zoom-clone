import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import IdMixin, SoftDeleteMixin, TimestampMixin


class MeetingType(str, enum.Enum):
    INSTANT = "instant"
    SCHEDULED = "scheduled"


class MeetingStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    ENDED = "ended"
    CANCELLED = "cancelled"


def _enum(e: type[enum.Enum], name: str) -> Enum:
    return Enum(e, name=name, native_enum=False, values_callable=lambda x: [m.value for m in x])


class Meeting(Base, IdMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "meetings"

    meeting_code: Mapped[str] = mapped_column(unique=True, index=True)
    host_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(default="Instant Meeting")
    description: Mapped[str | None]
    meeting_type: Mapped[MeetingType] = mapped_column(_enum(MeetingType, "meeting_type"))
    status: Mapped[MeetingStatus] = mapped_column(
        _enum(MeetingStatus, "meeting_status"), default=MeetingStatus.SCHEDULED
    )
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int | None]
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    passcode_hash: Mapped[str | None]

    host = relationship("User", lazy="joined")
    settings = relationship(
        "MeetingSettings", uselist=False, cascade="all, delete-orphan", lazy="joined"
    )
    participants = relationship("MeetingParticipant", back_populates="meeting")

    __table_args__ = (
        Index("idx_meetings_host_upcoming", "host_id", "status", "scheduled_start"),
        Index("idx_meetings_host_recent", "host_id", "status", "ended_at"),
    )
