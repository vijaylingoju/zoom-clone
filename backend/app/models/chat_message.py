from sqlalchemy import ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import IdMixin, SoftDeleteMixin, TimestampMixin


class ChatMessage(Base, IdMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "chat_messages"

    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id"))
    participant_id: Mapped[str] = mapped_column(ForeignKey("meeting_participants.id"))
    content: Mapped[str]

    __table_args__ = (Index("idx_chat_meeting", "meeting_id", "created_at"),)
