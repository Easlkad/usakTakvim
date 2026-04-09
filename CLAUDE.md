# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

usakTakvim is a full-stack scheduling/calendar app where users join rooms, create events, and respond to them (yes/no/alternative times). Built with Go (Gin) backend and Next.js 16 frontend.

## Commands

### Backend (Go)
```bash
cd backend
go run ./cmd/main.go        # Start dev server on :8080
go build -o server ./cmd/main.go
go test ./...
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev                  # Start dev server on :3000
npm run build
npm run lint
```

### Full Stack via Docker Compose
```bash
cd infra
docker-compose up            # Starts postgres:5432, backend:8080, frontend:3000
```

Database migrations run automatically from `backend/migrations/001_init.sql` on startup.

## Architecture

Three-tier monorepo: `backend/` (Go), `frontend/` (Next.js), `infra/` (Docker Compose).

### Backend (`backend/`)

- **Entry:** `cmd/main.go` — loads env, connects DB, wires routes
- **Routes:** `internal/routes/` — splits auth routes (`/auth/register`, `/auth/login`) from protected API routes (`/api/rooms/...`)
- **Handlers:** `internal/handlers/` — one file per domain (auth, rooms, events, responses, websocket)
- **Middleware:** JWT auth (`Auth()`) on all `/api/` routes; `SuperuserOnly()` for room creation
- **WebSocket:** `/api/rooms/:id/ws` — token passed as query param (not header); room-based hubs broadcast `event_created`, `event_deleted`, `response_updated`
- **Database:** PostgreSQL via `sqlx`; no ORM — raw SQL in handlers

### Frontend (`frontend/`)

- **Routing:** Next.js App Router; pages at `app/auth/`, `app/rooms/`, `app/rooms/[id]/`
- **Auth state:** Zustand store with `persist` middleware; hydration guard prevents SSR mismatch (check `useEffect` + `hasHydrated` pattern before accessing auth state)
- **API calls:** `lib/api.ts` — centralized fetch wrapper; 401 responses auto-redirect to `/auth`
- **Calendar:** `react-big-calendar` with `date-fns` Turkish locale
- **Real-time:** WebSocket client in room detail page; reconnects and merges server-pushed events into local state

### Key Data Model

```
users → rooms (created_by)
users ↔ rooms via room_members
rooms → events (created_by user)
events → responses (yes/no/alternative with optional alt_start_time/alt_end_time)
```

Room membership is invitation-based via a 16-char hex `room_key`. Only superusers can create rooms.

### Environment Variables

**Backend** (see `backend/.env.example`):
- `DB_*` — PostgreSQL connection
- `JWT_SECRET` — used for signing 30-day tokens
- `FRONTEND_URL` — CORS allowed origin
- `PORT` — defaults to 8080

**Frontend** (see `frontend/.env.example`):
- `NEXT_PUBLIC_API_URL` — backend base URL (e.g. `http://localhost:8080`)
