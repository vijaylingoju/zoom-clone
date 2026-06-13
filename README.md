# Zoom Clone — Video Conferencing Platform

A functional clone of the **Zoom Workplace web app** — create, join, and schedule
meetings with real WebRTC audio/video, in-meeting chat, screen share, and host
controls. Built for the SDE Fullstack assignment.

- **Live app:** https://zoom-clone-wine-six.vercel.app
- **API:** https://zoom-clone-api-97j1.onrender.com (`/api/health`, `/docs`)
- **Repo:** https://github.com/vijaylingoju/zoom-clone

> The `main` branch is what deploys. `develop` carries the V2 Zoom-Workplace
> redesign; production updates when `develop` is merged into `main`.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16 (App Router, TypeScript strict), Tailwind CSS v4, TanStack Query, lucide-react |
| Backend | Python · FastAPI (async), SQLAlchemy 2.0 (async), Pydantic v2 |
| Database | SQLite (portable to Postgres — see `PLAN.md` §7.3) |
| Real-time | Native WebSocket signaling + mesh WebRTC (`RTCPeerConnection`), STUN |
| Deployment | Frontend → Vercel · Backend → Render (see `docs/DEPLOYMENT.md`) |

The architecture (and its production-scale upgrade paths) is documented in
[`PLAN.md`](PLAN.md); the Zoom Workplace UI replication is in [`PLAN-V2.md`](PLAN-V2.md).

---

## Features

**Core (F1–F4)**
- **Dashboard / Home** — Zoom Workplace shell (icon sidebar, top bar), live clock,
  New meeting / Join / Schedule actions, today's agenda, upcoming + previous meetings.
- **Instant meeting** — unique meeting ID, shareable invite link, redirect into the room.
- **Join** — by meeting ID, Personal Meeting ID, or pasted invite link; validates existence.
- **Schedule** — topic/description, date-time, duration, timezone, passcode, video defaults;
  persisted and shown under Meetings.

**Beyond the brief**
- **Meeting room** — mesh WebRTC video grid, mic/camera toggles, device-permission
  pre-join card, in-meeting **chat** (persisted), **screen share**, participants roster.
- **Personal Meeting ID (PMI)** — a persistent, restartable personal room.
- **Host controls** (bonus) — mute all, remove participant, end meeting for all
  (server-validated against the host role).
- **Responsive** (bonus) — sidebar collapses to a bottom tab bar on mobile;
  Meetings becomes a single-pane list→detail flow.

---

## Local setup

**Prerequisites:** Python 3.12+, Node 20+.

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload          # http://localhost:8000
```
The SQLite database is created and **seeded automatically on startup** (a default
user with a PMI room, plus sample upcoming/previous meetings). API docs at `/docs`.

### Frontend
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev                            # http://localhost:3000
```

### Tests
```bash
cd backend && pytest          # 15 API/service tests
```

---

## Project structure
```
backend/app/
  api/         FastAPI routers (thin — no business logic)
  services/    business rules (MeetingService, code generator)
  repositories/ DB access (SQLAlchemy)
  models/      ORM entities      schemas/  Pydantic DTOs (never leak ORM)
  ws/          WebSocket signaling + in-process room manager
  core/        config, async DB session       seed.py
frontend/
  app/(shell)/ Home, Meetings, Schedule, Join under the Workplace shell
  app/meeting/[code]/  the meeting room (pre-join → room state machine)
  components/  shell · home · meetings · meeting (room)
  lib/         api client · signaling client · webrtc/PeerManager (facade)
  hooks/       useLocalMedia · useMeetingConnection (observer seam)
```
Layering is strict: routers → services → repositories on the backend;
`PeerManager` hides all `RTCPeerConnection` lifecycle from React.

---

## Database schema (SQLite, Postgres-portable)

| Table | Purpose |
|-------|---------|
| `users` | identity anchor (default seeded user; `pmi_code`); nullable password → auth-ready |
| `meetings` | central aggregate: `meeting_code`, `host_id`, type/status state machine, `passcode`, `timezone`, `is_pmi`, `host_key` |
| `meeting_participants` | join-session **log** (one row per join, `left_at` NULL = present) — live roster + history + host-control targets |
| `meeting_settings` | per-meeting toggles (mute-on-entry, video defaults, waiting room) |
| `chat_messages` | in-meeting chat, attributed to a participant |

UUIDv7 primary keys, audit timestamps, soft delete where users can regret.
Full rationale and indexing strategy: `PLAN.md` §3.

---

## Assumptions & known limitations

These are deliberate scoping choices, surfaced honestly:

- **No login (per the brief).** A default user is always "logged in" via a
  `get_current_user()` dependency seam. Because every browser shares that user,
  the **host role is claimed with a secret `host_key`** returned only to the
  meeting's creator (stored in `localStorage`) — so a person you share the link
  with joins as a participant, not a host. Real JWT auth is a one-function swap.
- **Mesh WebRTC** is ideal for small meetings (~4–5 participants); scaling beyond
  that needs an SFU (`PLAN.md` §2.4 / D1). The `PeerManager` facade is the swap point.
- **No TURN server** on the free tier — peers behind strict/symmetric NAT may fail
  to exchange media (signaling/chat still work). Production needs coturn.
- **SQLite on Render is ephemeral** — the DB resets on each deploy/restart and
  re-seeds. Production path is Postgres.
- **Stubbed-by-design UI:** Search, Team Chat tab, More-menu apps, calendar connect,
  Upgrade to Pro, Edit-meeting, and the recurring-meeting / waiting-room options are
  present for Zoom fidelity but non-functional (labelled "Not available in this demo").
- Scheduled **video on/off defaults** are stored but not yet auto-applied on room entry.
- In Next.js dev (StrictMode) a single tab may briefly register two participant rows;
  this does not occur in the production build or across real browsers.

---

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the Render Blueprint, Vercel
settings, environment variables, and free-tier caveats.
