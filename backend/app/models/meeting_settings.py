from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, utcnow


class MeetingSettings(Base):
    __tablename__ = "meeting_settings"

    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id"), primary_key=True)
    mute_on_entry: Mapped[bool] = mapped_column(default=False)
    allow_chat: Mapped[bool] = mapped_column(default=True)
    allow_screen_share: Mapped[bool] = mapped_column(default=True)
    waiting_room: Mapped[bool] = mapped_column(default=False)
    host_video_on: Mapped[bool] = mapped_column(default=True)
    participant_video_on: Mapped[bool] = mapped_column(default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
