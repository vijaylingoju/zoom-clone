from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

ParticipantInfo = dict[str, Any]


@dataclass
class RoomPeer:
    ws: WebSocket
    info: ParticipantInfo


@dataclass
class RoomManager:
    """In-process room registry (PLAN D4). The interface is what matters:
    a Redis-backed implementation replaces this class without touching the
    signaling endpoint or the message contract."""

    _rooms: dict[str, dict[str, RoomPeer]] = field(default_factory=dict)

    def add(self, room: str, participant_id: str, ws: WebSocket, info: ParticipantInfo) -> None:
        self._rooms.setdefault(room, {})[participant_id] = RoomPeer(ws, info)

    def remove(self, room: str, participant_id: str) -> None:
        peers = self._rooms.get(room)
        if peers is None:
            return
        peers.pop(participant_id, None)
        if not peers:
            del self._rooms[room]

    def peers(self, room: str, exclude: str | None = None) -> list[ParticipantInfo]:
        return [
            peer.info
            for pid, peer in self._rooms.get(room, {}).items()
            if pid != exclude
        ]

    def update_info(self, room: str, participant_id: str, **changes: Any) -> None:
        peer = self._rooms.get(room, {}).get(participant_id)
        if peer:
            peer.info.update(changes)

    async def send_to(self, room: str, participant_id: str, message: dict[str, Any]) -> None:
        peer = self._rooms.get(room, {}).get(participant_id)
        if peer:
            await peer.ws.send_json(message)

    async def broadcast(
        self, room: str, message: dict[str, Any], exclude: str | None = None
    ) -> None:
        for pid, peer in list(self._rooms.get(room, {}).items()):
            if pid == exclude:
                continue
            try:
                await peer.ws.send_json(message)
            except RuntimeError:
                # connection died mid-broadcast; disconnect handler cleans it up
                continue


room_manager = RoomManager()
