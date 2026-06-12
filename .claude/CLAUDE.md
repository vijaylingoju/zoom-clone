# Zoom Clone — Working Agreement

## North star
The goal is fixed by two documents — re-read them before any non-trivial decision:
- `Zoom_Clone.docx` — assignment requirements (core features F1–F4, bonus, evaluation criteria).
- `PLAN.md` — agreed architecture, database schema (§3), one-day build order (§7.2), and production upgrade paths (§7.3).
Never drift from PLAN.md silently. If an implementation detail must deviate, say so explicitly and update PLAN.md.

## UI / UX reference rule
- The **current Zoom web app** (zoom.us web client) is the single source of truth for UI and feature flows. When designing any screen or interaction, mirror Zoom's latest design: layout, spacing, copy, and flow order.
- Visual language: Zoom blue `#0E72ED` (hover `#0B5CCA`) for primary actions, light-gray dashboard (`#F7F7F7`/white cards), **dark meeting room** (`#1A1A1A`/`#242424`) with bottom control bar, rounded action cards (orange New Meeting, blue Join, blue Schedule), red leave/end button.
- Feature flows follow Zoom's order, e.g. join flow = enter ID → name/preview lobby → join; instant meeting = create → land directly in room as host.
- When unsure how a screen should look or behave, choose what current Zoom does — not a generic alternative.

## Coding principles
- **Layering is non-negotiable** (PLAN §2.2/§2.3): routers → services → repositories on the backend; `app/` → `components/` → `lib/` (api, signaling, `PeerManager`) → `hooks/` on the frontend. No business logic in route handlers or React components.
- **Patterns in use:** dependency injection (FastAPI `Depends`, incl. the `get_current_user()` auth seam), repository pattern for DB access, service layer for business rules, facade (`PeerManager` hides all RTCPeerConnection lifecycle from React), observer (signaling events → state store). Keep these seams clean — they are the production upgrade paths (PLAN §7.3).
- Pydantic DTOs at the API boundary; never return ORM models. TypeScript strict on the frontend; no `any`.
- Small, single-purpose components/functions; names over comments; comments only for non-obvious constraints.
- Every schema change must stay consistent with PLAN §3 (portable to Postgres, audit fields, soft delete rules).

## Step-wise implementation (no skipping ahead)
Build strictly incrementally — each step lands working and verified before the next starts, following PLAN §7.2:
1. **Scaffold** — repo structure, FastAPI + SQLAlchemy models + seed, Next.js + Tailwind; both servers run.
2. **REST API** — meetings CRUD, code generator, join/validate endpoints.
3. **Dashboard UI (F1)** + **Join page (F3)** + **Schedule modal (F4)** wired to the API.
4. **Lobby** — getUserMedia preview, device toggles, display name.
5. **Meeting room** — WS signaling + mesh WebRTC, video grid, control bar (F2 complete end-to-end).
6. **Polish** — roster, badges, invite-link copy, responsive, empty states.
7. **Deploy + README.**
Bonus (chat, host controls, auth) only after core steps are demo-clean.

## Progress reporting protocol (every response that changes code)
End with a status block mapped to the user flows:
- **✅ Done** — steps/features completed and verified (state how it was verified).
- **🟢 Working now** — what the user can click through *right now* (exact flow, e.g. "Dashboard → New Meeting → room loads with self-video").
- **⏭️ Next** — the next step from the sequence above and what it unlocks.
- **🎯 Goal check** — one line: where we are relative to F1–F4 + deployment.
Report honestly: if something is untested or broken, say so — never claim a flow works without having run it.
