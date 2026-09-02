# 🎬 Movie Ticket Booking API

A production-grade backend for a movie ticket booking platform, built with Node.js, Express, Prisma, Redis, and Socket.io.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL with Prisma ORM
- **Cache/Locking:** Redis (seat lock with TTL)
- **Real-time:** Socket.io (live seat updates)
- **Auth:** JWT + bcrypt
- **Validation:** Zod

## Features

- **Role-based access control** — ADMIN, THEATER_OWNER, CUSTOMER with ownership-scoped permissions
- **Real-time seat locking** — Redis TTL + Socket.io broadcast prevents double-booking
- **Concurrency safety** — `SELECT ... FOR UPDATE` in Postgres transactions guarantees single-confirmation even under race conditions
- **Modular architecture** — Each domain (auth, movies, theaters, screens, shows, bookings, payments) is a self-contained module
- **Input validation** — Zod schemas on all POST/PUT endpoints
- **Centralized error handling** — Consistent `{ success, message, error }` JSON shape
- **Seed script** — Pre-populated with sample data for immediate testing

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis (with keyspace notifications enabled)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Run migrations

```bash
npx prisma migrate dev
```

### 4. Enable Redis keyspace notifications

```bash
redis-cli CONFIG SET notify-keyspace-events Ex
```

This is required for automatic seat lock expiry handling.

### 5. Seed the database

```bash
npm run seed
```

### 6. Start the dev server

```bash
npm run dev
```

The API will be running at `http://localhost:3000`.

---

## Test Accounts

After seeding, use these accounts (password: `password123`):

| Role | Email |
|------|-------|
| Admin | admin@example.com |
| Theater Owner | owner@example.com |
| Customer | customer@example.com |

---

## API Endpoints

### Auth
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register a new user | Public |
| POST | `/api/auth/login` | Login and get JWT | Public |
| POST | `/api/auth/refresh` | Refresh JWT token | Public |

### Movies
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/movies` | List all movies | Public |
| GET | `/api/movies/:id` | Get movie by ID | Public |
| POST | `/api/movies` | Create movie | Admin |
| PUT | `/api/movies/:id` | Update movie | Admin |
| DELETE | `/api/movies/:id` | Delete movie | Admin |

### Theaters
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/theaters` | List all theaters | Public |
| GET | `/api/theaters/:id` | Get theater by ID | Public |
| POST | `/api/theaters` | Create theater | Admin, Owner |
| PUT | `/api/theaters/:id` | Update theater | Owner (scoped) |
| DELETE | `/api/theaters/:id` | Delete theater | Owner (scoped) |

### Screens (nested under theaters)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/theaters/:theaterId/screens` | List screens | Public |
| GET | `/api/theaters/:theaterId/screens/:id` | Get screen | Public |
| POST | `/api/theaters/:theaterId/screens` | Create screen | Owner (scoped) |
| PUT | `/api/theaters/:theaterId/screens/:id` | Update screen | Owner (scoped) |
| DELETE | `/api/theaters/:theaterId/screens/:id` | Delete screen | Owner (scoped) |

### Shows
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/shows?movieId=&city=&date=` | Browse shows | Public |
| GET | `/api/shows/:id` | Get show details | Public |
| GET | `/api/shows/:id/seats` | Get seat map with statuses | Public |
| POST | `/api/shows` | Create show | Owner (scoped) |
| PUT | `/api/shows/:id` | Update show | Owner (scoped) |
| DELETE | `/api/shows/:id` | Delete show | Owner (scoped) |

### Bookings
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/bookings` | Initiate booking (seat lock required) | Customer |
| POST | `/api/bookings/:id/confirm` | Confirm booking (after payment) | Customer |
| POST | `/api/bookings/:id/cancel` | Cancel booking | Customer |
| GET | `/api/bookings/my` | Get my bookings | Customer |
| GET | `/api/bookings/:id` | Get booking details | Owner (scoped) |

### Payments
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/payments/mock` | Simulate payment gateway | Customer |

---

## 🔒 Seat Locking Flow (Deep Dive)

This is the most architecturally significant part of the system. Here's how it works:

```
┌──────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐
│  Client   │────▶│ Socket.io│────▶│  Redis   │────▶│ Postgres │
│ (Browser) │◀────│  Server  │◀────│ (Locks)  │◀────│ (Truth)  │
└──────────┘     └──────────┘     └─────────┘     └──────────┘
```

### Step 1: Join the Room
```js
socket.emit("join_show", { showId: "abc-123" });
```
Client joins the Socket.io room `show:abc-123` to receive real-time updates.

### Step 2: Lock a Seat
```js
socket.emit("lock_seat", { showId: "abc-123", seatId: "seat-456" });
```

**Server flow:**
1. Check Redis: `GET lock:show:abc-123:seat:seat-456`
2. If key exists → emit `lock_failed` (someone else holds it)
3. If key missing → check Postgres: `ShowSeat.status === AVAILABLE`
4. If available:
   - `SET lock:show:abc-123:seat:seat-456 userId EX 300` (5-min TTL)
   - `UPDATE ShowSeat SET status = 'LOCKED', lockedBy = userId`
   - `io.to("show:abc-123").emit("seat_locked", { seatId, lockedBy: userId })`

### Step 3: Unlock a Seat (user deselects)
```js
socket.emit("unlock_seat", { showId: "abc-123", seatId: "seat-456" });
```
- Delete Redis key
- Revert `ShowSeat.status` to `AVAILABLE`
- Broadcast `seat_released` to room

### Step 4: Confirm Booking (after payment)
```
POST /api/payments/mock  →  get paymentId
POST /api/bookings/:id/confirm  { paymentId }
```

**Critical concurrency safety:**

```sql
-- Inside a Postgres transaction:
SELECT * FROM "ShowSeat"
WHERE id IN (seat1, seat2, seat3)
FOR UPDATE;  -- ← This row-level lock prevents race conditions
```

Even with Redis locks protecting 99.9% of cases, two simultaneous `confirm` requests could both pass the Redis check. `SELECT ... FOR UPDATE` ensures:
- First transaction acquires the row lock
- Second transaction **blocks** until the first commits
- When unblocked, the second sees the updated `BOOKED` status and rolls back

### Step 5: Lock Expiry (automatic)
- Redis key expires after 300s (TTL)
- Redis keyspace notification (`__keyevent@0__:expired`) fires
- Server receives the event, reverts `ShowSeat` to `AVAILABLE`
- Broadcasts `seat_released` to all clients in the room

---

## Architecture

```
src/
├── config/           # Database, Redis, Socket.io initialization
├── modules/
│   ├── auth/         # Register, login, JWT generation
│   ├── movies/       # CRUD with search/filter
│   ├── theaters/     # CRUD with ownership verification
│   ├── screens/      # CRUD with auto-seat generation
│   ├── shows/        # CRUD with seat map + browsing
│   ├── booking/      # Seat locking → confirmation → cancellation
│   └── payments/     # Mock payment gateway
├── middleware/        # Auth, RBAC, validation, error handler
├── sockets/          # Real-time seat locking events
├── utils/            # AppError class
├── app.ts            # Express app configuration
└── server.ts         # HTTP server + Socket.io init
```

Each module follows a consistent pattern:
```
module/
├── module.routes.ts      # Route definitions
├── module.controller.ts  # Request handlers (thin, delegates to service)
├── module.service.ts     # Business logic
└── module.validation.ts  # Zod schemas
```

---

## Scripts

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Compile TypeScript
npm start            # Run production build
npm run migrate      # Run Prisma migrations
npm run seed         # Seed the database
npm run studio       # Open Prisma Studio
```

## License

MIT
