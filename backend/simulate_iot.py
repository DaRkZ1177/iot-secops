"""
IoT SecOps — Behavior-Driven Simulation Engine v4.0
====================================================
Chaos now controls THREE dimensions simultaneously:
  - attack probability   (how often attacks happen)
  - attack intensity     (how many requests per attack)
  - attack interval      (how fast requests fire)

Metadata headers sent with every request:
  X-Device-Type       — device category
  X-Event-Intensity   — 0.0–1.0 float, scaled from chaos
  X-Behavior-Type     — normal | burst | anomaly | brute | oversized

Chaos scaling reference:
  chaos=0.1 → probability 10%, burst  8–12 req, interval 150ms  → LOW system
  chaos=0.5 → probability 50%, burst 18–24 req, interval  70ms  → MEDIUM system
  chaos=0.9 → probability 90%, burst 30–40 req, interval  30ms  → HIGH system

Run modes:
  python simulate_iot.py              # autonomous, chaos=0.3
  python simulate_iot.py chaos=0.7    # autonomous, chaos=0.7
  python simulate_iot.py manual       # one-shot normal traffic
  python simulate_iot.py cctv         # manual trigger one device type
  python simulate_iot.py allattack    # all attacks simultaneously
"""

import requests
import time
import random
import sys
import threading
from datetime import datetime

API = "http://127.0.0.1:8000"

CHAOS_LEVEL = 0.3


# ─────────────────────────────────────────────────────────────────────────────
# CHAOS SCALING — single source of truth for all intensity parameters
# ─────────────────────────────────────────────────────────────────────────────

def chaos_intensity(chaos: float) -> float:
    """0.0–1.0 intensity, sent as X-Event-Intensity header."""
    return round(min(1.0, max(0.0, chaos)), 3)


def chaos_burst_count(chaos: float, base_min: int, base_max: int) -> int:
    """
    Scale burst count linearly with chaos.
    chaos=0.1 → ~40% of base  (mild, may trigger anomaly only)
    chaos=0.5 → ~70% of base  (moderate, triggers rate_limit)
    chaos=0.9 → 110% of base  (aggressive, guarantees rate_limit + block)
    """
    scale = 0.3 + (chaos * 0.8)
    lo    = max(2, int(base_min * scale))
    hi    = max(lo + 1, int(base_max * scale))
    return random.randint(lo, hi)


def chaos_burst_interval(chaos: float, base_interval: float) -> float:
    """
    Higher chaos = faster firing.
    chaos=0.1 → 3× base (slow, spread out)
    chaos=0.5 → 1.5× base
    chaos=0.9 → 0.6× base (rapid fire)
    """
    multiplier = 3.0 - (chaos * 2.4)
    return max(0.02, base_interval * multiplier)


def chaos_brute_attempts(chaos: float) -> int:
    """
    chaos=0.1 →  4–6  attempts (below backend threshold 8 → only auth_fail)
    chaos=0.5 →  8–12 attempts (hits brute_force threshold)
    chaos=0.9 → 14–20 attempts (sustained brute_force)
    """
    lo = max(2, int(chaos * 15))
    hi = max(lo + 2, int(chaos * 22))
    return random.randint(lo, hi)


def chaos_brute_interval(chaos: float) -> float:
    """Faster CONNECT attempts at higher chaos."""
    return max(0.05, 0.25 - (chaos * 0.20))


def chaos_cooldown(chaos: float) -> float:
    """
    Higher chaos → shorter cooldown → more sustained attack activity.
    chaos=0.1 → 20–30s  |  chaos=0.5 → 12–18s  |  chaos=0.9 → 4–8s
    """
    lo = max(3.0, 20.0 - (chaos * 18.0))
    hi = max(lo + 2.0, 30.0 - (chaos * 24.0))
    return random.uniform(lo, hi)


# ─────────────────────────────────────────────────────────────────────────────
# DEVICE PROFILES — burst_count/brute_attempts are BASE values, chaos scales them
# ─────────────────────────────────────────────────────────────────────────────

