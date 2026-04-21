from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import time
import csv
import io
import json as _json
from collections import defaultdict, deque
import jwt
import os
import sqlite3
import hashlib
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY         = os.environ.get("SECRET_KEY", "change-me-to-a-strong-random-secret")
DB_PATH            = os.environ.get("DB_PATH", "iot_security.db")
BLOCK_DURATION     = int(os.environ.get("BLOCK_DURATION", 30))
RATE_LIMIT         = int(os.environ.get("RATE_LIMIT", 20))
RATE_WINDOW        = int(os.environ.get("RATE_WINDOW", 5))
ANOMALY_THRESHOLD  = int(os.environ.get("ANOMALY_THRESHOLD", 8))
ANOMALY_WINDOW     = int(os.environ.get("ANOMALY_WINDOW", 1))
MQTT_RATE_LIMIT    = int(os.environ.get("MQTT_RATE_LIMIT", 15))
MQTT_PAYLOAD_MAX   = int(os.environ.get("MQTT_PAYLOAD_MAX", 1024))
MQTT_RATE_WINDOW       = 5
MQTT_ANOMALY_THRESHOLD = 6
MQTT_ANOMALY_WINDOW    = 1
SECURITY_WINDOW        = 30
EVENT_HISTORY_WINDOW   = 300

# ── CHANGE: aggregation thresholds for threat level ───────────────────────────
# Single events no longer escalate to HIGH. Sustained patterns do.
THREAT_HIGH_RATE_LIMIT_COUNT  = 3   # >= 3 rate_limit/mqtt_flood events in 30s → HIGH
THREAT_HIGH_BRUTE_FORCE_COUNT = 2   # >= 2 brute_force events in 30s → HIGH
THREAT_MEDIUM_ANOMALY_COUNT   = 3   # >= 3 anomaly/drift events in 30s → MEDIUM

# ── Database ──────────────────────────────────────────────────────────────────
conn   = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()

cursor.executescript("""
CREATE TABLE IF NOT EXISTS events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    type           TEXT,
    protocol       TEXT,
    ip             TEXT,
    device         TEXT,
    device_type    TEXT DEFAULT 'unknown',
    event_intensity REAL DEFAULT 0.0,
    behavior_type  TEXT DEFAULT 'normal',
    timestamp      REAL,
    time           TEXT
);
CREATE TABLE IF NOT EXISTS metrics_history (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    ts               INTEGER NOT NULL,
    total_requests   INTEGER DEFAULT 0,
    blocked_requests INTEGER DEFAULT 0,
    anomalies        INTEGER DEFAULT 0,
    mqtt_total       INTEGER DEFAULT 0,
    mqtt_blocked     INTEGER DEFAULT 0,
    threat_level     TEXT DEFAULT 'LOW'
);
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'viewer',
    created_at    REAL
);
""")
conn.commit()

# Schema migrations — safe to run on existing DBs
for col, defval in [
    ("device_type TEXT DEFAULT 'unknown'", "device_type"),
    ("event_intensity REAL DEFAULT 0.0",   "event_intensity"),
    ("behavior_type TEXT DEFAULT 'normal'", "behavior_type"),
]:
    try:
        cursor.execute(f"ALTER TABLE events ADD COLUMN {col}")
        conn.commit()
    except sqlite3.OperationalError:
        pass


def _hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


cursor.execute("SELECT COUNT(*) FROM users")
if cursor.fetchone()[0] == 0:
    cursor.execute(
        "INSERT INTO users (username, password_hash, role, created_at) VALUES (?,?,?,?)",
        ("admin", _hash_pw("admin123"), "admin", time.time()),
    )
    conn.commit()

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="IoT SecOps API", version="4.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

VALID_DEVICES = {
    "device_1":          "key123",
    "device_2":          "key456",
    "device_3":          "key789",
    "cctv_entrance":     "key123",
    "hvac_floor2":       "key456",
    "smart_lock_server": "key789",
    "sensor_warehouse":  "key123",
    "gateway_main":      "key456",
}

DEVICE_TYPE_MAP = {
    "cctv_entrance":     "cctv",
    "hvac_floor2":       "hvac",
    "smart_lock_server": "smart_lock",
    "sensor_warehouse":  "sensor",
    "gateway_main":      "gateway",
    "device_1": "sensor", "device_2": "sensor", "device_3": "sensor",
}

