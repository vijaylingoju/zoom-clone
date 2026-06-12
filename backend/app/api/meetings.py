from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models import User
from app.schemas.meeting import (
    JoinRequest,
    JoinResponse,
    LeaveRequest,
    MeetingCreate,
    MeetingOut,
    ParticipantOut,
)
from app.services.meeting_service import MeetingService

router = APIRouter(prefix="/meetings", tags=["meetings"])


def get_service(db: AsyncSession = Depends(get_db)) -> MeetingService:
    return MeetingService(db)


@router.post("", response_model=MeetingOut, status_code=201)
async def create_meeting(
    payload: MeetingCreate,
    user: User = Depends(get_current_user),
    service: MeetingService = Depends(get_service),
) -> MeetingOut:
    return MeetingOut.model_validate(await service.create_meeting(user, payload))


@router.get("/upcoming", response_model=list[MeetingOut])
async def upcoming_meetings(
    user: User = Depends(get_current_user),
    service: MeetingService = Depends(get_service),
) -> list[MeetingOut]:
    return [MeetingOut.model_validate(m) for m in await service.list_upcoming(user)]


@router.get("/recent", response_model=list[MeetingOut])
async def recent_meetings(
    user: User = Depends(get_current_user),
    service: MeetingService = Depends(get_service),
) -> list[MeetingOut]:
    return [MeetingOut.model_validate(m) for m in await service.list_recent(user)]


@router.get("/{code}", response_model=MeetingOut)
async def validate_meeting(
    code: str,
    service: MeetingService = Depends(get_service),
) -> MeetingOut:
    return MeetingOut.model_validate(await service.get_by_code_or_404(code))


@router.post("/{code}/join", response_model=JoinResponse)
async def join_meeting(
    code: str,
    payload: JoinRequest,
    user: User = Depends(get_current_user),
    service: MeetingService = Depends(get_service),
) -> JoinResponse:
    participant = await service.join(code, payload.display_name, user)
    meeting = await service.get_by_code_or_404(code)
    return JoinResponse(
        participant=ParticipantOut.model_validate(participant),
        meeting=MeetingOut.model_validate(meeting),
    )


@router.post("/{code}/leave", status_code=204)
async def leave_meeting(
    code: str,
    payload: LeaveRequest,
    service: MeetingService = Depends(get_service),
) -> None:
    await service.leave(code, payload.participant_id)
