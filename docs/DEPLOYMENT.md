# Deployment

Live URLs (V1):

| Piece | URL | Host |
|---|---|---|
| Frontend | https://zoom-clone-wine-six.vercel.app | Vercel (Hobby) |
| Backend (REST + WebSocket) | https://zoom-clone-api-97j1.onrender.com | Render (free web service) |
| Health check | https://zoom-clone-api-97j1.onrender.com/api/health | — |

Both services auto-deploy on every push to `main`.

## Backend — Render

Defined by [`render.yaml`](../render.yaml) at the repo root (Render Blueprint convention —
do not move it into a subfolder, Render only detects it at the root).

- Root directory: `backend/`, build `pip install -r requirements.txt`,
  start `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (uvicorn's `standard` extra serves the WebSocket too).
- Environment variables (set in the Render dashboard):
  - `PYTHON_VERSION=3.12.6`
  - `CORS_ORIGINS=["https://zoom-clone-wine-six.vercel.app"]` — JSON list, parsed by pydantic-settings
  - `FRONTEND_BASE_URL=https://zoom-clone-wine-six.vercel.app` — used to build meeting invite links

## Frontend — Vercel

No config file needed; settings live in the Vercel project (`testing-deployments/zoom-clone`):

- Imported from GitHub `vijaylingoju/zoom-clone`, **Root Directory = `frontend`**, framework preset Next.js.
- Environment variable: `NEXT_PUBLIC_API_URL=https://zoom-clone-api-97j1.onrender.com`
  (the WebSocket URL is derived from it client-side: `https → wss`).

## Free-tier limitations (accepted for the assignment, documented for honesty)

1. **Cold start:** the Render service sleeps when idle; the first request after a pause takes ~30–60 s.
2. **Ephemeral SQLite:** the DB file lives on the service's disk and resets on every deploy/restart;
   the seed script repopulates it on boot. Production path: Postgres (PLAN.md §7.3).
3. **No TURN server:** WebRTC uses STUN only, so peers behind strict/symmetric NAT may fail to
   exchange media (roster/signaling still work). Production path: coturn (PLAN.md §2.4).