DEVICE_PROFILES = [
    {
        "device_id":    "cctv_entrance",
        "device_type":  "cctv",
        "api_key":      "key123",
        "ip":           "192.168.1.10",
        "protocol":     "http",
        "description":  "Entrance CCTV Camera",
        "normal_interval": (2.0, 4.0),
        "attack_type":  "burst",
        "burst_count":  (22, 32),
        "burst_interval": 0.05,
        "payload_fn": lambda: {
            "event":       "motion_detected",
            "camera_id":   "CAM_01",
            "resolution":  "1080p",
            "fps":         random.choice([15, 24, 30]),
            "motion_zone": random.choice(["zone_a", "zone_b", "zone_c"]),
            "timestamp":   datetime.now().isoformat(),
        },
    },
    {
        "device_id":    "hvac_floor2",
        "device_type":  "hvac",
        "api_key":      "key456",
        "ip":           "192.168.1.20",
        "protocol":     "http",
        "description":  "HVAC Unit Floor 2",
        "normal_interval": (3.0, 6.0),
        "attack_type":  "drift",
        "burst_count":  (8, 14),
        "burst_interval": 0.08,
        "payload_fn": lambda: {
            "unit_id":     "HVAC_F2",
            "temperature": round(random.uniform(18.0, 24.0), 1),
            "humidity":    round(random.uniform(40.0, 60.0), 1),
            "co2_ppm":     random.randint(400, 800),
            "fan_speed":   random.choice(["low", "medium", "high"]),
            "mode":        random.choice(["cooling", "heating", "auto"]),
        },
        "attack_payload_fn": lambda: {
            "unit_id":     "HVAC_F2",
            "temperature": round(random.uniform(55.0, 90.0), 1),
            "humidity":    round(random.uniform(92.0, 100.0), 1),
            "co2_ppm":     random.randint(2500, 5000),
            "fan_speed":   "max",
            "mode":        "emergency",
            "alert":       "sensor_malfunction",
        },
    },
    {
        "device_id":    "smart_lock_server",
        "device_type":  "smart_lock",
        "api_key":      "key789",
        "ip":           "192.168.1.30",
        "protocol":     "mqtt",
        "description":  "Server Room Smart Lock",
        "normal_interval": (5.0, 10.0),
        "attack_type":  "brute_force",
        "payload_fn": lambda: {
            "lock_id":     "LOCK_SRV01",
            "status":      random.choice(["locked", "locked", "locked", "unlocked"]),
            "last_access": datetime.now().isoformat(),
            "battery":     random.randint(60, 100),
            "tamper":      False,
        },
    },
    {
        "device_id":    "sensor_warehouse",
        "device_type":  "sensor",
        "api_key":      "key123",
        "ip":           "192.168.1.40",
        "protocol":     "mqtt",
        "description":  "Warehouse Environment Sensor",
        "normal_interval": (2.0, 5.0),
        "attack_type":  "mqtt_flood",
        "burst_count":  (18, 28),
        "burst_interval": 0.04,
        "payload_fn": lambda: {
            "sensor_id":   "ENV_WH01",
            "temperature": round(random.uniform(15.0, 30.0), 2),
            "humidity":    round(random.uniform(30.0, 70.0), 2),
            "pressure":    round(random.uniform(1010.0, 1025.0), 2),
            "light_lux":   random.randint(0, 1000),
            "vibration":   round(random.uniform(0.0, 0.5), 3),
        },
    },
    {
        "device_id":    "gateway_main",
        "device_type":  "gateway",
        "api_key":      "key456",
        "ip":           "192.168.1.50",
        "protocol":     "http",
        "description":  "Main Network Gateway",
        "normal_interval": (4.0, 8.0),
        "attack_type":  "oversized",
        "payload_fn": lambda: {
            "gateway_id":        "GW_MAIN",
            "uptime_s":          random.randint(3600, 86400),
            "connected_devices": random.randint(8, 24),
            "cpu_usage":         round(random.uniform(5.0, 40.0), 1),
            "mem_usage":         round(random.uniform(20.0, 60.0), 1),
            "wan_ip":            f"203.0.{random.randint(1,254)}.{random.randint(1,254)}",
            "fw_version":        "4.2.1",
        },
        "oversized_payload_fn": lambda: {
            "gateway_id":      "GW_MAIN",
            "diagnostic_dump": "X" * 2048,
            "full_routing_table": [
                {"dest": f"10.0.{i}.0/24", "via": f"192.168.1.{i}", "metric": i}
                for i in range(100)
            ],
            "raw_log": "ERR OVERFLOW " * 200,
        },
    },
]

