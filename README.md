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

IoT SecOps is a real-time security monitoring platform for IoT device networks. It acts as a gateway that inspects both **HTTP/REST** and **MQTT** traffic, detects attacks in real time, and displays them on a live SOC-style dashboard — with persistent history, user authentication, and one-click CSV/JSON export.

```
  IoT Devices                FastAPI Gateway              Dashboard
  ───────────────    →    ───────────────────    →    ──────────────────
  HTTP sensors             Rate limit detection         Live threat feed
  MQTT publishers          Anomaly detection            Attack analytics
  Simulated attacks        IP blocking (30s)            Device profiling
                           SQLite persistence           Export reports
```

---

## Features

|   | Feature | Description |
|---|---------|-------------|
| 🔍 | **Dual-Protocol Detection** | HTTP/REST and MQTT traffic monitoring with per-protocol rules |
| ⚡ | **Real-Time Blocking** | Rate limiting, anomaly burst detection, automatic IP blocking |
| 📊 | **Live Dashboard** | 4-second polling with threat level indicator and event feed |
| 📈 | **Analytics & History** | Per-minute metric snapshots in SQLite — survives restarts |
| 🔐 | **User Authentication** | JWT-based login with role support |
| 📤 | **Export Reports** | Download events as CSV or JSON with time/protocol filters |
| 🖥️ | **Device Intelligence** | Per-IP behavioral profiling with risk scoring |
| 🐳 | **Docker Ready** | One-command deploy with `docker compose up` |
| 💾 | **Persistent Storage** | SQLite stores all events and metrics across restarts |
| ✅ | **CI/CD** | GitHub Actions runs on every push |

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

| Protocol | Rule | Threshold | Action |
|----------|------|-----------|--------|
| HTTP | Rate Limit | >20 req / 5s | Block IP 30s |
| HTTP | Anomaly Burst | >8 req / 1s | Warn + log |
| MQTT | Flood | >15 pub / 5s | Block client 30s |
| MQTT | Burst | >6 pub / 1s | Warn + log |
| MQTT | Auth Fail | Bad credentials | Log event |
| MQTT | Brute Force | >8 CONNECT / 10s | Block + log |
| MQTT | Oversized | Payload > 1024B | Reject + log |

---

## Quick Start

### With Docker (recommended)

```bash
git clone https://github.com/yourusername/iot-secops.git
cd iot-secops

cp .env.example .env
# Open .env and set a strong SECRET_KEY

docker compose up -d
```

- Dashboard → **http://localhost:5173**
- API → **http://localhost:8000**
- Login: `admin` / `admin123`

```bash
# Run the IoT simulator (from your machine, not inside Docker)
cd backend
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
cp .env.example .env
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

**Terminal 3 — IoT Simulator (optional)**
```bash
cd backend
python simulate_iot.py
```

Dashboard → **http://localhost:5173**

---

## Pages

| Page | Description |
|------|-------------|
| **Overview** | Live metrics, dual-protocol traffic chart, attack simulation console, 30s event feed |
| **Alerts** | Filterable event table (type, severity, protocol, search) with 5-min client history |
| **Devices** | Per-IP behavioral profiles, risk scoring, click-to-expand detail panel |
| **Analytics** | SQLite-backed trend charts, top attacking IPs, time range selector, CSV/JSON export |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/user/login` | Dashboard user authentication |
| POST | `/auth` | IoT device JWT authentication |
| POST | `/data` | HTTP sensor data (with security checks) |
| POST | `/mqtt/publish` | MQTT publish simulation |
| POST | `/mqtt/connect` | MQTT CONNECT simulation |
| GET | `/metrics` | Current system metrics |
| GET | `/events` | Recent security events (30s window) |
| GET | `/history?hours=24` | Metric snapshots from SQLite |
| GET | `/stats/top-ips?hours=24&limit=10` | Top attacking IPs |
| GET | `/export/events?fmt=csv&hours=24` | Export events (csv or json) |
| POST | `/reset` | Reset all counters and events |

---

## Configuration

Copy `.env.example` to `.env` and edit:

```env
SECRET_KEY=your-strong-random-secret   # change this
DB_PATH=iot_security.db
BLOCK_DURATION=30
RATE_LIMIT=20
RATE_WINDOW=5
ANOMALY_THRESHOLD=8
MQTT_RATE_LIMIT=15
MQTT_PAYLOAD_MAX=1024
```

Frontend (`frontend/.env`):
```env
VITE_API_URL=http://localhost:8000
```

---

## Project Structure

```
iot-secops/
│
├── backend/                        # FastAPI backend
│   ├── main.py                     # All endpoints + detection logic
│   ├── simulate_iot.py             # IoT device simulator (HTTP + MQTT)
│   ├── requirements.txt            # Python dependencies
│   ├── Dockerfile                  # Backend container
│   └── .env.example                # Backend environment template
│
├── frontend/                       # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx       # JWT user login
│   │   │   ├── OverviewPage.jsx    # Live metrics + simulation console
│   │   │   ├── AlertsPage.jsx      # Event table with filters
│   │   │   ├── DevicesPage.jsx     # IP behavioral profiling
│   │   │   └── AnalyticsPage.jsx   # History charts + export
│   │   ├── components/
│   │   │   ├── Sidebar.jsx         # Navigation + user strip + logout
│   │   │   ├── Topbar.jsx          # Breadcrumb + threat level
│   │   │   ├── StatCard.jsx        # Metric card
│   │   │   └── EventBadge.jsx      # Type/severity/protocol badges
│   │   ├── App.jsx                 # Root — auth, routing, polling
│   │   ├── index.css               # Design system (CSS variables)
│   │   └── main.jsx                # React entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf                  # Nginx config for production
│   ├── Dockerfile                  # Frontend container (Vite → Nginx)
│   └── .env.example                # Frontend environment template
│
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions CI
│
├── docker-compose.yml              # One-command deploy
├── .env.example                    # Root environment template
├── .gitignore
└── README.md
```

---

Built for IoT security research and SOC dashboarding.
