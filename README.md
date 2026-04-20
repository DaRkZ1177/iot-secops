# IoT SecOps

```
██╗ ██████╗ ████████╗    ███████╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗
██║██╔═══██╗╚══██╔══╝    ██╔════╝██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝
██║██║   ██║   ██║       ███████╗█████╗  ██║     ██║   ██║██████╔╝███████╗
██║██║   ██║   ██║       ╚════██║██╔══╝  ██║     ██║   ██║██╔═══╝ ╚════██║
██║╚██████╔╝   ██║       ███████║███████╗╚██████╗╚██████╔╝██║     ███████║
╚═╝ ╚═════╝    ╚═╝       ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚══════╝
```

### Real-Time IoT Intrusion Detection & Security Operations Center

**Detect · Block · Analyze · Export**

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=flat-square&logo=react&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Persistent-003B57?style=flat-square&logo=sqlite&logoColor=white)
![CI](https://github.com/yourusername/iot-secops/actions/workflows/ci.yml/badge.svg)

---

## What is IoT SecOps?

IoT SecOps is a real-time security monitoring platform for IoT device networks. It acts as a gateway that inspects both **HTTP/REST** and **MQTT** traffic, detects attacks in real time, and displays them on a live SOC-style dashboard — with persistent history, user authentication, manual IP management, and one-click CSV/JSON export.

```
  IoT Devices                FastAPI Gateway              Dashboard
  ───────────────    →    ───────────────────    →    ──────────────────
  HTTP sensors             Rate limit detection         Live threat feed
  MQTT publishers          Anomaly detection            Attack analytics
  Simulated attacks        Behavioral drift (EMA)       Device profiling
                           Manual block / safe list     Export reports
                           SQLite persistence           User auth
```

---

## Features

|   | Feature | Description |
|---|---------|-------------|
| 🔍 | **Dual-Protocol Detection** | HTTP/REST and MQTT traffic monitoring with per-protocol thresholds |
| ⚡ | **Real-Time Blocking** | Rate limiting, anomaly burst detection, automatic 30s IP blocking |
| 🧠 | **Behavioral Drift Detection** | Exponential moving average baseline per device — flags gradual traffic shifts |
| 🚫 | **Manual IP Management** | Block or safe-list any IP permanently via API (`/block_ip`, `/unblock_ip`, `/mark_safe`) |
| 📊 | **Live Dashboard** | 4-second polling with animated threat level indicator and event feed |
| 📈 | **Analytics & History** | Per-minute metric snapshots in SQLite — survives restarts, no data loss |
| 🔐 | **User Authentication** | JWT-based login, session persistence, role display, logout |
| 📤 | **Export Reports** | Download events as CSV or JSON with time range and protocol filters |
| 🖥️ | **Device Intelligence** | Per-IP behavioral profiling, risk scoring, click-to-expand detail panel |
| 🐳 | **Docker Ready** | One-command deploy with `docker compose up -d` |
| 💾 | **Persistent Storage** | SQLite stores all events, metrics history, and users across restarts |
| ✅ | **CI/CD** | GitHub Actions — installs, starts backend, health-checks, builds frontend on every push |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend      React 18 · Vite · Recharts                   │
│  Backend       FastAPI · Python 3.11 · PyJWT                │
│  Database      SQLite (events + metrics history + users)    │
│  Auth          JWT HS256 — device tokens + user sessions    │
│  Protocols     HTTP/REST + MQTT simulation layer            │
│  Infra         Docker · Docker Compose · Nginx · CI         │
└─────────────────────────────────────────────────────────────┘
```

### Detection Rules

| Protocol | Rule | Mechanism | Action |
|----------|------|-----------|--------|
| HTTP | Rate Limit | >20 req / 5s window | Block IP 30s |
| HTTP | Anomaly Burst | >8 req / 1s window | Warn + log |
| HTTP | Behavioral Drift | Request rate > 2× EMA baseline | Warn + log |
| HTTP | Manual Block | IP in block list | Reject immediately |
| MQTT | Flood | >15 pub / 5s window | Block client 30s |
| MQTT | Burst | >6 pub / 1s window | Warn + log |
| MQTT | Auth Fail | Bad credentials | Log event |
| MQTT | Brute Force | >8 CONNECT / 10s | Block + log |
| MQTT | Oversized Payload | Payload > 1024 bytes | Reject + log |
| MQTT | Manual Block | IP in block list | Reject immediately |

---

## Quick Start

### With Docker (recommended)

```bash
git clone https://github.com/yourusername/iot-secops.git
cd iot-secops

copy .env.example .env        # Windows
# cp .env.example .env        # Mac/Linux

# Open .env and set a strong SECRET_KEY

docker compose up -d
```

- Dashboard → **http://localhost:5173**
- API → **http://localhost:8000**
- Login: `admin` / `admin123`

```bash
# Run the IoT simulator (on your local machine, not in Docker)
cd backend
pip install requests
python simulate_iot.py

# View backend logs
docker compose logs -f backend

# Stop everything
docker compose down

# Full reset (clears database volume)
docker compose down -v
```

---

### Without Docker

**Requirements:** Python 3.11+, Node 18+

**Terminal 1 — Backend**
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env           # then edit SECRET_KEY
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm install
npm run dev
```

**Terminal 3 — IoT Simulator (optional)**
```bash
cd backend
pip install requests
python simulate_iot.py
```

Dashboard → **http://localhost:5173**

---

## Pages

| Page | Description |
|------|-------------|
| **Overview** | Live metrics (requests, blocked, anomalies, attacks, devices), dual-protocol traffic chart, attack simulation console, 30s security event feed |
| **Alerts** | Filterable event table by type, severity, and protocol with 5-minute client-side history. Search by IP, device, or event type |
| **Devices** | Per-IP behavioral profiles, risk scoring (rate limits + anomalies + blocks), click-to-expand detail panel with HTTP/MQTT breakdown |
| **Analytics** | SQLite-backed trend charts (traffic + attack timeline), threat level distribution, top attacking IPs ranked by count, time range selector (1h/6h/24h/72h), CSV/JSON export |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/user/login` | Dashboard user authentication |
| GET  | `/user/me` | Get current user from token |
| POST | `/auth` | IoT device JWT authentication |
| POST | `/data` | HTTP sensor data (rate limit + anomaly + drift checks) |
| POST | `/mqtt/publish` | MQTT publish simulation |
| POST | `/mqtt/connect` | MQTT CONNECT simulation (brute-force check) |
| GET  | `/metrics` | Current system metrics (HTTP + MQTT) |
| GET  | `/events` | Recent security events (5-min window) |
| GET  | `/history?hours=24` | Per-minute metric snapshots from SQLite |
| GET  | `/stats/top-ips?hours=24&limit=10` | Top attacking IPs by event count |
| GET  | `/export/events?fmt=csv&hours=24` | Export events as CSV or JSON |
| POST | `/block_ip?ip=x.x.x.x` | Manually block an IP permanently |
| POST | `/unblock_ip?ip=x.x.x.x` | Remove a manual block |
| POST | `/mark_safe?ip=x.x.x.x` | Safe-list an IP (bypasses all checks) |
| POST | `/reset` | Reset all counters, events, and block lists |

---

## Configuration

Copy `.env.example` to `.env` and edit:

```env
# Backend (backend/.env)
SECRET_KEY=your-strong-random-secret   # required — change this
DB_PATH=iot_security.db
BLOCK_DURATION=30
RATE_LIMIT=20
RATE_WINDOW=5
ANOMALY_THRESHOLD=8
ANOMALY_WINDOW=1
MQTT_RATE_LIMIT=15
MQTT_PAYLOAD_MAX=1024
```

```env
# Frontend (frontend/.env)
VITE_API_URL=http://localhost:8000
```

---

## Project Structure

```
iot-secops/
│
├── backend/
│   ├── main.py                     # All endpoints + detection logic
│   │                               #   ├── Rate limiting (HTTP + MQTT)
│   │                               #   ├── Anomaly burst detection
│   │                               #   ├── Behavioral drift (EMA baseline)
│   │                               #   ├── Manual block / safe list
│   │                               #   ├── SQLite persistence
│   │                               #   └── CSV/JSON export
│   ├── simulate_iot.py             # IoT device simulator (HTTP + MQTT)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx       # JWT user login
│   │   │   ├── OverviewPage.jsx    # Live metrics + simulation console
│   │   │   ├── AlertsPage.jsx      # Event table with filters
│   │   │   ├── DevicesPage.jsx     # IP behavioral profiling
│   │   │   └── AnalyticsPage.jsx   # History charts + export (cached, no flicker)
│   │   ├── components/
│   │   │   ├── Sidebar.jsx         # Nav + user strip + logout
│   │   │   ├── Topbar.jsx          # Breadcrumb + threat level + refresh
│   │   │   ├── StatCard.jsx        # Animated metric card
│   │   │   └── EventBadge.jsx      # Type/severity/protocol badges
│   │   ├── App.jsx                 # Auth, routing, 4s polling, event history
│   │   ├── index.css               # Design system (CSS variables)
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf
│   ├── Dockerfile
│   └── .env.example
│
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions CI
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Event Types

| Event | Protocol | Severity | Trigger |
|-------|----------|----------|---------|
| `rate_limit` | HTTP | HIGH | >20 req/5s from same IP |
| `anomaly` | HTTP | MEDIUM | >8 req/1s burst |
| `behavior_drift` | HTTP | MEDIUM | Rate > 2× learned EMA baseline |
| `ip_blocked` | HTTP | HIGH | Automatic or manual block hit |
| `mqtt_flood` | MQTT | HIGH | >15 pub/5s from same client |
| `mqtt_anomaly` | MQTT | MEDIUM | >6 pub/1s burst |
| `mqtt_auth_fail` | MQTT | HIGH | Invalid key on publish |
| `mqtt_brute_force` | MQTT | HIGH | >8 CONNECT attempts in 10s |
| `mqtt_oversized` | MQTT | MEDIUM | Payload > 1024 bytes |
| `mqtt_blocked` | MQTT | HIGH | Automatic or manual block hit |

---

Built for IoT security research and SOC dashboarding.