tokens = {}

DEVICE_TYPE_LABELS = {
    "cctv": "CCTV Camera", "hvac": "HVAC Unit",
    "smart_lock": "Smart Lock", "sensor": "Sensor", "gateway": "Gateway",
}


# ─────────────────────────────────────────────────────────────────────────────
# HEADER BUILDERS — intensity + behavior_type in every request
# ─────────────────────────────────────────────────────────────────────────────

def http_headers(device, token=None, behavior_type="normal", intensity=0.0):
    h = {
        "Content-Type":      "application/json",
        "X-Forwarded-For":   device["ip"],
        "X-Device-Type":     device["device_type"],
        "X-Event-Intensity": str(round(intensity, 3)),
        "X-Behavior-Type":   behavior_type,
    }
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def mqtt_headers(device, behavior_type="normal", intensity=0.0):
    return {
        "Content-Type":      "application/json",
        "X-Forwarded-For":   device["ip"],
        "X-MQTT-Key":        device["api_key"],
        "X-MQTT-ClientId":   device["device_id"],
        "X-Device-Type":     device["device_type"],
        "X-Event-Intensity": str(round(intensity, 3)),
        "X-Behavior-Type":   behavior_type,
    }


def log(device_type, device_id, action, result=""):
    ts     = datetime.now().strftime("%H:%M:%S")
    label  = DEVICE_TYPE_LABELS.get(device_type, device_type.upper())
    suffix = f" → {result}" if result else ""
    print(f"  [{ts}] [{label:12}] {device_id:20} {action}{suffix}")


# ─────────────────────────────────────────────────────────────────────────────
# INIT
# ─────────────────────────────────────────────────────────────────────────────

def initialise(chaos):
    print("\n── IoT Simulation Engine v4.0 ──────────────────────────────")
    print(f"   Chaos: {chaos:.0%}  |  Intensity: {chaos_intensity(chaos):.2f}  |  Devices: {len(DEVICE_PROFILES)}")
    print(f"   Burst scale: {0.3 + chaos * 0.8:.2f}×  |  Brute attempts: {chaos_brute_attempts(chaos)} avg")
    print("────────────────────────────────────────────────────────────\n")

    for d in DEVICE_PROFILES:
        if d["protocol"] == "http":
            try:
                res = requests.post(
                    f"{API}/auth",
                    json={"device_id": d["device_id"], "api_key": d["api_key"]},
                    headers={"Content-Type": "application/json"}, timeout=5,
                )
                tokens[d["device_id"]] = res.json().get("token")
                log(d["device_type"], d["device_id"], "AUTH", "token acquired")
            except Exception as e:
                log(d["device_type"], d["device_id"], "AUTH FAIL", str(e))
        else:
            try:
                requests.post(
                    f"{API}/mqtt/connect",
                    json={"client_id": d["device_id"], "username": d["device_id"], "password": d["api_key"]},
                    headers={"Content-Type": "application/json", "X-Forwarded-For": d["ip"], "X-Device-Type": d["device_type"]},
                    timeout=5,
                )
                log(d["device_type"], d["device_id"], "MQTT CONNECT", "ok")
            except Exception as e:
                log(d["device_type"], d["device_id"], "MQTT CONNECT FAIL", str(e))
    print()


# ─────────────────────────────────────────────────────────────────────────────
# NORMAL TRAFFIC
# ─────────────────────────────────────────────────────────────────────────────

def send_http_normal(device):
    token = tokens.get(device["device_id"])
    if not token:
        return
    try:
        r = requests.post(
            f"{API}/data", json=device["payload_fn"](),
            headers=http_headers(device, token, behavior_type="normal", intensity=0.0),
            timeout=5,
        )
        log(device["device_type"], device["device_id"], "TX normal",
            r.json().get("status", r.json().get("warning", "?")))
    except Exception as e:
        log(device["device_type"], device["device_id"], "TX ERROR", str(e))


def send_mqtt_normal(device):
    try:
        r = requests.post(
            f"{API}/mqtt/publish",
            json={"topic": f"devices/{device['device_id']}/telemetry", "payload": device["payload_fn"](), "qos": 1},
            headers=mqtt_headers(device, behavior_type="normal", intensity=0.0),
            timeout=5,
        )
        log(device["device_type"], device["device_id"], "MQTT normal",
            r.json().get("status", r.json().get("warning", r.json().get("error", "?"))))
    except Exception as e:
        log(device["device_type"], device["device_id"], "MQTT ERROR", str(e))


