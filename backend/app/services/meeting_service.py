from datetime import UTC

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import utcnow
from app.models import (
    Meeting,
    MeetingParticipant,
    MeetingSettings,
    MeetingStatus,
    MeetingType,
    ParticipantRole,
    User,
)
from app.repositories.meeting_repo import MeetingRepository
from app.schemas.meeting import MeetingCreate
from app.services.code_generator import generate_meeting_code

_CODE_RETRIES = 5


class MeetingService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = MeetingRepository(db)

    async def create_meeting(self, host: User, payload: MeetingCreate) -> Meeting:
        is_instant = payload.meeting_type == MeetingType.INSTANT
        scheduled_start = payload.scheduled_start
        if scheduled_start is not None and scheduled_start.tzinfo is not None:
            scheduled_start = scheduled_start.astimezone(UTC).replace(tzinfo=None)
        meeting = Meeting(
            meeting_code=await self._unique_code(),
            host_id=host.id,
            title=payload.title or (f"{host.name}'s Meeting" if is_instant else "Meeting"),
            description=payload.description,
            meeting_type=payload.meeting_type,
            status=MeetingStatus.ACTIVE if is_instant else MeetingStatus.SCHEDULED,
            scheduled_start=None if is_instant else scheduled_start,
            duration_minutes=None if is_instant else payload.duration_minutes,
            started_at=utcnow() if is_instant else None,
        )
        self.db.add(meeting)
        await self.db.flush()
        self.db.add(MeetingSettings(meeting_id=meeting.id))
        await self.db.commit()
        await self.db.refresh(meeting)
        return meeting

    async def get_by_code_or_404(self, code: str) -> Meeting:
        meeting = await self.repo.get_by_code(code)
        if meeting is None:
            raise HTTPException(status_code=404, detail="Meeting not found")
        return meeting

    async def join(self, code: str, display_name: str, user: User | None) -> MeetingParticipant:
        meeting = await self.get_by_code_or_404(code)
        if meeting.status in (MeetingStatus.ENDED, MeetingStatus.CANCELLED):
            raise HTTPException(status_code=410, detail=f"Meeting has {meeting.status.value}")

        if meeting.status == MeetingStatus.SCHEDULED:
            meeting.status = MeetingStatus.ACTIVE
            meeting.started_at = utcnow()

        is_host = user is not None and user.id == meeting.host_id
        participant = MeetingParticipant(
            meeting_id=meeting.id,
            user_id=user.id if user else None,
            display_name=display_name.strip(),
            role=ParticipantRole.HOST if is_host else ParticipantRole.PARTICIPANT,
            is_muted=meeting.settings.mute_on_entry if meeting.settings else False,
        )
        self.db.add(participant)
        await self.db.commit()
        await self.db.refresh(participant)
        await self.db.refresh(meeting)
        return participant

    async def leave(self, code: str, participant_id: str) -> None:
        meeting = await self.get_by_code_or_404(code)
        participant = await self.repo.get_participant(participant_id)
        if participant is None or participant.meeting_id != meeting.id:
            raise HTTPException(status_code=404, detail="Participant not found in this meeting")

        if participant.left_at is None:
            participant.left_at = utcnow()
            await self.db.flush()

        # Last one out of an instant meeting ends it (PLAN §2.7 step 10)
        if (
            meeting.meeting_type == MeetingType.INSTANT
            and meeting.status == MeetingStatus.ACTIVE
            and await self.repo.active_participant_count(meeting.id) == 0
        ):
            meeting.status = MeetingStatus.ENDED
            meeting.ended_at = utcnow()
        await self.db.commit()

    async def list_upcoming(self, host: User) -> list[Meeting]:
        return await self.repo.list_upcoming(host.id, utcnow())

    async def list_recent(self, host: User) -> list[Meeting]:
        return await self.repo.list_recent(host.id)

    async def _unique_code(self) -> str:
        for _ in range(_CODE_RETRIES):
            code = generate_meeting_code()
            if not await self.repo.code_exists(code):
                return code
        raise HTTPException(status_code=500, detail="Could not allocate meeting code")