DEVICE_PROFILES_STATIC = [
    {"device_id": "cctv_entrance",     "device_type": "cctv",       "ip": "192.168.1.10", "protocol": "http",  "description": "Entrance CCTV Camera",       "attack_type": "burst",       "normal_behavior": "Motion events every 2-4s",  "attack_behavior": "Frame burst storm → rate_limit"},
    {"device_id": "hvac_floor2",       "device_type": "hvac",       "ip": "192.168.1.20", "protocol": "http",  "description": "HVAC Unit Floor 2",           "attack_type": "drift",       "normal_behavior": "Telemetry every 3-6s",       "attack_behavior": "Abnormal sensor values → behavior_drift"},
    {"device_id": "smart_lock_server", "device_type": "smart_lock", "ip": "192.168.1.30", "protocol": "mqtt",  "description": "Server Room Smart Lock",      "attack_type": "brute_force", "normal_behavior": "Status ping every 5-10s",   "attack_behavior": "CONNECT spam → mqtt_brute_force"},
    {"device_id": "sensor_warehouse",  "device_type": "sensor",     "ip": "192.168.1.40", "protocol": "mqtt",  "description": "Warehouse Environment Sensor", "attack_type": "mqtt_flood",  "normal_behavior": "Publish every 2-5s",        "attack_behavior": "Publish flood → mqtt_flood"},
    {"device_id": "gateway_main",      "device_type": "gateway",    "ip": "192.168.1.50", "protocol": "http",  "description": "Main Network Gateway",        "attack_type": "oversized",   "normal_behavior": "Heartbeat every 4-8s",      "attack_behavior": "Oversized payload → mqtt_oversized"},
]

# ── In-memory metrics ─────────────────────────────────────────────────────────
total_requests = blocked_requests = anomalies_detected = 0
mqtt_total = mqtt_blocked = mqtt_anomalies = 0

ip_requests             = defaultdict(int)
request_timestamps      = defaultdict(list)
mqtt_ip_requests        = defaultdict(int)
mqtt_request_timestamps = defaultdict(list)

security_events = deque()

# ── CHANGE: per-device memory (behavioral baseline + last value) ──────────────
# Structure: { ip: { "baseline": float, "last_value": float, "last_ts": float } }
device_memory = defaultdict(lambda: {"baseline": 1.0, "last_value": None, "last_ts": 0.0})

# Load recent events from DB
cursor.execute(
    "SELECT type, protocol, ip, device, device_type, event_intensity, behavior_type, timestamp, time "
    "FROM events WHERE timestamp > ? ORDER BY timestamp ASC",
    (time.time() - EVENT_HISTORY_WINDOW,),
)
for r in cursor.fetchall():
    security_events.append({
        "type": r[0], "protocol": r[1], "ip": r[2], "device": r[3],
        "device_type": r[4] or "unknown",
        "event_intensity": r[5] or 0.0,
        "behavior_type":  r[6] or "normal",
        "timestamp": r[7], "time": r[8],
    })

blocked_ips        = {}
manual_blocked_ips = set()
safe_ips           = set()
mqtt_blocked_ips   = {}
_last_snapshot_ts  = 0

# ── Helpers ───────────────────────────────────────────────────────────────────

def prune_events():
    now = time.time()
    while security_events and now - security_events[0]["timestamp"] > EVENT_HISTORY_WINDOW:
        security_events.popleft()


def get_request_metadata(request: Request, device_id: str) -> dict:
    """
    Extract all simulation metadata from headers.
    Falls back to sensible defaults if headers are absent (e.g. manual curl).
    """
    device_type = request.headers.get("X-Device-Type", "") or DEVICE_TYPE_MAP.get(device_id, "unknown")
    try:
        intensity = max(0.0, min(1.0, float(request.headers.get("X-Event-Intensity", "0.0"))))
    except (ValueError, TypeError):
        intensity = 0.0
    behavior_type = request.headers.get("X-Behavior-Type", "normal") or "normal"
    return {"device_type": device_type, "intensity": intensity, "behavior_type": behavior_type}


