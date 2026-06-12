"""Idempotent seed: default user (assignment: 'assume a default user is logged in')
plus sample upcoming and recent meetings so the dashboard is never empty."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import utcnow
from app.models import Meeting, MeetingSettings, MeetingStatus, MeetingType, User
from app.services.code_generator import generate_meeting_code

DEFAULT_USER_EMAIL = "vijay@example.com"


async def seed(db: AsyncSession) -> None:
    existing = await db.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if existing:
        return

    user = User(email=DEFAULT_USER_EMAIL, name="Vijay Lingoju", is_guest=False)
    db.add(user)
    await db.flush()

    now = utcnow()
    upcoming = [
        ("Weekly Team Sync", "Sprint progress and blockers", now + timedelta(hours=3), 45),
        ("Product Design Review", "Walkthrough of the new dashboard mocks", now + timedelta(days=1), 60),
        ("1:1 with Manager", None, now + timedelta(days=2, hours=2), 30),
    ]
    for title, description, start, duration in upcoming:
        meeting = Meeting(
            meeting_code=generate_meeting_code(),
            host_id=user.id,
            title=title,
            description=description,
            meeting_type=MeetingType.SCHEDULED,
            status=MeetingStatus.SCHEDULED,
            scheduled_start=start,
            duration_minutes=duration,
        )
        db.add(meeting)
        await db.flush()
        db.add(MeetingSettings(meeting_id=meeting.id))

    recent = [
        ("Client Demo", MeetingType.SCHEDULED, now - timedelta(days=1, hours=2), 55),
        ("Instant Meeting", MeetingType.INSTANT, now - timedelta(days=2), 20),
        ("Architecture Discussion", MeetingType.SCHEDULED, now - timedelta(days=3), 90),
    ]
    for title, meeting_type, started, minutes in recent:
        meeting = Meeting(
            meeting_code=generate_meeting_code(),
            host_id=user.id,
            title=title,
            meeting_type=meeting_type,
            status=MeetingStatus.ENDED,
            scheduled_start=started if meeting_type == MeetingType.SCHEDULED else None,
            duration_minutes=minutes if meeting_type == MeetingType.SCHEDULED else None,
            started_at=started,
            ended_at=started + timedelta(minutes=minutes),
        )
        db.add(meeting)
        await db.flush()
        db.add(MeetingSettings(meeting_id=meeting.id))

    await db.commit()
