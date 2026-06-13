from typing import Any

import httpx
from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()

DEFAULT_ICE_SERVERS: list[dict[str, Any]] = [
    {"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]},
    {"urls": "stun:openrelay.metered.ca:80"},
    {
        "urls": [
            "turn:openrelay.metered.ca:80",
            "turn:openrelay.metered.ca:443",
            "turn:openrelay.metered.ca:443?transport=tcp",
            "turns:openrelay.metered.ca:443",
        ],
        "username": "openrelayproject",
        "credential": "openrelayproject",
    },
]


@router.get("/ice-servers")
async def ice_servers() -> list[dict[str, Any]]:
    """ICE servers for WebRTC. Uses Metered API when configured, else public relay."""
    api_key = settings.metered_turn_api_key
    if not api_key:
        return DEFAULT_ICE_SERVERS

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                "https://openrelay.metered.ca/api/v1/turn/credentials",
                params={"apiKey": api_key},
            )
            if response.status_code == 200:
                payload = response.json()
                if isinstance(payload, list) and payload:
                    return payload
    except httpx.HTTPError:
        pass

    return DEFAULT_ICE_SERVERS
