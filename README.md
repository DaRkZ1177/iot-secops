# IoT SecOps

```
██╗ ██████╗ ████████╗    ███████╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗
██║██╔═══██╗╚══██╔══╝    ██╔════╝██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝
██║██║   ██║   ██║       ███████╗█████╗  ██║     ██║   ██║██████╔╝███████╗
██║██║   ██║   ██║       ╚════██║██╔══╝  ██║     ██║   ██║██╔═══╝ ╚════██║
██║╚██████╔╝   ██║       ███████║███████╗╚██████╗╚██████╔╝██║     ███████║
╚═╝ ╚═════╝    ╚═╝       ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚══════╝
```

### Behavior-Aware IoT Security Gateway & Security Operations Center

**Detect · Classify · Block · Explain · Export**

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=flat-square&logo=react&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Persistent-003B57?style=flat-square&logo=sqlite&logoColor=white)
![CI](https://github.com/yourusername/iot-secops/actions/workflows/ci.yml/badge.svg)

---

## What is IoT SecOps?

IoT SecOps is a **behavior-aware security gateway** for IoT device networks. It sits between IoT devices and your backend, enforcing security across both **HTTP/REST** and **MQTT** protocols using a multi-layered detection engine. Unlike traditional monitoring tools, the system does not just count requests — it models how each device *normally behaves*, assigns every security event a **device-type context** (CCTV, HVAC, Smart Lock, Sensor, Gateway), and generates **human-readable attack narratives** that explain what each event means in operational terms.

```
  IoT Devices               FastAPI Security Gateway          SOC Dashboard
  ────────────────   →   ──────────────────────────   →   ──────────────────
  📷 CCTV Camera          JWT device authentication         Live threat feed
  ❄️  HVAC Controller     Rate limit + burst detection      Attack narratives
  🔒 Smart Lock           EMA behavioral drift engine       Device profiling
  📡 Environment Sensor   MQTT flood + brute force          Analytics & export
  🖧 Network Gateway       Context-aware event enrichment    Chaos simulator
                          SQLite persistence                User authentication
```

---

## Features

|   | Feature | Description |
|---|---------|-------------|
| 🧠 | **Behavioral Drift Detection (EMA)** | Per-device exponential moving average baseline — detects gradual traffic escalation that static thresholds miss |
| 🔍 | **Context-Aware Detection** | Every event carries `device_type`, `event_intensity`, and `behavior_type` — events are classified, not just counted |
| 📖 | **Semantic Attack Narratives** | `generateAttackStory()` produces device-specific incident explanations — a CCTV camera and HVAC unit triggering the same pattern get different descriptions |
| ⚡ | **5-Layer HTTP Detection** | Rate limiting, anomaly burst, behavioral drift, behavioral context (normal/anomaly/burst), manual block |
| 📡 | **5-Layer MQTT Detection** | Publish flood, burst anomaly, auth failure, brute force CONNECT, oversized payload, manual block |
| 🎯 | **Device-Type Profiling** | 5 IoT personas (CCTV, HVAC, Smart Lock, Sensor, Gateway) with real-world payloads and assigned attack archetypes |
| 🎛️ | **Chaos-Driven Simulator** | `chaos` parameter (0.0–1.0) controls attack probability, burst count, interval, and brute force attempts — scales all intensity parameters from a single knob |
| 🕹️ | **Browser Simulation Engine** | `BrowserSimEngine` class in the dashboard — supports autonomous mode (continuous attacks) and manual per-device attack triggering directly from the UI |
| 🚫 | **Manual IP Management** | Permanently block or safe-list any IP via API (`/block_ip`, `/unblock_ip`, `/mark_safe`) |
| 📊 | **Live SOC Dashboard** | 4-second polling, animated threat level indicator (LOW/MEDIUM/HIGH with pulse on CRITICAL), real-time event feed |
| 📈 | **Analytics & History** | Per-minute SQLite metric snapshots — survives restarts, trend charts, top attacking IPs, time range selector |
| 🔐 | **User Authentication** | JWT-based login, session persistence, role display, logout |
| 📤 | **Export Reports** | Download events as CSV or JSON with `device_type`, `event_intensity`, `behavior_type` fields |
| 🐳 | **Docker Ready** | One-command deploy with `docker compose up -d` |
| ✅ | **CI/CD** | GitHub Actions — installs, starts backend, health-checks, builds frontend on every push |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend      React 18 · Vite · Recharts · BrowserSimEngine     │
│  Backend       FastAPI · Python 3.11 · PyJWT                     │
│  Detection     EMA baselines · sliding window · context enrichment│
│  Database      SQLite (events · metrics_history · users)         │
│  Auth          JWT HS256 — device tokens + user sessions         │
│  Protocols     HTTP/REST + MQTT simulation layer                 │
│  Simulator     Chaos-driven · 5 personas · threading             │
│  Infra         Docker · Docker Compose · Nginx · CI              │
└──────────────────────────────────────────────────────────────────┘
```

### Detection Engine — HTTP

| Layer | Rule | Mechanism | Threshold | Action |
|-------|------|-----------|-----------|--------|
| 1 | Rate Limit | Sliding window | >20 req / 5s | Block IP 30s |
| 2 | Anomaly Burst | Sliding window | >8 req / 1s | Warn + log |
| 3 | Behavioral Drift | EMA baseline (α=0.1) | rate > 2× baseline AND >threshold | `behavior_drift` event + warn |
| 4 | Behavioral Context | `X-Behavior-Type` header from simulator | `anomaly` type forces drift check | Context-aware classification |
| 5 | Manual Block | `manual_blocked_ips` set | IP in set | Reject immediately |

### Detection Engine — MQTT

| Layer | Rule | Mechanism | Threshold | Action |
|-------|------|-----------|-----------|--------|
| 1 | Publish Flood | Sliding window | >15 pub / 5s | Block client 30s |
| 2 | Burst Anomaly | Sliding window | >6 pub / 1s | Warn + log |
| 3 | Auth Failure | Key validation | Invalid key | Log event |
| 4 | Brute Force | CONNECT rate | >8 attempts / 10s | Block + log |
| 5 | Oversized Payload | Payload inspection | >1024 bytes | Reject + log |
| 6 | Manual Block | `manual_blocked_ips` set | IP in set | Reject immediately |

### Threat Level Aggregation

```
CRITICAL / HIGH  = rate_limit OR mqtt_flood in last 30s
ELEVATED / MEDIUM = ≥3 of (anomaly + mqtt_anomaly + behavior_drift) in last 30s
NOMINAL / LOW    = no qualifying events in recent window
```

---

## IoT Device Personas

Five device profiles — each with realistic payloads, natural traffic cadence, and an assigned attack archetype that the simulator uses to generate authentic threat scenarios.

| Device | ID | IP | Protocol | Normal Behavior | Attack Archetype |
|--------|----|----|----------|-----------------|-----------------|
| 📷 Entrance CCTV | `cctv_entrance` | 192.168.1.10 | HTTP | Motion events every 2–4s | Frame burst storm → `rate_limit` |
| ❄️ HVAC Floor 2 | `hvac_floor2` | 192.168.1.20 | HTTP | Telemetry every 3–6s | Abnormal sensor values → `behavior_drift` |
| 🔒 Server Room Lock | `smart_lock_server` | 192.168.1.30 | MQTT | Status ping every 5–10s | CONNECT spam → `mqtt_brute_force` |
| 📡 Warehouse Sensor | `sensor_warehouse` | 192.168.1.40 | MQTT | Publish every 2–5s | Publish flood → `mqtt_flood` |
| 🖧 Main Gateway | `gateway_main` | 192.168.1.50 | HTTP | Heartbeat every 4–8s | Oversized diagnostic dump → `mqtt_oversized` |

**HVAC attack payloads** use a separate `attack_payload_fn` — temperature spikes to 55–90°C, CO₂ to 2500–5000ppm, mode set to `emergency` — making the behavioral drift semantically meaningful, not just a rate change.

---

## Chaos-Driven Simulator

The simulator is controlled by a single `chaos` parameter (0.0–1.0) that scales all attack parameters through pure functions — no hardcoded attack values anywhere.

```bash
python simulate_iot.py              # autonomous mode, chaos=0.3 (default)
python simulate_iot.py chaos=0.7    # autonomous mode, 70% attack probability
python simulate_iot.py cctv         # single manual attack: CCTV burst
python simulate_iot.py allattack    # trigger all 5 device attacks simultaneously
python simulate_iot.py chaos=0.9 allattack  # maximum intensity, all devices
```

### Chaos Scaling

| chaos | Attack Probability | Burst Count | Interval | Brute Attempts | Expected Result |
|-------|-------------------|-------------|----------|----------------|-----------------|
| 0.1 | 10% | ~40% of base | 3× slower | 4–6 | Anomaly only, MEDIUM |
| 0.3 | 30% | ~54% of base | 2× slower | 7–10 | Mix of anomaly + rate_limit |
| 0.5 | 50% | ~70% of base | 1.5× slower | 8–12 | Rate limit + block, HIGH |
| 0.9 | 90% | ~110% of base | 0.6× (rapid) | 14–20 | Guaranteed block + brute force |

Every request carries `X-Event-Intensity` (0.0–1.0 float) and `X-Behavior-Type` (`normal` / `burst` / `anomaly` / `oversized`) headers — the backend reads these to enrich events with intensity scores and behavioral classification before writing to SQLite.

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
- API → **http://localhost:8000/docs**
- Login: `admin` / `admin123`

```bash
# Run the simulator from your local machine (not inside Docker)
cd backend
pip install requests
python simulate_iot.py              # default chaos=0.3

# Crank up intensity for demo
python simulate_iot.py chaos=0.8

# Trigger all device attacks at once
python simulate_iot.py allattack

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

**Terminal 3 — Simulator**
```bash
cd backend
pip install requests
python simulate_iot.py chaos=0.5   # or any chaos level
```

Dashboard → **http://localhost:5173**

---

## Pages

### Overview
Live metric cards (HTTP + MQTT), dual-protocol traffic chart, per-device fleet status grid. The **Simulation Console** has two modes:
- **Manual** — trigger per-device attacks individually with a single button per persona, each showing its own live status
- **Autonomous** — starts the `BrowserSimEngine` in the browser, continuously attacking at the configured chaos level
- **Chaos slider** — drag to set intensity (Low/Medium/High/Extreme), updates the engine live if autonomous mode is running

### Alerts
Filterable event table with 5-minute client-side history. Filters: event type (11 types including `behavior_drift`), severity (HIGH/MEDIUM/LOW), protocol (HTTP/MQTT), and device type (CCTV/HVAC/Smart Lock/Sensor/Gateway). Each row expands to show the **attack narrative** — a contextual incident explanation generated by `generateAttackStory()` that adapts its language to the device type. Includes `DeviceTypeBadge` and `BehaviorIndicator` components.

### Devices
Per-IP behavioral profiles with risk scoring across HTTP and MQTT event counts. Click any row to expand a detail panel showing HTTP/MQTT activity breakdown, linked device IDs, and recent event log.

### Analytics
SQLite-backed trend charts from `/history` (traffic + attack timeline), threat level distribution pie, top attacking IPs ranked by event count, time range selector (1h / 6h / 24h / 72h). CSV/JSON export includes `device_type`, `event_intensity`, and `behavior_type` fields from the database. Module-level cache prevents page-switch flicker.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/user/login` | Dashboard user authentication → JWT |
| GET | `/user/me` | Validate current user token |
| POST | `/auth` | IoT device JWT authentication |
| POST | `/data` | HTTP sensor data endpoint (all 5 HTTP detection layers) |
| POST | `/mqtt/publish` | MQTT publish simulation (flood + anomaly + auth + payload checks) |
| POST | `/mqtt/connect` | MQTT CONNECT simulation (brute-force detection) |
| GET | `/devices/profiles` | List all registered device profiles with type + attack metadata |
| GET | `/metrics` | Current system metrics (HTTP + MQTT counters + threat level) |
| GET | `/events` | Recent security events with `device_type` + `event_intensity` + `behavior_type` |
| GET | `/history?hours=24` | Per-minute metric snapshots from SQLite |
| GET | `/stats/top-ips?hours=24&limit=10` | Top attacking IPs by event count |
| GET | `/export/events?fmt=csv&hours=24` | Export events as CSV or JSON |
| POST | `/block_ip?ip=x.x.x.x` | Manually block an IP (HTTP + MQTT) |
| POST | `/unblock_ip?ip=x.x.x.x` | Remove a manual block |
| POST | `/mark_safe?ip=x.x.x.x` | Safe-list an IP (bypasses all detection layers) |
| POST | `/reset` | Reset all counters, events, block lists, and device memory |

### Request Headers (Simulator → Backend)

| Header | Type | Description |
|--------|------|-------------|
| `X-Device-Type` | string | Device persona (`cctv`, `hvac`, `smart_lock`, `sensor`, `gateway`) |
| `X-Event-Intensity` | float 0.0–1.0 | Chaos-derived intensity — stored in `event_intensity` column |
| `X-Behavior-Type` | string | `normal` / `burst` / `anomaly` / `oversized` — informs drift detection |

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
│   ├── main.py                     # FastAPI gateway — all detection logic
│   │                               #   ├── 5-layer HTTP detection pipeline
│   │                               #   ├── 6-layer MQTT detection pipeline
│   │                               #   ├── EMA behavioral baseline per device IP
│   │                               #   ├── Context enrichment (device_type, intensity, behavior_type)
│   │                               #   ├── Aggregated threat level (LOW/MEDIUM/HIGH)
│   │                               #   ├── Manual block / safe list
│   │                               #   ├── SQLite (events + metrics_history + users)
│   │                               #   ├── /devices/profiles endpoint
│   │                               #   └── CSV/JSON export with enriched fields
│   ├── simulate_iot.py             # Chaos-driven IoT device simulator
│   │                               #   ├── 5 device personas with realistic payloads
│   │                               #   ├── chaos= parameter scales all attack intensity
│   │                               #   ├── Per-device attack archetypes (burst/drift/brute/flood/oversize)
│   │                               #   ├── X-Event-Intensity + X-Behavior-Type headers
│   │                               #   ├── Autonomous mode (threading, per-device loops)
│   │                               #   └── Manual attack mode (cctv / hvac / allattack etc.)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx       # JWT user login
│   │   │   ├── OverviewPage.jsx    # Live metrics · fleet grid · simulation console
│   │   │   │                       #   ├── BrowserSimEngine class (manual + autonomous)
│   │   │   │                       #   ├── Chaos slider (live intensity control)
│   │   │   │                       #   └── Per-device attack buttons with status
│   │   │   ├── AlertsPage.jsx      # Event table · expanded attack narratives
│   │   │   │                       #   ├── DeviceTypeBadge + BehaviorIndicator
│   │   │   │                       #   ├── Filter by type / severity / protocol / device_type
│   │   │   │                       #   └── Expandable row → generateAttackStory()
│   │   │   ├── DevicesPage.jsx     # Per-IP profiling · HTTP+MQTT breakdown · risk scoring
│   │   │   └── AnalyticsPage.jsx   # SQLite trend charts · top IPs · export · cached
│   │   ├── components/
│   │   │   ├── Sidebar.jsx         # Nav · user strip · logout
│   │   │   ├── Topbar.jsx          # Breadcrumb · threat level pill · refresh
│   │   │   ├── StatCard.jsx        # Animated metric card with glow
│   │   │   └── EventBadge.jsx      # All badge components + attack story engine
│   │   │                           #   ├── EventBadge / SeverityBadge / ProtocolBadge
│   │   │                           #   ├── DeviceTypeBadge (CCTV/HVAC/Lock/Sensor/Gateway)
│   │   │                           #   ├── BehaviorIndicator (Normal / Anomalous)
│   │   │                           #   └── generateAttackStory() — 10 event type stories
│   │   ├── App.jsx                 # Auth · routing · 4s polling · 5-min event history
│   │   ├── index.css               # Design system (CSS variables · DESIGN.md)
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
│       └── ci.yml                  # GitHub Actions CI (backend health-check + frontend build)
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Event Types

Every event stored in SQLite carries: `type`, `protocol`, `ip`, `device`, `device_type`, `event_intensity`, `behavior_type`, `timestamp`, `time`.

| Event | Protocol | Severity | Trigger | Narrative Context |
|-------|----------|----------|---------|-------------------|
| `rate_limit` | HTTP | HIGH | >20 req/5s | Adapts to CCTV (frame storm), HVAC (sensor loop), Gateway (diagnostic loop) |
| `anomaly` | HTTP | MEDIUM | >8 req/1s | Burst rate spike |
| `behavior_drift` | HTTP | MEDIUM | Rate > 2× EMA baseline AND context=anomaly | HVAC emergency mode, CCTV replay attack, Gateway config change |
| `ip_blocked` | HTTP | HIGH | Auto or manual block | Shows remaining block duration |
| `mqtt_flood` | MQTT | HIGH | >15 pub/5s | Sensor storm, warehouse flooding |
| `mqtt_anomaly` | MQTT | MEDIUM | >6 pub/1s | MQTT burst |
| `mqtt_auth_fail` | MQTT | HIGH | Invalid key | Credential theft or misconfiguration |
| `mqtt_brute_force` | MQTT | HIGH | >8 CONNECT/10s | Smart lock credential brute force |
| `mqtt_oversized` | MQTT | MEDIUM | Payload >1024 bytes | Gateway diagnostic dump injection |
| `mqtt_blocked` | MQTT | HIGH | Auto or manual block | MQTT client denied broker access |

---

Built for IoT security research and SOC dashboarding.