def add_event(event: dict):
    now   = time.time()
    etype = event.get("type", "")
    eip   = event.get("ip", "")
    prune_events()

    # Dedup
    if etype in ("ip_blocked", "mqtt_blocked"):
        window_start = now - BLOCK_DURATION
        for ev in reversed(list(security_events)):
            if ev["timestamp"] < window_start:
                break
            if ev["type"] == etype and ev["ip"] == eip:
                return
    else:
        for ev in reversed(list(security_events)):
            if now - ev["timestamp"] > 2:
                break
            if ev["type"] == etype and ev["ip"] == eip and ev.get("device") == event.get("device"):
                return

    # Defaults
    if not event.get("device_type"):
        event["device_type"] = DEVICE_TYPE_MAP.get(event.get("device", ""), "unknown")
    event.setdefault("event_intensity", 0.0)
    event.setdefault("behavior_type", "normal")

    security_events.append(event)
    cursor.execute(
        "INSERT INTO events (type, protocol, ip, device, device_type, event_intensity, behavior_type, timestamp, time) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (event.get("type"), event.get("protocol"), event.get("ip"), event.get("device"),
         event.get("device_type", "unknown"), event.get("event_intensity", 0.0),
         event.get("behavior_type", "normal"),
         event.get("timestamp", now), event.get("time", time.strftime("%H:%M:%S"))),
    )
    conn.commit()


# ── CHANGE: aggregation-based threat level ────────────────────────────────────
def compute_threat_level(recent_events: list) -> str:
    """
    Count event types in the recent window.
    HIGH requires SUSTAINED attack (>= threshold count), not a single event.
    """
    rate_limit_count  = sum(1 for e in recent_events if e["type"] in ("rate_limit", "mqtt_flood"))
    brute_force_count = sum(1 for e in recent_events if e["type"] in ("mqtt_brute_force",))
    anomaly_count     = sum(1 for e in recent_events if e["type"] in ("anomaly", "mqtt_anomaly", "behavior_drift"))

    if rate_limit_count >= THREAT_HIGH_RATE_LIMIT_COUNT or brute_force_count >= THREAT_HIGH_BRUTE_FORCE_COUNT:
        return "HIGH"
    if anomaly_count >= THREAT_MEDIUM_ANOMALY_COUNT:
        return "MEDIUM"
    return "LOW"


