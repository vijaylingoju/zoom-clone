from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ChatMessage, Meeting, MeetingParticipant, MeetingStatus


class MeetingRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_code(self, code: str) -> Meeting | None:
        return await self.db.scalar(
            select(Meeting).where(
                Meeting.meeting_code == code.strip().lower(),
                Meeting.deleted_at.is_(None),
            )
        )

    async def code_exists(self, code: str) -> bool:
        return await self.db.scalar(select(Meeting.id).where(Meeting.meeting_code == code)) is not None

    async def list_upcoming(self, host_id: str, now: datetime) -> list[Meeting]:
        result = await self.db.scalars(
            select(Meeting)
            .where(
                Meeting.host_id == host_id,
                Meeting.status == MeetingStatus.SCHEDULED,
                Meeting.scheduled_start.is_not(None),
                Meeting.deleted_at.is_(None),
            )
            .order_by(Meeting.scheduled_start)
        )
        return list(result)

    async def list_recent(self, host_id: str, limit: int = 10) -> list[Meeting]:
        result = await self.db.scalars(
            select(Meeting)
            .where(
                Meeting.host_id == host_id,
                Meeting.status == MeetingStatus.ENDED,
                Meeting.deleted_at.is_(None),
            )
            .order_by(Meeting.ended_at.desc())
            .limit(limit)
        )
        return list(result)

    async def active_participant_count(self, meeting_id: str) -> int:
        result = await self.db.scalars(
            select(MeetingParticipant.id).where(
                MeetingParticipant.meeting_id == meeting_id,
                MeetingParticipant.left_at.is_(None),
            )
        )
        return len(list(result))

    async def get_participant(self, participant_id: str) -> MeetingParticipant | None:
        return await self.db.get(MeetingParticipant, participant_id)

    async def list_chat(self, meeting_id: str) -> list[tuple[ChatMessage, str]]:
        result = await self.db.execute(
            select(ChatMessage, MeetingParticipant.display_name)
            .join(MeetingParticipant, ChatMessage.participant_id == MeetingParticipant.id)
            .where(ChatMessage.meeting_id == meeting_id, ChatMessage.deleted_at.is_(None))
            .order_by(ChatMessage.created_at)
        )
        return [(row[0], row[1]) for row in result.all()]
