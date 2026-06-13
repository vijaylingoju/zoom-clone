from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi import HTTPException

from app.core.db import SessionLocal, utcnow
from app.models import MeetingParticipant, MeetingStatus
from app.repositories.meeting_repo import MeetingRepository
from app.schemas.meeting import ChatSendRequest
from app.services.meeting_service import MeetingService
from app.ws.room_manager import ParticipantInfo, room_manager

router = APIRouter()

# offer/answer/ice are relayed verbatim to the addressee; the server only
# stamps `from` so a client can never impersonate another participant.
RELAY_TYPES = {"offer", "answer", "ice-candidate"}


def _participant_info(participant: MeetingParticipant) -> ParticipantInfo:
    return {
        "participant_id": participant.id,
        "display_name": participant.display_name,
        "role": participant.role.value,
        "is_muted": participant.is_muted,
        "is_video_off": participant.is_video_off,
        "hand_raised": False,
    }


async def _validate(code: str, participant_id: str) -> ParticipantInfo | None:
    async with SessionLocal() as db:
        repo = MeetingRepository(db)
        meeting = await repo.get_by_code(code)
        if meeting is None or meeting.status.value not in ("active", "scheduled"):
            return None
        participant = await repo.get_participant(participant_id)
        if participant is None or participant.meeting_id != meeting.id:
            return None
        if participant.left_at is not None:
            # reconnect after a WS blip: the meeting is still joinable, so rejoin
            participant.left_at = None
            await db.commit()
        return _participant_info(participant)


async def _update_media_state(participant_id: str, audio: bool, video: bool) -> None:
    async with SessionLocal() as db:
        participant = await db.get(MeetingParticipant, participant_id)
        if participant:
            participant.is_muted = not audio
            participant.is_video_off = not video
            await db.commit()


async def _mark_left(code: str, participant_id: str) -> None:
    async with SessionLocal() as db:
        try:
            await MeetingService(db).leave(code, participant_id)
        except HTTPException:
            pass  # already left via REST, or meeting ended concurrently


@router.websocket("/ws/meetings/{code}")
async def meeting_signaling(ws: WebSocket, code: str, participant_id: str) -> None:
    await ws.accept()
    info = await _validate(code, participant_id)
    if info is None:
        await ws.close(code=4403, reason="Unknown meeting or participant")
        return

    room_manager.add(code, participant_id, ws, info)
    await ws.send_json(
        {"type": "roster", "payload": {"participants": room_manager.peers(code, exclude=participant_id)}}
    )
    await room_manager.broadcast(
        code, {"type": "participant-joined", "payload": info}, exclude=participant_id
    )

    try:
        while True:
            message = await ws.receive_json()
            await _handle(code, participant_id, message)
    except WebSocketDisconnect:
        pass
    finally:
        room_manager.remove(code, participant_id)
        # Broadcast FIRST so all clients update instantly, then persist to DB
        await room_manager.broadcast(
            code,
            {"type": "participant-left", "payload": {"participant_id": participant_id}},
        )
        await _mark_left(code, participant_id)


async def _handle(code: str, sender_id: str, message: dict[str, Any]) -> None:
    msg_type = message.get("type")
    payload = message.get("payload")

    if msg_type in RELAY_TYPES:
        target = message.get("to")
        if isinstance(target, str) and target:
            await room_manager.send_to(
                code, target, {"type": msg_type, "from": sender_id, "payload": payload}
            )
        return

    if msg_type == "media-state" and isinstance(payload, dict):
        audio = bool(payload.get("audio"))
        video = bool(payload.get("video"))
        await _update_media_state(sender_id, audio, video)
        room_manager.update_info(code, sender_id, is_muted=not audio, is_video_off=not video)
        await room_manager.broadcast(
            code,
            {"type": "media-state", "from": sender_id, "payload": {"audio": audio, "video": video}},
            exclude=sender_id,
        )
        return

    if msg_type == "reaction" and isinstance(payload, dict):
        emoji = str(payload.get("emoji", ""))[:8]
        if emoji:
            await room_manager.broadcast(
                code, {"type": "reaction", "from": sender_id, "payload": {"emoji": emoji}}
            )
        return

    if msg_type == "raise-hand" and isinstance(payload, dict):
        raised = bool(payload.get("raised"))
        room_manager.update_info(code, sender_id, hand_raised=raised)
        await room_manager.broadcast(
            code,
            {"type": "raise-hand", "from": sender_id, "payload": {"raised": raised}},
        )
        return

    if msg_type in ("host-mute-all", "host-remove", "end-meeting"):
        await _handle_host_command(code, sender_id, msg_type, payload)
        return

    if msg_type == "chat" and isinstance(payload, dict):
        try:
            request = ChatSendRequest(content=str(payload.get("content", "")))
        except ValueError:
            return
        async with SessionLocal() as db:
            saved = await MeetingService(db).save_chat_message(
                code, sender_id, request.content.strip()
            )
        if saved:
            # broadcast to everyone incl. the sender: one consistent ordering
            await room_manager.broadcast(code, {"type": "chat", "payload": saved})
        return
    # unknown message types are ignored on purpose (forward compatibility)


async def _is_host(participant_id: str) -> bool:
    """Authorization happens server-side against the DB — never trust the client."""
    async with SessionLocal() as db:
        participant = await db.get(MeetingParticipant, participant_id)
        return participant is not None and participant.role.value == "host"


async def _handle_host_command(
    code: str, sender_id: str, msg_type: str, payload: Any
) -> None:
    if not await _is_host(sender_id):
        return

    if msg_type == "host-mute-all":
        await room_manager.broadcast(
            code, {"type": "force-mute", "from": sender_id}, exclude=sender_id
        )
        return

    if msg_type == "host-remove" and isinstance(payload, dict):
        target = payload.get("participant_id")
        if not isinstance(target, str) or target == sender_id:
            return
        await room_manager.send_to(code, target, {"type": "removed", "from": sender_id})
        # the target's client closes its socket, which triggers the normal
        # disconnect path (mark left + participant-left broadcast)
        return

    if msg_type == "end-meeting":
        async with SessionLocal() as db:
            service = MeetingService(db)
            meeting = await service.repo.get_by_code(code)
            if meeting and meeting.status == MeetingStatus.ACTIVE:
                meeting.status = MeetingStatus.ENDED
                meeting.ended_at = utcnow()
                await db.commit()
        await room_manager.broadcast(code, {"type": "meeting-ended", "from": sender_id})
