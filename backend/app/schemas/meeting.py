from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, computed_field, model_validator

from app.core.config import settings
from app.models import MeetingStatus, MeetingType, ParticipantRole


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


# DB stores naive UTC (SQLite drops tzinfo); re-attach UTC so clients get ISO with offset
UtcDatetime = Annotated[datetime, AfterValidator(_as_utc)]


class MeetingCreate(BaseModel):
    meeting_type: MeetingType = MeetingType.INSTANT
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    scheduled_start: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=24 * 60)

    @model_validator(mode="after")
    def scheduled_fields_required(self) -> "MeetingCreate":
        if self.meeting_type == MeetingType.SCHEDULED:
            if self.scheduled_start is None or self.duration_minutes is None:
                raise ValueError(
                    "scheduled meetings require scheduled_start and duration_minutes"
                )
        return self


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    meeting_code: str
    title: str
    description: str | None
    meeting_type: MeetingType
    status: MeetingStatus
    host_id: str
    host_name: str
    scheduled_start: UtcDatetime | None
    duration_minutes: int | None
    started_at: UtcDatetime | None
    ended_at: UtcDatetime | None
    created_at: UtcDatetime

    @computed_field
    @property
    def join_url(self) -> str:
        return f"{settings.frontend_base_url}/meeting/{self.meeting_code}"


class MeetingCreatedOut(MeetingOut):
    """Create response only: host_key must never appear on read endpoints."""

    host_key: str


class JoinRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=50)
    host_key: str | None = None


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    participant_id: str
    display_name: str
    content: str
    created_at: UtcDatetime


class ChatSendRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    role: ParticipantRole
    is_muted: bool
    is_video_off: bool
    joined_at: UtcDatetime


class JoinResponse(BaseModel):
    participant: ParticipantOut
    meeting: MeetingOut


class LeaveRequest(BaseModel):
    participant_id: str
