from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.core.config import settings
from app.models import MeetingStatus, MeetingType, ParticipantRole


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
    scheduled_start: datetime | None
    duration_minutes: int | None
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime

    @computed_field
    @property
    def join_url(self) -> str:
        return f"{settings.frontend_base_url}/meeting/{self.meeting_code}"


class JoinRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=50)


class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    role: ParticipantRole
    is_muted: bool
    is_video_off: bool
    joined_at: datetime


class JoinResponse(BaseModel):
    participant: ParticipantOut
    meeting: MeetingOut


class LeaveRequest(BaseModel):
    participant_id: str