def snapshot_metrics(threat_level: str):
    global _last_snapshot_ts
    now_min = int(time.time() // 60) * 60
    if now_min <= _last_snapshot_ts:
        return
    _last_snapshot_ts = now_min
    cursor.execute(
        "INSERT INTO metrics_history (ts, total_requests, blocked_requests, "
        "anomalies, mqtt_total, mqtt_blocked, threat_level) VALUES (?,?,?,?,?,?,?)",
        (now_min, total_requests, blocked_requests, anomalies_detected,
         mqtt_total, mqtt_blocked, threat_level),
    )
    conn.commit()


def verify_user_token(request: Request):
    auth = request.headers.get("X-User-Token", "")
    if not auth:
        raise HTTPException(status_code=401, detail="Missing user token")
    try:
        return jwt.decode(auth, SECRET_KEY, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid user token")


# ═════════════════════════════════════════════════════════════════════════════
# USER AUTH — unchanged
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/user/login")
async def user_login(request: Request):
    data     = await request.json()
    username = data.get("username", "").strip()
    password = data.get("password", "")
    if not username or not password:
        return {"error": "Username and password required"}
    cursor.execute(
        "SELECT id, username, role FROM users WHERE username=? AND password_hash=?",
        (username, _hash_pw(password)),
    )
    row = cursor.fetchone()
    if not row:
        return {"error": "Invalid credentials"}
    token = jwt.encode(
        {"user_id": row[0], "username": row[1], "role": row[2], "iat": int(time.time())},
        SECRET_KEY, algorithm="HS256",
    )
    return {"token": token, "username": row[1], "role": row[2]}


@app.get("/user/me")
async def user_me(request: Request):
    payload = verify_user_token(request)
    return {"username": payload.get("username"), "role": payload.get("role")}


# ═════════════════════════════════════════════════════════════════════════════
# DEVICE ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/reset")
def reset():
    global total_requests, blocked_requests, anomalies_detected
    global mqtt_total, mqtt_blocked, mqtt_anomalies
    total_requests = blocked_requests = anomalies_detected = 0
    mqtt_total = mqtt_blocked = mqtt_anomalies = 0
    ip_requests.clear(); request_timestamps.clear()
    mqtt_ip_requests.clear(); mqtt_request_timestamps.clear()
    security_events.clear(); blocked_ips.clear()
    manual_blocked_ips.clear(); safe_ips.clear(); mqtt_blocked_ips.clear()
    device_memory.clear()
    cursor.execute("DELETE FROM events")
    conn.commit()
    return {"status": "reset complete"}


@app.post("/auth")
async def authenticate(request: Request):
    data = await request.json()
    device_id, api_key = data.get("device_id"), data.get("api_key")
    if device_id not in VALID_DEVICES:
        return {"error": "Invalid device"}
    if VALID_DEVICES[device_id] != api_key:
        return {"error": "Invalid API key"}
    token = jwt.encode(
        {"device_id": device_id, "iat": int(time.time())}, SECRET_KEY, algorithm="HS256"
    )
    return {"token": token}


@app.post("/block_ip")
def block_ip(ip: str):
    manual_blocked_ips.add(ip); safe_ips.discard(ip)
    return {"status": "blocked", "ip": ip}


@app.post("/unblock_ip")
def unblock_ip(ip: str):
    manual_blocked_ips.discard(ip)
    return {"status": "unblocked", "ip": ip}


@app.post("/mark_safe")
def mark_safe(ip: str):
    manual_blocked_ips.discard(ip); safe_ips.add(ip)
    return {"status": "safe", "ip": ip}


@app.get("/devices/profiles")
def device_profiles():
    return {"devices": DEVICE_PROFILES_STATIC}


@app.post("/data")
async def receive_data(request: Request):
    global total_requests, blocked_requests, anomalies_detected

    auth_header = request.headers.get("Authorization")
    if not auth_header:
        blocked_requests += 1
        return {"error": "Missing token"}
    try:
        token     = auth_header.split(" ")[1]
        payload   = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        device_id = payload["device_id"]
    except Exception:
        blocked_requests += 1
        return {"error": "Invalid token"}

    forwarded = request.headers.get("X-Forwarded-For")
    client_ip = forwarded.split(",")[0].strip() if forwarded else request.client.host
    now       = time.time()

    # ── CHANGE: extract simulation metadata ──────────────────────────────────
    meta = get_request_metadata(request, device_id)
    device_type   = meta["device_type"]
    intensity     = meta["intensity"]
    behavior_type = meta["behavior_type"]

    if client_ip in safe_ips:
        return {"status": "allowed_safe"}

    if client_ip in manual_blocked_ips:
        blocked_requests += 1
        add_event({"type": "ip_blocked", "protocol": "http", "ip": client_ip,
                   "device": device_id, "device_type": device_type,
                   "event_intensity": intensity, "behavior_type": behavior_type,
                   "timestamp": now, "time": time.strftime("%H:%M:%S")})
        return {"error": "IP manually blocked"}

    if client_ip in blocked_ips:
        remaining = int(blocked_ips[client_ip] - now)
        if remaining > 0:
            blocked_requests += 1
            add_event({"type": "ip_blocked", "protocol": "http", "ip": client_ip,
                       "device": device_id, "device_type": device_type,
                       "event_intensity": intensity, "behavior_type": behavior_type,
                       "timestamp": now, "time": time.strftime("%H:%M:%S"), "remaining": remaining})
            return {"error": f"IP blocked for {remaining}s"}
        del blocked_ips[client_ip]

    total_requests += 1
    ip_requests[client_ip] += 1
    request_timestamps[client_ip].append(now)
    request_timestamps[client_ip] = [
        t for t in request_timestamps[client_ip] if now - t < RATE_WINDOW
    ]

    request_count = len(request_timestamps[client_ip])

    # ── CHANGE: per-device memory — baseline + delta detection ───────────────
    mem      = device_memory[client_ip]
    baseline = mem["baseline"]

    # Update EMA baseline (slow: 90% old, 10% new)
    mem["baseline"] = baseline * 0.9 + request_count * 0.1

    # ── CHANGE: context-aware drift detection ─────────────────────────────────
    # If simulation says this is an anomaly OR request rate is double baseline
    is_drift = (behavior_type == "anomaly") or (request_count > baseline * 2 and baseline > 2)
    if is_drift and request_count > ANOMALY_THRESHOLD:
        anomalies_detected += 1
        add_event({
            "type": "behavior_drift", "protocol": "http",
            "ip": client_ip, "device": device_id, "device_type": device_type,
            "event_intensity": intensity, "behavior_type": behavior_type,
            "timestamp": now, "time": time.strftime("%H:%M:%S"),
        })
        return {"warning": "Behavioral drift detected"}

    # ── Rate limit check ──────────────────────────────────────────────────────
    if request_count > RATE_LIMIT:
        blocked_requests += 1
        blocked_ips[client_ip] = now + BLOCK_DURATION
        add_event({"type": "rate_limit", "protocol": "http", "ip": client_ip,
                   "device": device_id, "device_type": device_type,
                   "event_intensity": intensity, "behavior_type": behavior_type,
                   "timestamp": now, "time": time.strftime("%H:%M:%S")})
        return {"error": f"Rate limit exceeded → IP blocked for {BLOCK_DURATION}s"}

    # ── Burst anomaly check ───────────────────────────────────────────────────
    burst = [t for t in request_timestamps[client_ip] if now - t < ANOMALY_WINDOW]
    if len(burst) > ANOMALY_THRESHOLD:
        anomalies_detected += 1
        add_event({"type": "anomaly", "protocol": "http", "ip": client_ip,
                   "device": device_id, "device_type": device_type,
                   "event_intensity": intensity, "behavior_type": behavior_type,
                   "timestamp": now, "time": time.strftime("%H:%M:%S")})
        return {"warning": "Anomalous traffic detected"}

    mem["last_ts"] = now
    return {"status": "data accepted", "protocol": "http"}


@app.post("/mqtt/publish")
async def mqtt_publish(request: Request):
    global mqtt_total, mqtt_blocked, mqtt_anomalies

    mqtt_key    = request.headers.get("X-MQTT-Key")
    client_id   = request.headers.get("X-MQTT-ClientId", "unknown")
    forwarded   = request.headers.get("X-Forwarded-For")
    client_ip   = forwarded.split(",")[0].strip() if forwarded else request.client.host
    now         = time.time()

    # ── CHANGE: extract simulation metadata ──────────────────────────────────
    meta          = get_request_metadata(request, client_id)
    device_type   = meta["device_type"]
    intensity     = meta["intensity"]
    behavior_type = meta["behavior_type"]

    if client_ip in safe_ips:
        return {"status": "allowed_safe"}

    if client_ip in manual_blocked_ips:
        mqtt_blocked += 1
        add_event({"type": "mqtt_blocked", "protocol": "mqtt", "ip": client_ip,
                   "device": client_id, "device_type": device_type,
                   "event_intensity": intensity, "behavior_type": behavior_type,
                   "timestamp": now, "time": time.strftime("%H:%M:%S")})
        return {"error": "MQTT client manually blocked"}

    if not any(v == mqtt_key for v in VALID_DEVICES.values()):
        mqtt_blocked += 1
        add_event({"type": "mqtt_auth_fail", "protocol": "mqtt", "ip": client_ip,
                   "device": client_id, "device_type": device_type,
                   "event_intensity": intensity, "behavior_type": behavior_type,
                   "timestamp": now, "time": time.strftime("%H:%M:%S")})
        return {"error": "MQTT authentication failed"}

    if client_ip in mqtt_blocked_ips:
        remaining = int(mqtt_blocked_ips[client_ip] - now)
        if remaining > 0:
            mqtt_blocked += 1
            add_event({"type": "mqtt_blocked", "protocol": "mqtt", "ip": client_ip,
                       "device": client_id, "device_type": device_type,
                       "event_intensity": intensity, "behavior_type": behavior_type,
                       "timestamp": now, "time": time.strftime("%H:%M:%S"), "remaining": remaining})
            return {"error": f"MQTT client blocked for {remaining}s"}
        del mqtt_blocked_ips[client_ip]

    try:
        data = await request.json()
    except Exception:
        return {"error": "Invalid JSON payload"}

    payload_str = str(data.get("payload", ""))
    if len(payload_str) > MQTT_PAYLOAD_MAX:
        mqtt_blocked += 1
        add_event({"type": "mqtt_oversized", "protocol": "mqtt", "ip": client_ip,
                   "device": client_id, "device_type": device_type,
                   "event_intensity": intensity, "behavior_type": behavior_type,
                   "timestamp": now, "time": time.strftime("%H:%M:%S"), "size": len(payload_str)})
        return {"error": "Payload exceeds maximum size"}

    mqtt_total += 1
    mqtt_ip_requests[client_ip] += 1
    mqtt_request_timestamps[client_ip].append(now)
    mqtt_request_timestamps[client_ip] = [
        t for t in mqtt_request_timestamps[client_ip] if now - t < MQTT_RATE_WINDOW
    ]

    if len(mqtt_request_timestamps[client_ip]) > MQTT_RATE_LIMIT:
        mqtt_blocked += 1
        mqtt_blocked_ips[client_ip] = now + BLOCK_DURATION
        add_event({"type": "mqtt_flood", "protocol": "mqtt", "ip": client_ip,
                   "device": client_id, "device_type": device_type,
                   "event_intensity": intensity, "behavior_type": behavior_type,
                   "timestamp": now, "time": time.strftime("%H:%M:%S")})
        return {"error": f"MQTT flood detected → client blocked for {BLOCK_DURATION}s"}

    burst = [t for t in mqtt_request_timestamps[client_ip] if now - t < MQTT_ANOMALY_WINDOW]
    if len(burst) > MQTT_ANOMALY_THRESHOLD:
        mqtt_anomalies += 1
        add_event({"type": "mqtt_anomaly", "protocol": "mqtt", "ip": client_ip,
                   "device": client_id, "device_type": device_type,
                   "event_intensity": intensity, "behavior_type": behavior_type,
                   "timestamp": now, "time": time.strftime("%H:%M:%S")})
        return {"warning": "MQTT anomalous publish rate detected"}

    return {"status": "published", "protocol": "mqtt",
            "topic": data.get("topic", "unknown/topic"), "qos": data.get("qos", 0)}


@app.post("/mqtt/connect")
async def mqtt_connect(request: Request):
    global mqtt_blocked
    forwarded = request.headers.get("X-Forwarded-For")
    client_ip = forwarded.split(",")[0].strip() if forwarded else request.client.host
    now       = time.time()

    if client_ip in safe_ips:
        return {"status": "allowed_safe"}

    if client_ip in manual_blocked_ips:
        mqtt_blocked += 1
        add_event({"type": "mqtt_blocked", "protocol": "mqtt", "ip": client_ip,
                   "device": "unknown", "device_type": "unknown",
                   "event_intensity": 0.0, "behavior_type": "normal",
                   "timestamp": now, "time": time.strftime("%H:%M:%S")})
        return {"error": "MQTT client manually blocked"}

    try:
        data = await request.json()
    except Exception:
        return {"error": "Invalid JSON"}

    client_id = data.get("client_id", "unknown")
    password  = data.get("password", "")

    # ── CHANGE: extract metadata ──────────────────────────────────────────────
    meta          = get_request_metadata(request, client_id)
    device_type   = meta["device_type"]
    intensity     = meta["intensity"]
    behavior_type = meta["behavior_type"]

    key = f"mqtt_connect_{client_ip}"
    request_timestamps[key].append(now)
    request_timestamps[key] = [t for t in request_timestamps[key] if now - t < 10]

    # ── CHANGE: brute force threshold now context-aware ───────────────────────
    # If simulation declares behavior_type="brute", we treat it as confirmed
    # Otherwise use count-based detection.
    # threshold stays at 8 — low-chaos brute attacks (4-6 attempts) stay as auth_fail
    if len(request_timestamps[key]) > 8 or (behavior_type == "brute" and len(request_timestamps[key]) > 5):
        mqtt_blocked += 1
        add_event({"type": "mqtt_brute_force", "protocol": "mqtt", "ip": client_ip,
                   "device": client_id, "device_type": device_type,
                   "event_intensity": intensity, "behavior_type": behavior_type,
                   "timestamp": now, "time": time.strftime("%H:%M:%S")})
        return {"error": "MQTT broker: too many connect attempts — possible brute force"}

    if not any(v == password for v in VALID_DEVICES.values()):
        mqtt_blocked += 1
        add_event({"type": "mqtt_auth_fail", "protocol": "mqtt", "ip": client_ip,
                   "device": client_id, "device_type": device_type,
                   "event_intensity": intensity, "behavior_type": behavior_type,
                   "timestamp": now, "time": time.strftime("%H:%M:%S")})
        return {"error": "MQTT broker: authentication refused"}

    return {"status": "connected", "protocol": "mqtt",
            "client_id": client_id, "session": "clean"}


# ═════════════════════════════════════════════════════════════════════════════
# READ ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/metrics")
def metrics():
    now = time.time()
    prune_events()
    recent = [e for e in security_events if now - e["timestamp"] < SECURITY_WINDOW]

    # ── CHANGE: aggregation-based threat level ────────────────────────────────
    threat = compute_threat_level(recent)
    snapshot_metrics(threat)

    return {
        "total_requests":  total_requests,
        "blocked_requests": blocked_requests,
        "anomalies":       anomalies_detected,
        "attack_attempts": blocked_requests,
        "unique_ips":      len(ip_requests),
        "threat_level":    threat,
        "mqtt_total":      mqtt_total,
        "mqtt_blocked":    mqtt_blocked,
        "mqtt_anomalies":  mqtt_anomalies,
        "mqtt_unique_ips": len(mqtt_ip_requests),
        # ── CHANGE: expose event counts so frontend can show thresholds ────────
        "threat_counts": {
            "rate_limit":   sum(1 for e in recent if e["type"] in ("rate_limit", "mqtt_flood")),
            "brute_force":  sum(1 for e in recent if e["type"] == "mqtt_brute_force"),
            "anomaly":      sum(1 for e in recent if e["type"] in ("anomaly", "mqtt_anomaly", "behavior_drift")),
            "thresholds": {
                "high_rate_limit":  THREAT_HIGH_RATE_LIMIT_COUNT,
                "high_brute_force": THREAT_HIGH_BRUTE_FORCE_COUNT,
                "medium_anomaly":   THREAT_MEDIUM_ANOMALY_COUNT,
            },
        },
    }


@app.get("/events")
def events():
    prune_events()
    return {"events": list(security_events)}


@app.get("/history")
def history(hours: int = 24):
    since = int(time.time()) - hours * 3600
    cursor.execute(
        "SELECT ts, total_requests, blocked_requests, anomalies, "
        "mqtt_total, mqtt_blocked, threat_level "
        "FROM metrics_history WHERE ts >= ? ORDER BY ts ASC",
        (since,),
    )
    return {"history": [
        {"ts": r[0], "total_requests": r[1], "blocked_requests": r[2],
         "anomalies": r[3], "mqtt_total": r[4], "mqtt_blocked": r[5], "threat_level": r[6]}
        for r in cursor.fetchall()
    ]}


@app.get("/stats/top-ips")
def top_ips(limit: int = 10, hours: int = 24):
    since = time.time() - hours * 3600
    cursor.execute(
        "SELECT ip, COUNT(*) as cnt FROM events WHERE timestamp >= ? "
        "GROUP BY ip ORDER BY cnt DESC LIMIT ?", (since, limit),
    )
    return {"top_ips": [{"ip": r[0], "count": r[1]} for r in cursor.fetchall()]}


@app.get("/export/events")
def export_events(hours: int = 24, protocol: str = "all", fmt: str = "csv"):
    since  = time.time() - hours * 3600
    query  = ("SELECT type, protocol, ip, device, device_type, event_intensity, "
              "behavior_type, timestamp, time FROM events WHERE timestamp >= ?")
    params: list = [since]
    if protocol in ("http", "mqtt"):
        query += " AND protocol = ?"; params.append(protocol)
    query += " ORDER BY timestamp DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()

    if fmt == "json":
        data = [{"type": r[0], "protocol": r[1], "ip": r[2], "device": r[3],
                 "device_type": r[4], "event_intensity": r[5], "behavior_type": r[6],
                 "timestamp": r[7], "time": r[8]} for r in rows]
        return StreamingResponse(
            io.StringIO(_json.dumps(data, indent=2)), media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=iot_events.json"},
        )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["type", "protocol", "ip", "device", "device_type",
                     "event_intensity", "behavior_type", "timestamp", "time"])
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=iot_events.csv"},
    )