# ─────────────────────────────────────────────────────────────────────────────
# ATTACKS — all parameters derived from chaos at call time
# ─────────────────────────────────────────────────────────────────────────────

def attack_burst(device, chaos):
    """CCTV burst → anomaly (low chaos) or rate_limit+block (high chaos)"""
    count     = chaos_burst_count(chaos, *device["burst_count"])
    interval  = chaos_burst_interval(chaos, device["burst_interval"])
    intensity = chaos_intensity(chaos)
    token     = tokens.get(device["device_id"])
    if not token:
        return

    expected = "rate_limit expected" if count >= 20 else "anomaly expected"
    log(device["device_type"], device["device_id"],
        f"ATTACK burst ×{count} @{interval:.3f}s intensity={intensity:.2f}", expected)

    payload = device["payload_fn"]()
    payload["event"] = "motion_storm"
    hdrs = http_headers(device, token, behavior_type="burst", intensity=intensity)

    for _ in range(count):
        try:
            requests.post(f"{API}/data", json=payload, headers=hdrs, timeout=3)
        except Exception:
            pass
        time.sleep(interval)


def attack_drift(device, chaos):
    """HVAC drift → behavior_drift + anomaly"""
    count     = chaos_burst_count(chaos, *device["burst_count"])
    interval  = chaos_burst_interval(chaos, device["burst_interval"])
    intensity = chaos_intensity(chaos)
    token     = tokens.get(device["device_id"])
    if not token:
        return

    log(device["device_type"], device["device_id"],
        f"ATTACK drift ×{count} intensity={intensity:.2f}", "behavior_drift expected")

    fn   = device.get("attack_payload_fn", device["payload_fn"])
    hdrs = http_headers(device, token, behavior_type="anomaly", intensity=intensity)

    for _ in range(count):
        try:
            requests.post(f"{API}/data", json=fn(), headers=hdrs, timeout=3)
        except Exception:
            pass
        time.sleep(interval)


def attack_brute_force(device, chaos):
    """
    Smart Lock brute force
    chaos < 0.4 → few attempts → only auth_fail events (MEDIUM)
    chaos >= 0.4 → enough attempts to hit brute_force threshold (HIGH)
    """
    attempts  = chaos_brute_attempts(chaos)
    interval  = chaos_brute_interval(chaos)
    intensity = chaos_intensity(chaos)

    expected = "mqtt_brute_force expected" if attempts > 8 else "mqtt_auth_fail expected"
    log(device["device_type"], device["device_id"],
        f"ATTACK brute ×{attempts} @{interval:.3f}s intensity={intensity:.2f}", expected)

    for _ in range(attempts):
        try:
            requests.post(
                f"{API}/mqtt/connect",
                json={
                    "client_id": device["device_id"],
                    "username":  device["device_id"],
                    "password":  f"wrong_{random.randint(1000, 9999)}",
                },
                headers={
                    "Content-Type":      "application/json",
                    "X-Forwarded-For":   device["ip"],
                    "X-Device-Type":     device["device_type"],
                    "X-Event-Intensity": str(intensity),
                    "X-Behavior-Type":   "brute",
                },
                timeout=3,
            )
        except Exception:
            pass
        time.sleep(interval)


def attack_mqtt_flood(device, chaos):
    """Sensor flood → mqtt_anomaly (low) or mqtt_flood+block (high)"""
    count     = chaos_burst_count(chaos, *device["burst_count"])
    interval  = chaos_burst_interval(chaos, device["burst_interval"])
    intensity = chaos_intensity(chaos)

    expected = "mqtt_flood expected" if count >= 15 else "mqtt_anomaly expected"
    log(device["device_type"], device["device_id"],
        f"ATTACK mqtt flood ×{count} intensity={intensity:.2f}", expected)

    hdrs = mqtt_headers(device, behavior_type="burst", intensity=intensity)

    for _ in range(count):
        try:
            requests.post(
                f"{API}/mqtt/publish",
                json={"topic": f"devices/{device['device_id']}/flood", "payload": device["payload_fn"](), "qos": 0},
                headers=hdrs, timeout=3,
            )
        except Exception:
            pass
        time.sleep(interval)


