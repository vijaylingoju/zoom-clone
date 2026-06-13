from typing import Any

import httpx
from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()

OPEN_RELAY_USER = "openrelayproject"
OPEN_RELAY_CRED = "openrelayproject"

OPEN_RELAY_URLS = [
    "turn:openrelay.metered.ca:80",
    "turn:openrelay.metered.ca:443",
    "turn:openrelay.metered.ca:443?transport=tcp",
    "turns:openrelay.metered.ca:443",
]


def _default_ice_servers() -> list[dict[str, Any]]:
    servers: list[dict[str, Any]] = [
        {"urls": "stun:stun.l.google.com:19302"},
        {"urls": "stun:stun1.l.google.com:19302"},
        {"urls": "stun:stun.cloudflare.com:3478"},
        {"urls": "stun:openrelay.metered.ca:80"},
    ]
    for url in OPEN_RELAY_URLS:
        servers.append({"urls": url, "username": OPEN_RELAY_USER, "credential": OPEN_RELAY_CRED})
    return servers


@router.get("/ice-servers")
async def ice_servers() -> list[dict[str, Any]]:
    """ICE servers for WebRTC. Uses Metered API when configured, else public relay."""
    api_key = settings.metered_turn_api_key
    if api_key:
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

    return _default_ice_servers()
