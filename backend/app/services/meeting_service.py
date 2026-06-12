from datetime import UTC

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import utcnow
from app.models import (
    ChatMessage,
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
        if payload.use_pmi:
            return await self._start_pmi(host)

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
            passcode=payload.passcode,
            timezone=payload.timezone,
        )
        self.db.add(meeting)
        await self.db.flush()
        self.db.add(
            MeetingSettings(
                meeting_id=meeting.id,
                host_video_on=payload.host_video_on,
                participant_video_on=payload.participant_video_on,
            )
        )
        await self.db.commit()
        await self.db.refresh(meeting)
        return meeting

    async def _start_pmi(self, host: User) -> Meeting:
        """The PMI room is one persistent, restartable meeting row."""
        if not host.pmi_code:
            raise HTTPException(status_code=400, detail="User has no Personal Meeting ID")
        meeting = await self.repo.get_by_code(host.pmi_code)
        if meeting is None:
            raise HTTPException(status_code=500, detail="PMI meeting missing — reseed")
        meeting.status = MeetingStatus.ACTIVE
        meeting.started_at = utcnow()
        meeting.ended_at = None
        await self.db.commit()
        await self.db.refresh(meeting)
        return meeting

    async def start(self, code: str, host_key: str) -> Meeting:
        """Host (re)starts a scheduled or ended meeting from the Meetings tab."""
        meeting = await self.get_by_code_or_404(code)
        if host_key != meeting.host_key:
            raise HTTPException(status_code=403, detail="Only the host can start this meeting")
        if meeting.status == MeetingStatus.CANCELLED:
            raise HTTPException(status_code=410, detail="Meeting has been cancelled")
        meeting.status = MeetingStatus.ACTIVE
        if meeting.started_at is None or meeting.ended_at is not None:
            meeting.started_at = utcnow()
        meeting.ended_at = None
        await self.db.commit()
        await self.db.refresh(meeting)
        return meeting

    async def cancel(self, code: str, host_key: str) -> None:
        meeting = await self.get_by_code_or_404(code)
        if host_key != meeting.host_key:
            raise HTTPException(status_code=403, detail="Only the host can delete this meeting")
        if meeting.is_pmi:
            raise HTTPException(status_code=400, detail="The PMI room cannot be deleted")
        meeting.status = MeetingStatus.CANCELLED
        meeting.deleted_at = utcnow()
        await self.db.commit()

    async def get_by_code_or_404(self, code: str) -> Meeting:
        meeting = await self.repo.get_by_code(code)
        if meeting is None:
            raise HTTPException(status_code=404, detail="Meeting not found")
        return meeting

    async def join(
        self,
        code: str,
        display_name: str,
        user: User | None,
        host_key: str | None = None,
        passcode: str | None = None,
    ) -> MeetingParticipant:
        meeting = await self.get_by_code_or_404(code)
        is_host_key = host_key is not None and host_key == meeting.host_key

        if meeting.status == MeetingStatus.ENDED and meeting.is_pmi:
            # the PMI room is always restartable (PLAN-V2 §3)
            meeting.ended_at = None
            meeting.status = MeetingStatus.SCHEDULED
        if meeting.status in (MeetingStatus.ENDED, MeetingStatus.CANCELLED):
            raise HTTPException(status_code=410, detail=f"Meeting has {meeting.status.value}")

        # hosts bypass the passcode, like Zoom
        if meeting.passcode and not is_host_key and passcode != meeting.passcode:
            raise HTTPException(status_code=403, detail="Passcode required")

        if meeting.status == MeetingStatus.SCHEDULED:
            meeting.status = MeetingStatus.ACTIVE
            meeting.started_at = utcnow()

        # Host role requires the creator's secret, not just the shared default
        # user — otherwise every browser would join as host (no real auth yet)
        participant = MeetingParticipant(
            meeting_id=meeting.id,
            user_id=user.id if user else None,
            display_name=display_name.strip(),
            role=ParticipantRole.HOST if is_host_key else ParticipantRole.PARTICIPANT,
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

    async def save_chat_message(
        self, code: str, participant_id: str, content: str
    ) -> dict | None:
        meeting = await self.repo.get_by_code(code)
        participant = await self.repo.get_participant(participant_id)
        if meeting is None or participant is None or participant.meeting_id != meeting.id:
            return None
        message = ChatMessage(
            meeting_id=meeting.id, participant_id=participant_id, content=content
        )
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)
        return {
            "id": message.id,
            "participant_id": participant_id,
            "display_name": participant.display_name,
            "content": message.content,
            "created_at": message.created_at.isoformat() + "Z",
        }

    async def list_chat(self, code: str) -> list[dict]:
        meeting = await self.get_by_code_or_404(code)
        return [
            {
                "id": message.id,
                "participant_id": message.participant_id,
                "display_name": display_name,
                "content": message.content,
                "created_at": message.created_at,
            }
            for message, display_name in await self.repo.list_chat(meeting.id)
        ]

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
