from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models import User
from app.seed import DEFAULT_USER_EMAIL


async def get_current_user(db: AsyncSession = Depends(get_db)) -> User:
    """Auth seam (PLAN §2.6 / D5): resolves the seeded default user today;
    swaps to JWT validation without touching any route handler."""
    user = await db.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if user is None:
        raise HTTPException(status_code=500, detail="Default user missing — run seed")
    return user
