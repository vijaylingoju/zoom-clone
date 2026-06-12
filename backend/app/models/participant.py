import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, utcnow
from app.models.base import IdMixin, TimestampMixin


class ParticipantRole(str, enum.Enum):
    HOST = "host"
    COHOST = "cohost"
    PARTICIPANT = "participant"


class MeetingParticipant(Base, IdMixin, TimestampMixin):
    """One row per join event (join-session log, PLAN §3.2): left_at IS NULL = in room."""

    __tablename__ = "meeting_participants"

    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id"))
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    display_name: Mapped[str]
    role: Mapped[ParticipantRole] = mapped_column(
        Enum(
            ParticipantRole,
            name="participant_role",
            native_enum=False,
            values_callable=lambda x: [m.value for m in x],
        ),
        default=ParticipantRole.PARTICIPANT,
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_muted: Mapped[bool] = mapped_column(default=False)
    is_video_off: Mapped[bool] = mapped_column(default=False)

    meeting = relationship("Meeting", back_populates="participants")

    __table_args__ = (
        Index("idx_participants_meeting", "meeting_id", "joined_at"),
        Index("idx_participants_user", "user_id", "joined_at"),
        Index(
            "idx_participants_active",
            "meeting_id",
            sqlite_where=text("left_at IS NULL"),
            postgresql_where=text("left_at IS NULL"),
        ),
    )
