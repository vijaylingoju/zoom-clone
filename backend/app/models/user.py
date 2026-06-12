from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import IdMixin, SoftDeleteMixin, TimestampMixin


class User(Base, IdMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    email: Mapped[str | None] = mapped_column(unique=True)
    name: Mapped[str]
    # Personal Meeting ID: 10 digits, displayed "xxx xxx xxxx" (PLAN-V2 §3)
    pmi_code: Mapped[str | None] = mapped_column(unique=True)
    password_hash: Mapped[str | None]
    avatar_url: Mapped[str | None]
    is_guest: Mapped[bool] = mapped_column(default=False)
