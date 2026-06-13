import json
from typing import Any
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Zoom Clone API"
    database_url: str = "sqlite+aiosqlite:///./zoom_clone.db"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3010"]
    frontend_base_url: str = "http://localhost:3010"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            # Split by comma if not valid JSON array
            return [x.strip() for x in v.split(",") if x.strip()]
        return v


settings = Settings()
