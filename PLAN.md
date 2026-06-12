# Zoom Clone — Architecture & Implementation Plan

> **Assignment:** Video Conferencing Platform (Zoom Clone) — SDE Fullstack
> **Stack (mandated):** Next.js (SPA) · Python FastAPI · SQLite
> **Timeline:** 1 day
>
> This document is split into two designs that share one schema and one mental model:
>
> 1. **Production Architecture (Ideal Design)** — how this system should look at millions of users.
> 2. **One-Day Assignment Implementation (Practical Design)** — what gets built today.
>
> The one-day build is a deliberate subset of the production design, so every shortcut has a named upgrade path (see §7).

---

## 1. Requirements Analysis

### 1.1 Core features (must ship today)

| # | Feature | Notes |
|---|---------|-------|
| F1 | Landing dashboard | Zoom-style UI, navbar, New/Join/Schedule buttons, Upcoming + Recent meeting lists |
| F2 | Instant meeting | Unique meeting ID, shareable invite link, redirect to room |
| F3 | Join meeting | By ID or link, display-name prompt, validate meeting exists |
| F4 | Schedule meeting | Title/description, date-time picker, duration, auto link, persisted, shown in Upcoming |

### 1.2 Bonus features

- Responsive design (mobile/tablet/desktop)
- User authentication (login/signup)
- Host controls (mute all, remove participant)

### 1.3 Implicit requirements (read between the lines)

