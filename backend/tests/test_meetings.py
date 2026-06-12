import re

CODE_PATTERN = re.compile(r"^[a-z2-9]{3}-[a-z2-9]{4}-[a-z2-9]{3}$")


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_me_returns_default_user(client):
    body = client.get("/api/me").json()
    assert body["email"] == "vijay@example.com"
    assert body["is_guest"] is False


def test_create_instant_meeting(client):
    res = client.post("/api/meetings", json={"meeting_type": "instant"})
    assert res.status_code == 201
    body = res.json()
    assert CODE_PATTERN.match(body["meeting_code"])
    assert body["status"] == "active"
    assert body["started_at"] is not None
    assert body["join_url"].endswith(f"/meeting/{body['meeting_code']}")


def test_validate_meeting(client):
    code = client.post("/api/meetings", json={"meeting_type": "instant"}).json()["meeting_code"]
    assert client.get(f"/api/meetings/{code}").status_code == 200
    assert client.get("/api/meetings/zzz-zzzz-zzz").status_code == 404


def test_schedule_meeting_appears_in_upcoming(client):
    res = client.post(
        "/api/meetings",
        json={
            "meeting_type": "scheduled",
            "title": "Roadmap Review",
            "scheduled_start": "2099-01-01T10:00:00Z",
            "duration_minutes": 30,
        },
    )
    assert res.status_code == 201
    upcoming = client.get("/api/meetings/upcoming").json()
    assert "Roadmap Review" in [m["title"] for m in upcoming]


def test_scheduled_meeting_requires_start_and_duration(client):
    res = client.post("/api/meetings", json={"meeting_type": "scheduled", "title": "Bad"})
    assert res.status_code == 422


def test_host_key_only_on_create_response(client):
    created = client.post("/api/meetings", json={"meeting_type": "instant"}).json()
    assert created["host_key"]
    # read endpoints must never leak the host secret
    fetched = client.get(f"/api/meetings/{created['meeting_code']}").json()
    assert "host_key" not in fetched


def test_join_without_host_key_is_participant(client):
    created = client.post("/api/meetings", json={"meeting_type": "instant"}).json()
    join = client.post(
        f"/api/meetings/{created['meeting_code']}/join", json={"display_name": "Guest"}
    )
    assert join.json()["participant"]["role"] == "participant"


def test_chat_history_empty_for_new_meeting(client):
    code = client.post("/api/meetings", json={"meeting_type": "instant"}).json()["meeting_code"]
    res = client.get(f"/api/meetings/{code}/chat")
    assert res.status_code == 200
    assert res.json() == []


def test_join_and_leave_lifecycle(client):
    created = client.post("/api/meetings", json={"meeting_type": "instant"}).json()
    code = created["meeting_code"]

    join = client.post(
        f"/api/meetings/{code}/join",
        json={"display_name": "Vijay", "host_key": created["host_key"]},
    )
    assert join.status_code == 200
    participant = join.json()["participant"]
    assert participant["role"] == "host"  # creator's browser presented the host_key

    leave = client.post(
        f"/api/meetings/{code}/leave", json={"participant_id": participant["id"]}
    )
    assert leave.status_code == 204

    # last participant left an instant meeting -> ended, joining again -> 410
    assert client.get(f"/api/meetings/{code}").json()["status"] == "ended"
    rejoin = client.post(f"/api/meetings/{code}/join", json={"display_name": "Late"})
    assert rejoin.status_code == 410


def test_pmi_seeded_and_startable(client):
    me = client.get("/api/me").json()
    assert me["pmi_code"] and len(me["pmi_code"]) == 10
    created = client.post(
        "/api/meetings", json={"meeting_type": "instant", "use_pmi": True}
    ).json()
    assert created["meeting_code"] == me["pmi_code"]
    assert created["is_pmi"] is True
    assert created["status"] == "active"
    # starting PMI again reuses the same row
    again = client.post(
        "/api/meetings", json={"meeting_type": "instant", "use_pmi": True}
    ).json()
    assert again["id"] == created["id"]


def test_passcode_enforced_on_join(client):
    created = client.post(
        "/api/meetings",
        json={
            "meeting_type": "scheduled",
            "title": "Locked",
            "scheduled_start": "2099-01-01T10:00:00Z",
            "duration_minutes": 30,
            "passcode": "abc123",
        },
    ).json()
    code = created["meeting_code"]
    assert created["join_url"].endswith("?pwd=abc123")
    # public validate must not leak the passcode
    public = client.get(f"/api/meetings/{code}").json()
    assert "passcode" not in public and public["has_passcode"] is True

    no_pwd = client.post(f"/api/meetings/{code}/join", json={"display_name": "G"})
    assert no_pwd.status_code == 403
    wrong = client.post(
        f"/api/meetings/{code}/join", json={"display_name": "G", "passcode": "nope"}
    )
    assert wrong.status_code == 403
    ok = client.post(
        f"/api/meetings/{code}/join", json={"display_name": "G", "passcode": "abc123"}
    )
    assert ok.status_code == 200
    # host bypasses passcode entirely
    host = client.post(
        f"/api/meetings/{code}/join",
        json={"display_name": "H", "host_key": created["host_key"]},
    )
    assert host.status_code == 200
    assert host.json()["participant"]["role"] == "host"


def test_start_and_delete_require_host_key(client):
    created = client.post(
        "/api/meetings",
        json={
            "meeting_type": "scheduled",
            "title": "Mine",
            "scheduled_start": "2099-01-01T10:00:00Z",
            "duration_minutes": 30,
        },
    ).json()
    code = created["meeting_code"]
    assert (
        client.post(f"/api/meetings/{code}/start", json={"host_key": "wrong"}).status_code
        == 403
    )
    started = client.post(
        f"/api/meetings/{code}/start", json={"host_key": created["host_key"]}
    )
    assert started.json()["status"] == "active"

    request = client.request(
        "DELETE", f"/api/meetings/{code}", json={"host_key": created["host_key"]}
    )
    assert request.status_code == 204
    assert client.get(f"/api/meetings/{code}").status_code == 404


def test_previous_alias_matches_recent(client):
    assert client.get("/api/meetings/previous").json() == client.get(
        "/api/meetings/recent"
    ).json()


def test_recent_contains_seeded_and_ended_meetings(client):
    recent = client.get("/api/meetings/recent").json()
    assert len(recent) >= 3
    assert all(m["status"] == "ended" for m in recent)
