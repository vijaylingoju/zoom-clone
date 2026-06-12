from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models import User
from app.schemas.meeting import (
    ChatMessageOut,
    HostKeyRequest,
    JoinRequest,
    JoinResponse,
    LeaveRequest,
    MeetingCreate,
    MeetingCreatedOut,
    MeetingOut,
    MeetingOwnerOut,
    ParticipantOut,
)
from app.services.meeting_service import MeetingService

router = APIRouter(prefix="/meetings", tags=["meetings"])


def get_service(db: AsyncSession = Depends(get_db)) -> MeetingService:
    return MeetingService(db)


@router.post("", response_model=MeetingCreatedOut, status_code=201)
async def create_meeting(
    payload: MeetingCreate,
    user: User = Depends(get_current_user),
    service: MeetingService = Depends(get_service),
) -> MeetingCreatedOut:
    return MeetingCreatedOut.model_validate(await service.create_meeting(user, payload))


@router.get("/upcoming", response_model=list[MeetingOwnerOut])
async def upcoming_meetings(
    user: User = Depends(get_current_user),
    service: MeetingService = Depends(get_service),
) -> list[MeetingOwnerOut]:
    return [MeetingOwnerOut.model_validate(m) for m in await service.list_upcoming(user)]


@router.get("/recent", response_model=list[MeetingOwnerOut])
@router.get("/previous", response_model=list[MeetingOwnerOut])
async def recent_meetings(
    user: User = Depends(get_current_user),
    service: MeetingService = Depends(get_service),
) -> list[MeetingOwnerOut]:
    return [MeetingOwnerOut.model_validate(m) for m in await service.list_recent(user)]


@router.get("/{code}", response_model=MeetingOut)
async def validate_meeting(
    code: str,
    service: MeetingService = Depends(get_service),
) -> MeetingOut:
    return MeetingOut.model_validate(await service.get_by_code_or_404(code))


@router.post("/{code}/start", response_model=MeetingCreatedOut)
async def start_meeting(
    code: str,
    payload: HostKeyRequest,
    service: MeetingService = Depends(get_service),
) -> MeetingCreatedOut:
    return MeetingCreatedOut.model_validate(await service.start(code, payload.host_key))


@router.delete("/{code}", status_code=204)
async def delete_meeting(
    code: str,
    payload: HostKeyRequest,
    service: MeetingService = Depends(get_service),
) -> None:
    await service.cancel(code, payload.host_key)


@router.post("/{code}/join", response_model=JoinResponse)
async def join_meeting(
    code: str,
    payload: JoinRequest,
    user: User = Depends(get_current_user),
    service: MeetingService = Depends(get_service),
) -> JoinResponse:
    participant = await service.join(
        code, payload.display_name, user, payload.host_key, payload.passcode
    )
    meeting = await service.get_by_code_or_404(code)
    return JoinResponse(
        participant=ParticipantOut.model_validate(participant),
        meeting=MeetingOwnerOut.model_validate(meeting),
    )


@router.get("/{code}/chat", response_model=list[ChatMessageOut])
async def chat_history(
    code: str,
    service: MeetingService = Depends(get_service),
) -> list[ChatMessageOut]:
    return [ChatMessageOut.model_validate(m) for m in await service.list_chat(code)]


@router.post("/{code}/leave", status_code=204)
async def leave_meeting(
    code: str,
    payload: LeaveRequest,
    service: MeetingService = Depends(get_service),
) -> None:
    await service.leave(code, payload.participant_id)