- A **meeting room** UI with video tiles, mic/camera toggles, leave button — without it the app doesn't "feel like Zoom" even though the doc never says "implement WebRTC".
- **Seed data** so the dashboard isn't empty on first load.
- **Default logged-in user** — auth is faked, but the schema must support real auth later (it's evaluated).
- **Database design is explicitly evaluated** → schema must be production-shaped even if the app is small.

### 1.4 Out of scope today (but schema must not block them)

Recordings, breakout rooms, waiting rooms, recurring meetings, organizations/teams, calendar integration, dial-in, live transcription.

---

## 2. Production Architecture (Ideal Design)

### 2.1 High-level architecture diagram (text)

```
                                ┌──────────────────────────────────────────────┐
                                │                   CLIENTS                    │
                                │   Browser (Next.js SPA) · Mobile · Desktop   │
                                └───────┬──────────────┬───────────────┬───────┘
                                        │ HTTPS        │ WSS           │ SRTP/DTLS (UDP)
                                        ▼              ▼               ▼
┌──────────────┐              ┌─────────────────────────────┐   ┌─────────────────────┐
│  CDN / Edge  │◄────────────►│   API Gateway / LB (L7)     │   │  Media Edge (SFU)   │
│ (static SPA) │              │  TLS, rate limit, WAF       │   │  geo-routed pools   │
└──────────────┘              └──────┬───────────┬──────────┘   └──────────┬──────────┘
                                     │           │                         │
                          ┌──────────▼───┐  ┌────▼─────────────┐  ┌────────▼─────────┐
                          │  REST API    │  │ Signaling Service│  │ SFU cluster      │
                          │  (FastAPI,   │  │ (WebSocket,      │  │ (mediasoup /     │
                          │  stateless,  │  │  stateless,      │  │  LiveKit/Janus)  │
                          │  N replicas) │  │  N replicas)     │  │ + TURN (coturn)  │
                          └──┬───────┬───┘  └────┬─────────────┘  └────────┬─────────┘
                             │       │           │                         │
                             │  ┌────▼───────────▼────┐           ┌────────▼─────────┐
                             │  │  Redis              │           │ Recording workers│
                             │  │  pub/sub · presence │           │ (composite → S3) │
                             │  │  cache · rate limits│           └──────────────────┘
                             │  └─────────────────────┘
                   ┌─────────▼──────────┐     ┌───────────────────┐
                   │ PostgreSQL (primary│     │ Async workers     │
                   │ + read replicas)   │     │ (Celery/ARQ):     │
                   └─────────┬──────────┘     │ emails, webhooks, │
                             │                │ cleanup, analytics│
                   ┌─────────▼──────────┐     └───────────────────┘
                   │ Observability:     │
                   │ Prometheus·Grafana │
                   │ Loki · Sentry ·    │
                   │ OpenTelemetry      │
                   └────────────────────┘
```

Three independent planes, each scaling on its own axis:

1. **Control plane (REST API):** CRUD for users/meetings, auth, scheduling. CPU-light, scales with user count.
2. **Signaling plane (WebSocket):** room membership, SDP/ICE relay, presence, host commands, chat. Connection-count bound, scales with *concurrent* participants.
3. **Media plane (SFU + TURN):** audio/video packets. Bandwidth/CPU bound, scales with concurrent *streams* — by far the most expensive plane, which is exactly why it must be separable from the other two.

### 2.2 Frontend architecture

- **Next.js (App Router) as an SPA** per the assignment; in production, keep the dashboard/auth/schedule pages SSR-able for fast first paint, but the meeting room is strictly client-side (`"use client"`) — media APIs only exist in the browser.
- **Layering:**
  - `app/` — routes: `/` (dashboard), `/join`, `/schedule`, `/meeting/[code]`, `/auth/*`
  - `components/ui` — dumb presentational pieces (buttons, modals, tiles)
  - `components/meeting` — room-specific composites (VideoGrid, ControlBar, ParticipantsPanel, ChatPanel)
  - `lib/api` — typed REST client (single fetch wrapper, error normalization)
  - `lib/webrtc` — `PeerManager` class isolating all RTCPeerConnection logic from React
  - `lib/signaling` — WebSocket client with reconnect + message contracts
  - `hooks/` — `useMediaDevices`, `useMeeting`, `useParticipants`
- **State management:** server state via TanStack Query (meetings lists, caching/invalidation); in-room ephemeral state (participants, streams, mute flags) via a Zustand store fed by signaling events. No global store for things the server owns.
- **Why this split matters:** WebRTC objects (`RTCPeerConnection`, `MediaStream`) are imperative and lifecycle-sensitive; trapping them in React state causes renegotiation bugs. The `PeerManager` owns them and emits plain serializable state to React.

### 2.3 Backend architecture

- **FastAPI, stateless, horizontally scaled** behind an L7 load balancer.
- **Service layout (modular monolith first, split later):**
  - `api/` — routers (`auth`, `users`, `meetings`, `participants`)
  - `services/` — business logic (MeetingService, RoomService), no HTTP types
  - `repositories/` — DB access (SQLAlchemy), no business logic
  - `ws/` — signaling endpoint + room manager
  - `core/` — config, security, DB session, middleware
  - `models/` + `schemas/` — SQLAlchemy entities vs Pydantic DTOs (never leak ORM models over the wire)
- **Why modular monolith, not microservices on day one:** the seams (routers→services→repos) are the future service boundaries; you split signaling out first (different scaling profile), then recordings. Splitting earlier buys operational cost with no benefit.
- **Async everywhere:** FastAPI + async SQLAlchemy + asyncpg so one worker holds thousands of idle WebSocket connections.

### 2.4 Real-time communication architecture

Two distinct real-time channels, never conflated:

1. **Signaling (WebSocket, JSON):** join/leave, SDP offers/answers, ICE candidates, mute state, host commands, chat. Low bandwidth, must be ordered and reliable.
2. **Media (WebRTC, SRTP over UDP):** audio/video. High bandwidth, loss-tolerant, latency-critical. Never touches the app servers in production — it flows client ↔ SFU.

**Production topology — SFU (Selective Forwarding Unit):**
- Each client uploads one stream to the SFU; the SFU forwards to N subscribers. Upload cost per client is O(1) instead of O(N) in a mesh.
- Simulcast (each client sends 3 quality layers); SFU picks per-subscriber layer based on bandwidth estimation (REMB/transport-cc).
- **TURN (coturn)** for the ~8–15% of clients behind symmetric NAT/strict firewalls; STUN for the rest.
- Cross-region: clients connect to nearest SFU; SFUs cascade for multi-region meetings.
- Recommended: **LiveKit (self-hosted) or mediasoup** rather than writing an SFU — SFU correctness (congestion control, layer switching) is a multi-year project.

**Topology limits to know cold (likely interview question):**
- Mesh P2P: fine ≤ 4–5 participants (upload = (N−1) × bitrate).
- SFU: 5 – ~10,000 (Zoom's actual model).
- MCU (server mixes into one stream): legacy/dial-in only; CPU cost is brutal.

### 2.5 Database architecture (production)

- **PostgreSQL** primary + read replicas. Dashboard reads (upcoming/recent lists) go to replicas; writes and join-validation go to primary.
- **Redis** in front for: meeting-code→meeting lookup cache (the hottest read), presence/room state, signaling pub/sub between WS nodes, rate-limit counters.
- **Partitioning plan:** `meeting_events` and `chat_messages` are append-only and unbounded → time-partition (monthly), archive to object storage after 90 days. Core tables (`users`, `meetings`) stay unpartitioned far longer than people expect (hundreds of millions of rows is fine on Postgres with correct indexes).
- **IDs:** UUIDv7 (time-ordered → index-friendly) for PKs; a separate human-typeable `meeting_code` for join flows. Never expose sequential integers (enumeration attacks, shard-hostile).

### 2.6 Authentication & authorization flow

```
Signup/Login ──► API validates (argon2id hash) ──► issues:
   • access JWT (15 min, in memory)          • refresh token (30 d, httpOnly Secure cookie,
                                               rotated on use, stored hashed in DB → revocable)

REST:       Authorization: Bearer <access JWT>  → middleware validates, loads claims
WebSocket:  short-lived (60 s) one-time WS ticket fetched via REST, passed at connect
            (avoids long-lived JWTs in query strings / logs)
Media:      SFU access via signed room token (LiveKit-style JWT: room, identity, grants)
```

**Authorization model:**
- Roles per meeting, not global: `host` / `cohost` / `participant` (stored on `meeting_participants.role`).
- Host commands (mute-all, remove, end-meeting) are validated **server-side in the signaling service** against the DB/Redis role — never trusted from the client payload.
- Guests: rows in `users` with `is_guest = true`, no credentials — one identity model for everyone, so chat/participant FKs never need a "user OR guest" polymorphism.

**Assignment mode:** a seeded default user; every request resolves to it via a stub `get_current_user()` dependency. Swapping the stub for real JWT validation is a one-function change — that's the whole point of putting it behind a FastAPI dependency.

### 2.7 Media / WebRTC flow (end-to-end)

```
1. Client hits /meeting/abc-123 → preview lobby: getUserMedia(), device pickers, name entry
2. REST: GET /api/meetings/abc-123 → validates existence/status (404/410 handled in UI)
3. REST: POST /api/meetings/abc-123/join → creates participant row, returns participant_id + WS ticket
4. WSS connect → server adds to room, sends roster; broadcasts participant-joined
5. For each existing peer (mesh) / with SFU (prod): createOffer → setLocalDescription
   → send {type:"offer", to, sdp} over WS → answer comes back → setRemoteDescription
6. ICE candidates trickle both ways over WS; STUN (and TURN in prod) gather candidates
7. DTLS handshake → SRTP flows; ontrack fires → stream attached to <video> tile
8. Mute/camera-off: track.enabled = false + WS state broadcast (UI badges for others)
9. Leave/close: WS disconnect → server marks left_at, broadcasts participant-left
   → peers close the matching RTCPeerConnection and drop the tile
10. Last participant leaves an instant meeting → status = ended, ended_at set
```

### 2.8 Signaling server design

- **Protocol:** JSON envelopes `{type, from, to?, payload}`. Targeted messages (`offer`, `answer`, `ice`) are relayed only to `to`; broadcasts (`participant-joined`, `mute-state`, `chat`) fan out to the room.
- **Message catalog:** `join`, `roster`, `participant-joined`, `participant-left`, `offer`, `answer`, `ice-candidate`, `media-state`, `chat`, `host-mute-all`, `host-remove`, `meeting-ended`, `error`.
- **Room state:** in production lives in **Redis** (`room:{code}` hash + pub/sub channel per room), so any WS node can serve any participant; nodes are stateless and disposable. Assignment version: an in-process `dict[str, dict[str, WebSocket]]` — identical message contract, different state store.
- **Connection hygiene:** heartbeat ping/pong every 20 s; missed pongs → treat as left (and broadcast), preventing ghost participants. Client reconnects with backoff and re-issues `join` (server treats it as idempotent rejoin).
- **Ordering/duplication:** signaling messages carry monotonic per-sender sequence numbers in production; SDP glare resolved by "polite peer" pattern (lexicographically lower participant_id is polite).

### 2.9 Deployment architecture

**Production:**
- SPA → CDN (CloudFront/Vercel edge). API + signaling → containers on Kubernetes/ECS, separate deployments (independent autoscaling: API on CPU, signaling on connection count). SFU pool on network-optimized VMs (host networking, not behind the L7 LB — UDP). coturn on public IPs. Postgres managed (RDS/Cloud SQL) + PgBouncer. Redis managed (ElastiCache). IaC (Terraform), CI/CD with migrations gated before deploy, blue/green for API, connection-draining rollouts for signaling.

**Assignment deployment:**
- Frontend → **Vercel** (Next.js native).
- Backend (REST + WS + SQLite file) → **Render** single service.
- CORS pinned to the Vercel origin; `NEXT_PUBLIC_API_URL` env var on Vercel.
- Caveat to document in README: Render free tier has ephemeral disk (SQLite resets on redeploy — acceptable, re-seeded on boot) and cold starts (~30 s first hit).

---

## 3. Database Design

> Designed once, used by both versions. SQLite today, Postgres later — types and constraints chosen to port cleanly (TEXT UUIDs, ISO-8601 UTC timestamps, CHECK-constrained enums). Tables 1–5 are built today; tables in §3.6 are production extensions validated against this core.

### 3.1 ERD (text)

```
┌─────────────┐ 1     N ┌──────────────────┐ 1      N ┌────────────────────────┐
│   users     │◄────────│    meetings      │◄─────────│  meeting_participants  │
│─────────────│ host_id │──────────────────│meeting_id│────────────────────────│
│ id PK       │         │ id PK            │          │ id PK                  │
│ email UQ    │         │ meeting_code UQ  │          │ meeting_id FK          │
│ name        │         │ host_id FK       │          │ user_id FK (nullable)  │
│ password_h. │         │ title            │          │ display_name           │
│ avatar_url  │         │ description      │          │ role                   │
│ is_guest    │         │ meeting_type     │          │ joined_at / left_at    │
│ created_at  │         │ status           │          │ is_muted / video_off   │
│ updated_at  │         │ scheduled_start  │          └───────────┬────────────┘
│ deleted_at  │         │ duration_minutes │                      │ 1
└──────┬──────┘         │ started_at       │                      │
       │ 1              │ ended_at         │                      ▼ N
       │                │ passcode_hash    │          ┌────────────────────────┐
       │                │ created_at       │ 1      N │     chat_messages      │
       │                │ updated_at       │◄─────────│────────────────────────│
       │                │ deleted_at       │meeting_id│ id PK                  │
       │                └────────┬─────────┘          │ meeting_id FK          │
       │ N                       │ 1                  │ participant_id FK      │
       ▼                         ▼ 1                  │ content                │
users.id ◄── meeting_participants.user_id  ┌──────────│ created_at             │
                                           │          │ deleted_at             │
                              ┌────────────▼─────┐    └────────────────────────┘
                              │ meeting_settings │
                              │──────────────────│    Production extensions (§3.6):
                              │ meeting_id PK/FK │    organizations, refresh_tokens,
                              │ mute_on_entry    │    recordings, meeting_events,
                              │ allow_chat       │    recurrence_rules
                              │ allow_screenshare│
                              │ waiting_room     │
                              └──────────────────┘
```

Relationships: `users 1—N meetings` (as host) · `meetings 1—N meeting_participants` · `users 1—N meeting_participants` (optional — guests have NULL) · `meetings 1—1 meeting_settings` · `meetings 1—N chat_messages` · `meeting_participants 1—N chat_messages`.

### 3.2 Table definitions

#### `users`

```sql
CREATE TABLE users (
    id            TEXT PRIMARY KEY,                  -- UUIDv7
    email         TEXT UNIQUE,                       -- NULL for guests
    name          TEXT NOT NULL,
    password_hash TEXT,                              -- NULL: guest or OAuth-only
    avatar_url    TEXT,
    is_guest      INTEGER NOT NULL DEFAULT 0,        -- BOOLEAN in Postgres
    created_at    TEXT NOT NULL,                     -- ISO-8601 UTC
    updated_at    TEXT NOT NULL,
    deleted_at    TEXT                               -- soft delete
);
```

- **Why it exists:** identity anchor for hosting, participation, chat, and future auth/orgs. Exists today (despite "no login") because the default user, hosts, and participant attribution all need a stable FK target — retrofitting identity later is the most painful migration there is.
- **Fields:** `email` nullable+unique because guests have none but registered users must be unique; `password_hash` nullable so guest/OAuth/password users share one table (avoids polymorphic identity); `is_guest` lets cleanup jobs and UI distinguish ephemeral identities; `avatar_url` is cheap now and the dashboard navbar wants it.
- **Growth:** slow-linear with registrations + one row per guest join (guests pruned by retention job). Even at 100M rows, fine with the indexes below.
- **Query patterns:** PK lookup on every authenticated request; `email` lookup at login; never scanned.

#### `meetings`

```sql
CREATE TABLE meetings (
    id               TEXT PRIMARY KEY,
    meeting_code     TEXT NOT NULL UNIQUE,           -- e.g. "abc-defg-hjk", human-typeable
    host_id          TEXT NOT NULL REFERENCES users(id),
    title            TEXT NOT NULL DEFAULT 'Instant Meeting',
    description      TEXT,
    meeting_type     TEXT NOT NULL CHECK (meeting_type IN ('instant','scheduled')),
    status           TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','active','ended','cancelled')),
    scheduled_start  TEXT,                           -- NULL for instant
    duration_minutes INTEGER,
    started_at       TEXT,
    ended_at         TEXT,
    passcode_hash    TEXT,                           -- future: meeting passcodes
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    deleted_at       TEXT
);
```

- **Why it exists:** the central aggregate — every assignment feature (create, join, schedule, list) is a query against it.
- **Fields:** `id` vs `meeting_code` are deliberately separate — the code is the public, typeable, *rotatable* identifier (security: leaked link can be re-keyed without breaking FKs); `meeting_type` because instant and scheduled meetings share a lifecycle but differ in dashboard placement; `status` is an explicit state machine (`scheduled→active→ended` / `→cancelled`) instead of inferring state from timestamps — inference breaks on no-show meetings; `scheduled_start`+`duration_minutes` drive the Upcoming list; `started_at`/`ended_at` record *actual* lifecycle for the Recent list and future analytics; `passcode_hash` reserved (cheap column, avoids a migration for a known Zoom feature).
- **Growth:** highest-volume core table — proportional to usage (instant meetings dominate). Ended instant meetings are archivable after retention.
- **Query patterns:** `WHERE meeting_code = ?` on every join (hottest query, unique index); `WHERE host_id = ? AND status='scheduled' AND scheduled_start > now ORDER BY scheduled_start` (Upcoming); `WHERE host_id = ? AND status='ended' ORDER BY ended_at DESC LIMIT 10` (Recent).

#### `meeting_participants`

```sql
CREATE TABLE meeting_participants (
    id           TEXT PRIMARY KEY,
    meeting_id   TEXT NOT NULL REFERENCES meetings(id),
    user_id      TEXT REFERENCES users(id),          -- NULL = pure guest
    display_name TEXT NOT NULL,                      -- captured at join time
    role         TEXT NOT NULL DEFAULT 'participant'
                 CHECK (role IN ('host','cohost','participant')),
    joined_at    TEXT NOT NULL,
    left_at      TEXT,                               -- NULL = currently in room
    is_muted     INTEGER NOT NULL DEFAULT 0,
    is_video_off INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);
```

- **Why it exists:** the N:M bridge between users and meetings, but modeled as a **join-session log**, not a membership set — one row per join event, because "who was in this meeting, when, as what" is the question host controls, attendance reports, and billing all ask.
- **Fields:** `display_name` snapshotted here (not joined from `users`) because the assignment requires a per-meeting chosen name, and historically a participant list must show the name *used in that meeting* even if the profile is later renamed; `role` per-meeting (a user is host of one meeting, participant in another — global roles are wrong); `left_at` NULL-means-present gives live roster *and* history from one table; `is_muted`/`is_video_off` persist state for late joiners' roster rendering and host mute-all.
- **Growth:** fastest-growing core table (~5–10× meetings). Time-partition in Postgres when needed.
- **Query patterns:** `WHERE meeting_id=? AND left_at IS NULL` (live roster, partial index); `WHERE meeting_id=?` (history); `WHERE user_id=? ORDER BY joined_at DESC` (a user's recent activity).

#### `meeting_settings`

```sql
CREATE TABLE meeting_settings (
    meeting_id         TEXT PRIMARY KEY REFERENCES meetings(id),
    mute_on_entry      INTEGER NOT NULL DEFAULT 0,
    allow_chat         INTEGER NOT NULL DEFAULT 1,
    allow_screen_share INTEGER NOT NULL DEFAULT 1,
    waiting_room       INTEGER NOT NULL DEFAULT 0,
    updated_at         TEXT NOT NULL
);
```

- **Why it exists (vs columns on `meetings`):** settings grow without bound (Zoom has ~50); isolating them keeps the hot `meetings` row narrow, lets settings churn without touching meeting row locks, and gives a natural place for org-level setting inheritance later. 1:1 with PK=FK enforces the cardinality in the schema itself.
- **Growth:** exactly tracks `meetings`. **Queries:** PK fetch at room load; updated from host settings panel.

#### `chat_messages`

```sql
CREATE TABLE chat_messages (
    id             TEXT PRIMARY KEY,
    meeting_id     TEXT NOT NULL REFERENCES meetings(id),
    participant_id TEXT NOT NULL REFERENCES meeting_participants(id),
    content        TEXT NOT NULL,
    created_at     TEXT NOT NULL,
    deleted_at     TEXT                               -- moderation
);
```

- **Why it exists:** in-meeting chat is core Zoom UX (built today if time allows; table designed regardless). FK to `meeting_participants` (not `users`) so guest messages attribute correctly and the displayed name is the in-meeting name.
- **Growth:** unbounded append-only — first table to partition by time and archive. **Queries:** `WHERE meeting_id=? ORDER BY created_at` only; never queried across meetings.

### 3.3 Indexing strategy

```sql
-- users
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

-- meetings
CREATE UNIQUE INDEX idx_meetings_code      ON meetings(meeting_code);
CREATE INDEX idx_meetings_host_upcoming    ON meetings(host_id, status, scheduled_start);
CREATE INDEX idx_meetings_host_recent      ON meetings(host_id, status, ended_at);

-- meeting_participants
CREATE INDEX idx_participants_active ON meeting_participants(meeting_id)
    WHERE left_at IS NULL;                            -- partial: live roster only
CREATE INDEX idx_participants_meeting ON meeting_participants(meeting_id, joined_at);
CREATE INDEX idx_participants_user    ON meeting_participants(user_id, joined_at);

-- chat_messages
CREATE INDEX idx_chat_meeting ON chat_messages(meeting_id, created_at);
```

Principles: every index maps to a named query in §3.2 — no speculative indexes (writes pay for them). Composite indexes ordered equality→range to satisfy `WHERE` + `ORDER BY` in one scan. Partial index on the live roster keeps it tiny regardless of history size. FKs indexed because both SQLite and Postgres don't auto-index them.

### 3.4 Audit fields & soft delete

- **Every table:** `created_at`, `updated_at` (set in the service layer, UTC ISO-8601). Mutable user-facing tables add `deleted_at`.
- **Soft delete where users can regret** (`users`, `meetings`, `chat_messages`): "delete meeting" from a dashboard must be recoverable, and FKs from participants/chat must not dangle. All list queries filter `deleted_at IS NULL` (enforced via a default repository filter, not per-query discipline). Hard-delete via retention jobs (e.g., guests + ended instant meetings after 90 days) to honor data-minimization.
- **No soft delete** on `meeting_participants` (it *is* the audit log — rows are never deleted, `left_at` is the lifecycle) or `meeting_settings` (lifecycle bound to its meeting).
- **Production addition:** `meeting_events(id, meeting_id, actor_participant_id, event_type, payload_json, created_at)` — append-only audit of joins/leaves/mutes/removals for compliance and "who removed me" disputes. Skipped today; nothing in the core schema blocks it.

### 3.5 Meeting code design

Format `xxx-xxxx-xxx` from an unambiguous lowercase alphabet (no `0/o/1/l`), ~28 chars effective → 28¹⁰ ≈ 3×10¹⁴ codes: typeable like Zoom's numeric IDs but resistant to enumeration scanning (random 10-digit numeric IDs are not — Zoom learned this publicly in 2020). Generated with collision retry on the unique index (statistically negligible).

### 3.6 Production extension tables (designed, not built today)

| Table | Purpose | Key fields | Core schema impact |
|---|---|---|---|
| `refresh_tokens` | revocable sessions | user_id FK, token_hash, expires_at, revoked_at, device | none — additive |
| `organizations` + `org_members` | teams/enterprise | org_id on users? No — membership table; `meetings.org_id` nullable | one nullable FK |
| `recordings` | cloud recording | meeting_id FK, storage_url, status, duration, size | none — additive |
| `meeting_events` | audit log (§3.4) | append-only | none — additive |
| `recurrence_rules` | recurring meetings | meeting_id FK, RRULE text, until | occurrences materialized into `meetings` rows by a worker — Upcoming query unchanged |

This is the schema-validation test: every roadmap feature lands as a **new table + at most a nullable FK** — no core-table rewrites. ✅

---

## 4. Production Readiness Thinking

### 4.1 Scalability concerns

- **Media is 95%+ of cost.** Scale planes independently (§2.1). SFU pools autoscale on stream count; API on CPU; signaling on connections.
- **WebSocket fan-out:** N participants → O(N²) signaling messages per state change in naive broadcast. Redis pub/sub per room + per-node connection registries keep any node able to serve any client; sticky sessions not required.
- **DB:** read replicas absorb dashboard traffic (read-heavy ~10:1); Redis absorbs the meeting-code-lookup hot path; PgBouncer because thousands of async workers will exhaust raw Postgres connections.
- **Large meetings (100+):** stop full-mesh signaling assumptions — paginate video subscriptions (only visible tiles subscribed), roster diffs instead of full rosters, audio-active speaker detection server-side.

### 4.2 Performance bottlenecks (ranked)

1. **SFU bandwidth/CPU** — the bill and the bottleneck; simulcast + layer selection is the lever.
2. **Join stampede** (meeting start = thundering herd on code lookup + participant insert + roster broadcast) — cache the meeting row, batch roster broadcasts (50 ms coalescing window).
3. **TURN relay traffic** — relayed media costs real egress; monitor relay ratio, place TURN near users.
4. **Dashboard queries at scale** — solved by indexes in §3.3 + replica reads + short-TTL cache.
5. **WS heartbeat storms** — jitter the ping schedule.

### 4.3 Caching opportunities

| What | Where | TTL / invalidation |
|---|---|---|
| meeting_code → meeting | Redis | 60 s + bust on status change (hottest key) |
| Live roster | Redis (source of truth in-room) | event-driven |
| Upcoming/Recent lists | Redis per-user | 30 s + bust on meeting create/end |
| Static SPA, avatars | CDN | content-hashed, immutable |
| STUN/TURN credentials | client memory | per-session |

Deliberately **not** cached: join validation result at the authorization step (must see revocations immediately).

### 4.4 Real-time communication challenges

- **NAT traversal:** STUN first, TURN fallback; without TURN ~10% of users silently fail — the classic "works on my machine" WebRTC bug.
- **SDP glare** (both peers offer simultaneously): polite-peer pattern, deterministic by participant ID ordering.
- **Reconnection:** distinguish blip (keep participant row, ICE restart) from departure (left_at) via a 15 s grace window in signaling.
- **Ghost participants:** heartbeat timeout → forced leave broadcast (§2.8).
- **Quality adaptation:** simulcast + bandwidth estimation; expose connection-quality indicator per tile (users blame the app otherwise).
- **Clock skew:** all ordering by server timestamps/sequence numbers, never client clocks.

### 4.5 Database optimization strategies

Covered by design: covering composite indexes (§3.3), partial index for live rosters, time-partitioning for append-only tables, UUIDv7 (insert-ordered, no index fragmentation), narrow hot rows (settings split out), repository-level `deleted_at` filters so indexes can be partial on live rows. Operational: `EXPLAIN ANALYZE` budgets in CI for the 5 named queries; slow-query log → dashboard; archive jobs, not unbounded retention.

### 4.6 Security considerations

- **Meeting access:** high-entropy codes (§3.5) + optional passcode + waiting room (schema-ready) — the anti-Zoombombing stack.
- **AuthZ on the server:** every host command re-checks `role` server-side (§2.6); WS messages validated against a schema, `from` field always overwritten by the server (never trust client identity claims).
- **Transport:** TLS everywhere; WebRTC is encrypted by default (DTLS-SRTP); E2EE (insertable streams) is the long-term differentiator, noting it breaks server-side recording.
- **Input handling:** Pydantic validation on every REST/WS payload; chat rendered as text (no HTML injection); meeting titles length-capped.
- **Secrets/passwords:** argon2id; refresh tokens stored hashed; no tokens in URLs except the 60 s one-time WS ticket.
- **SQLite-specific today:** parameterized queries via SQLAlchemy (no string SQL anywhere).

### 4.7 Rate limiting requirements

| Surface | Limit (starting point) | Why |
|---|---|---|
| Meeting create | 10/min/user | spam + code-space pollution |
| Join attempts | 10/min/IP per code, 30/min/IP global | brute-force scanning of codes |
| Auth endpoints | 5/min/IP + exponential lockout | credential stuffing |
| Chat messages | 5/s/participant | flood |
| WS connects | 10/min/IP | reconnect storms vs abuse |
| Global API | 100/min/user token bucket | backstop |

Redis token buckets at the gateway; 429 + `Retry-After`; per-user where authenticated, per-IP otherwise. Assignment version: none (documented as a gap), or SlowAPI on create/join if time allows.

### 4.8 Monitoring & observability

- **Golden signals per plane:** API (p50/p95/p99, error rate), signaling (concurrent conns, join latency, reconnect rate), media (packet loss, jitter, RTT, TURN-relay %, per-SFU stream count).
- **Product metrics:** time-to-first-video (the metric users feel), join success rate, meeting duration distribution, ghost-participant rate.
- **Stack:** OpenTelemetry traces (REST → service → DB; WS join → roster broadcast), Prometheus + Grafana, Sentry (frontend + backend — frontend Sentry is where WebRTC bugs surface), structured JSON logs with `meeting_id`/`participant_id` on every line, Loki.
- **Alerting on symptoms not causes:** join success < 99%, TTFV p95 > 3 s, TURN relay > 20%, WS reconnect spike.
- **WebRTC-specific:** sample `getStats()` from clients every 10 s → analytics pipeline; this is how you debug "my video froze" reports.

---

## 5. Design Decisions & Trade-offs

### D1 — Mesh P2P today, SFU in production
**Chosen because:** zero media-server infrastructure (deployable on free tiers in a day); WebRTC API experience is identical from the client's perspective; assignment demos are 2–4 people where mesh is actually *optimal* (lowest latency, no server hop).
**Alternatives:** SFU from day one (LiveKit cloud) — better scaling, but external dependency, API keys, and the assignment evaluates *my* implementation; MCU — obsolete for this use case.
**Trade-off accepted:** mesh caps at ~4–5 participants and uploads N−1 copies. **Migration cost contained by:** `PeerManager` abstraction — swapping mesh for SFU touches one client module and the signaling message set, not the React tree or the schema.

### D2 — Single FastAPI service hosting REST + WebSocket today; separate signaling service in production
**Chosen because:** one deployable, one port, shared models — maximal velocity for a day.
**Alternative:** separate signaling process now — cleaner, but doubles deploy/config surface for zero demo benefit.
**Trade-off:** REST latency and WS connections compete for the same workers; fine at demo scale. The `ws/` module boundary *is* the future service boundary — extraction is a deploy change, not a rewrite.

### D3 — SQLite today, PostgreSQL in production
**Mandated by the assignment**, but also right: zero-config, single file, perfect for seed-data demos.
**Trade-off:** single-writer (WAL mode mitigates), no replication, ephemeral on free-tier hosts. **Contained by:** SQLAlchemy + Alembic from day one, portable types (§3) — the Postgres migration is a connection-string change plus an Alembic run.

### D4 — In-memory room state today, Redis in production
**Chosen because:** a dict is correct for one process; Redis adds an infra dependency the demo doesn't need.
**Trade-off:** restarts drop rooms (clients auto-rejoin via reconnect logic, §2.8); can't scale past one signaling node. The `RoomManager` interface is written against, so the Redis implementation is a drop-in.

### D5 — Stubbed default user behind a real dependency-injection seam
**Chosen because:** the assignment says "assume a default user"; but burying that assumption inside route handlers would make auth a rewrite. `get_current_user()` as a FastAPI dependency makes real JWT auth a one-function swap, and the schema (nullable `password_hash`, `is_guest`) is already auth-shaped.
**Alternative:** building real auth today — it's a listed bonus, but it's the *lowest* value-per-hour item (see §6 priorities); UI fidelity and a working room are evaluated harder.

### D6 — `meeting_code` separate from PK
**Chosen because:** public identifiers must be rotatable, typeable, and non-enumerable; PKs must be stable and FK-friendly. Conflating them (Zoom's early numeric IDs as the only key) caused real-world meeting-scanning attacks.
**Trade-off:** one extra unique index and a generate-with-retry loop. Negligible.

### D7 — Participant rows as join-session log, not membership set
**Chosen because:** answers live roster, attendance history, and host-control targets from one table; an UPSERT-style membership set destroys history.
**Trade-off:** more rows (rejoins create new rows) and "current participants" needs the partial index. Accepted — storage is cheap, history is not reconstructible.

### D8 — Next.js App Router with client-side meeting room
**Chosen because:** mandated stack; App Router is current best practice; room must be CSR anyway (media APIs).
**Trade-off:** App Router + WebRTC has hydration foot-guns — mitigated by `"use client"` boundaries and dynamic import with `ssr: false` for the room.

### D9 — Plain WebSocket (JSON contract) over Socket.IO
**Chosen because:** FastAPI WS support is native; Socket.IO adds a protocol layer and a Python server dependency (`python-socketio`) for features (rooms, acks, fallbacks) that are ~50 lines to hand-roll here, and hand-rolling them is exactly the understanding the interview tests.
**Trade-off:** I own reconnect/heartbeat logic. Accepted and specified (§2.8).

---

## 6. Final Architecture Review

### 6.1 Weaknesses identified (honest list)

1. **One-day version is single-node-stateful** (in-memory rooms + SQLite): a backend restart drops live meetings. *Mitigation today:* client auto-rejoin. *Real fix:* D4/D3 swaps.
2. **No TURN today:** users behind symmetric NAT can't connect media. Acceptable for a demo (documented in README); production needs coturn before any real launch.
3. **Mesh ceiling (~4 participants)** — D1; the most important "how would you scale this" interview answer.
4. **No rate limiting today** → meeting-code scanning is theoretically possible; entropy (§3.5) is the compensating control.
5. **Host trust on WS** must be enforced server-side from the first line of the signaling code — this one is *not* deferred, because retrofitting authZ into a message handler is bug-prone.
6. **SQLite under concurrent WS writes** (participant updates): WAL mode + short transactions; acceptable at demo concurrency.

### 6.2 Improvements queued (priority order post-assignment)

Redis room state → separate signaling deploy → Postgres + Alembic migration → coturn → real auth (JWT + refresh rotation) → SFU (LiveKit) → recordings pipeline → waiting room → observability stack.

### 6.3 Schema validation against all features

| Feature (current + future) | Schema support | Change needed |
|---|---|---|
| Dashboard upcoming/recent | `meetings` status/type + indexes | none |
| Instant meeting + invite link | `meeting_code`, `meeting_type='instant'` | none |
| Join by ID/link, display name | code lookup + `participants.display_name` | none |
| Schedule (title/desc/time/duration) | columns present | none |
| Auth (bonus) | `password_hash`, `is_guest` | +`refresh_tokens` table |
| Host controls (bonus) | `participants.role`, `is_muted` | none |
| Chat | `chat_messages` | none |
| Passcodes / waiting room | `passcode_hash`, `settings.waiting_room` | none |
| Recordings / recurring / orgs / audit | §3.6 | additive tables only |

**Verdict:** every feature is either supported or strictly additive. The schema passes its own review.

---

## 7. One-Day Implementation Plan (Practical Design)

### 7.1 What ships today

```
zoom-clone/
├── frontend/                  # Next.js (App Router, TS, Tailwind)
│   ├── app/
│   │   ├── page.tsx           # Dashboard (F1)
│   │   ├── join/page.tsx      # Join flow (F3)
│   │   ├── schedule/page.tsx  # Schedule form (F4) (or modal on dashboard)
│   │   └── meeting/[code]/page.tsx   # Lobby + Room (CSR)
│   ├── components/{ui,dashboard,meeting}/
│   ├── lib/{api.ts, signaling.ts, webrtc/PeerManager.ts}
│   └── hooks/
└── backend/                   # FastAPI
    ├── app/
    │   ├── main.py            # app factory, CORS, startup seed
    │   ├── core/{config.py, db.py}
    │   ├── models/            # SQLAlchemy: users, meetings, participants, settings, chat
    │   ├── schemas/           # Pydantic DTOs
    │   ├── api/{meetings.py, users.py}
    │   ├── services/{meeting_service.py, code_generator.py}
    │   ├── ws/{signaling.py, room_manager.py}
    │   └── seed.py            # default user + sample upcoming/recent meetings
    └── tests/                   # smoke tests on create/join/validate
```

**API surface (minimal, complete):**
- `GET /api/me` · `GET /api/meetings/upcoming` · `GET /api/meetings/recent`
- `POST /api/meetings` (instant or scheduled by payload) · `GET /api/meetings/{code}` (validate) · `POST /api/meetings/{code}/join` · `POST /api/meetings/{code}/leave`
- `WS /ws/meetings/{code}?participant_id=…` — message catalog from §2.8

### 7.2 Hour-by-hour schedule (~12 h)

| Hours | Deliverable | Exit criterion |
|---|---|---|
| 0–1 | Repo scaffold: Next.js + FastAPI + SQLAlchemy models + seed script | both dev servers run; DB seeded |
| 1–3 | REST API complete + meeting-code generator + tests | curl through every endpoint |
| 3–5.5 | Dashboard UI (Zoom visual fidelity: navbar, action cards, upcoming/recent) + Join page + Schedule modal | F1–F4 flows work end-to-end against API |
| 5.5–6.5 | Lobby: getUserMedia preview, device toggles, name entry | camera preview works |
| 6.5–9.5 | Signaling (WS room manager) + PeerManager mesh + VideoGrid + ControlBar (mute/camera/leave) | **2 browsers see/hear each other** ← the make-or-break milestone |
| 9.5–10.5 | Polish: roster panel, mute badges, copy-invite-link toast, empty states, responsive pass | demo-clean on mobile width |
| 10.5–11.5 | Deploy: Vercel + Render, CORS/env wiring, re-test WebRTC over HTTPS (getUserMedia requires it) | deployed link works cross-network |
| 11.5–12 | README: setup, stack, schema diagram, assumptions, known limitations | submission-ready |

**Buffer policy:** if hour 9 arrives without two-browser video, ship audio-only or single-tile self-view and spend remaining time on UI fidelity + README honesty — evaluation weights working core features and UI over bonus depth. Chat and host controls are stretch goals slotted into hour 9.5–10.5 only if media landed early.

### 7.3 How today's build evolves into §2 (the bridge)

| Seam built today | Production swap | Why it's cheap later |
|---|---|---|
| `get_current_user()` stub dependency | JWT validation | one function, schema already auth-ready |
| `RoomManager` (in-process dict) | Redis-backed implementation | interface unchanged; message contract unchanged |
| `PeerManager` (mesh) | SFU client (LiveKit SDK) | React layer consumes the same participant/stream state |
| SQLite via SQLAlchemy + portable types | Postgres | connection string + Alembic |
| Single service (REST+WS) | split signaling deploy | `ws/` module is already isolated |
| No TURN | coturn + ICE config | client ICE-server list is already config-driven |
| No rate limits | gateway + Redis buckets | endpoints unchanged |

Every production capability in §2 maps to replacing an implementation **behind an interface that exists on day one** — that is the architectural thesis of this submission.
