import os
import pathlib

TEST_DB = pathlib.Path(__file__).parent / "test_zoom.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB}"

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    TEST_DB.unlink(missing_ok=True)
    from app.main import app

    with TestClient(app) as c:
        yield c
    TEST_DB.unlink(missing_ok=True)
