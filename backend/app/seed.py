"""Idempotent seed: default user (assignment: 'assume a default user is logged in')
with a Personal Meeting ID room, plus sample upcoming and recent meetings so the
dashboard is never empty."""

import secrets
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import utcnow
from app.models import Meeting, MeetingSettings, MeetingStatus, MeetingType, User
from app.services.code_generator import generate_meeting_code

DEFAULT_USER_EMAIL = "vijay@example.com"


def _generate_pmi() -> str:
    return str(secrets.choice("123456789")) + "".join(
        str(secrets.choice("0123456789")) for _ in range(9)
    )


def _random_passcode() -> str:
    return "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(6))


async def seed(db: AsyncSession) -> None:
    existing = await db.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if existing:
        return

    user = User(
        email=DEFAULT_USER_EMAIL,
        name="Vijay Lingoju",
        is_guest=False,
        pmi_code=_generate_pmi(),
    )
    db.add(user)
    await db.flush()

    pmi_meeting = Meeting(
        meeting_code=user.pmi_code,
        host_id=user.id,
        title=f"{user.name}'s Personal Meeting Room",
        meeting_type=MeetingType.INSTANT,
        status=MeetingStatus.SCHEDULED,
        is_pmi=True,
    )
    db.add(pmi_meeting)
    await db.flush()
    db.add(MeetingSettings(meeting_id=pmi_meeting.id))

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
            passcode=_random_passcode(),
            timezone="UTC",
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