def attack_oversized(device, chaos):
    """Gateway oversized payload → mqtt_oversized. Size scales with chaos."""
    intensity  = chaos_intensity(chaos)
    dump_size  = int(1100 + chaos * 1400)  # 1100–2500 bytes

    log(device["device_type"], device["device_id"],
        f"ATTACK oversized payload={dump_size}B intensity={intensity:.2f}", "mqtt_oversized expected")

    oversized = {
        "gateway_id":      "GW_MAIN",
        "diagnostic_dump": "X" * dump_size,
        "routing_entries": [{"dest": f"10.0.{i}.0/24", "via": f"192.168.1.{i}"} for i in range(50)],
    }
    try:
        requests.post(
            f"{API}/mqtt/publish",
            json={"topic": f"devices/{device['device_id']}/diagnostics", "payload": oversized, "qos": 1},
            headers=mqtt_headers(device, behavior_type="oversized", intensity=intensity),
            timeout=5,
        )
    except Exception:
        pass


ATTACK_FNS = {
    "burst":       attack_burst,
    "drift":       attack_drift,
    "brute_force": attack_brute_force,
    "mqtt_flood":  attack_mqtt_flood,
    "oversized":   attack_oversized,
}


# ─────────────────────────────────────────────────────────────────────────────
# DEVICE LOOP — chaos_ref is mutable so slider updates take effect live
# ─────────────────────────────────────────────────────────────────────────────

def device_loop(device, chaos_ref: list):
    while True:
        chaos        = chaos_ref[0]
        should_attack = random.random() < chaos

        if should_attack:
            fn = ATTACK_FNS.get(device["attack_type"])
            if fn:
                fn(device, chaos)
            time.sleep(chaos_cooldown(chaos))
        else:
            if device["protocol"] == "http":
                send_http_normal(device)
            else:
                send_mqtt_normal(device)
            time.sleep(random.uniform(*device["normal_interval"]))


# ─────────────────────────────────────────────────────────────────────────────
# MANUAL TRIGGERS
# ─────────────────────────────────────────────────────────────────────────────

def manual_normal_all():
    print("\n── Manual: normal traffic from all devices ──")
    for d in DEVICE_PROFILES:
        if d["protocol"] == "http":
            send_http_normal(d)
        else:
            send_mqtt_normal(d)
        time.sleep(0.3)


def manual_attack(device_type, chaos=0.5):
    for d in DEVICE_PROFILES:
        if d["device_type"] == device_type:
            fn = ATTACK_FNS.get(d["attack_type"])
            if fn:
                print(f"\n── Manual attack: {device_type} (chaos={chaos:.0%}) ──")
                fn(d, chaos)
            return


def manual_all_attacks(chaos=0.5):
    print(f"\n── Manual chaos: all attacks (chaos={chaos:.0%}) ──")
    threads = []
    for d in DEVICE_PROFILES:
        fn = ATTACK_FNS.get(d["attack_type"])
        if fn:
            t = threading.Thread(target=fn, args=(d, chaos), daemon=True)
            threads.append(t)
            t.start()
    for t in threads:
        t.join()
    print("── Done ──\n")


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    args  = sys.argv[1:]
    chaos = CHAOS_LEVEL

    for arg in args:
        if arg.startswith("chaos="):
            try:
                chaos = max(0.0, min(1.0, float(arg.split("=")[1])))
            except ValueError:
                pass

    initialise(chaos)

    if "manual"    in args: manual_normal_all();      sys.exit(0)
    if "allattack" in args: manual_all_attacks(chaos); sys.exit(0)

    for dt in ["cctv", "hvac", "smart_lock", "sensor", "gateway"]:
        if dt in args:
            manual_attack(dt, chaos)
            sys.exit(0)

    print(f"Autonomous — chaos={chaos:.0%}  |  Ctrl+C to stop\n")
    chaos_ref = [chaos]

    for device in DEVICE_PROFILES:
        t = threading.Thread(target=device_loop, args=(device, chaos_ref),
                             daemon=True, name=f"sim-{device['device_id']}")
        t.start()
        time.sleep(random.uniform(0.4, 1.2))

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n── Simulation stopped ──")
