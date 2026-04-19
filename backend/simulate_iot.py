import requests
import time
import random

API = "http://127.0.0.1:8000"

print("Running IoT Simulation — HTTP + MQTT...")

devices = [
    {"id": "device_1", "key": "key123", "ip": "192.168.1.10"},
    {"id": "device_2", "key": "key456", "ip": "192.168.1.20"},
    {"id": "device_3", "key": "key789", "ip": "192.168.1.30"},
]

tokens = {}

# Acquire JWT tokens for HTTP devices
for d in devices:
    try:
        res = requests.post(
            f"{API}/auth",
            json={"device_id": d["id"], "api_key": d["key"]},
            headers={"Content-Type": "application/json"},
            timeout=5,
        )
        tokens[d["id"]] = res.json().get("token")
        print(f"  Auth OK: {d['id']}")
    except Exception as e:
        print(f"  Auth FAIL {d['id']}: {e}")

# Register MQTT connections (simulates CONNECT packets)
for d in devices:
    try:
        requests.post(
            f"{API}/mqtt/connect",
            json={"client_id": d["id"], "username": d["id"], "password": d["key"]},
            headers={"Content-Type": "application/json", "X-Forwarded-For": d["ip"]},
            timeout=5,
        )
        print(f"  MQTT connect OK: {d['id']}")
    except Exception as e:
        print(f"  MQTT connect FAIL {d['id']}: {e}")

print("\nSimulation running — Ctrl+C to stop")
print("-" * 40)

i = 0
while True:
    d = devices[i % len(devices)]
    protocol = "mqtt" if i % 3 == 0 else "http"

    try:
        if protocol == "http":
            headers = {
                "Content-Type": "application/json",
                "X-Forwarded-For": d["ip"],
                "Authorization": f"Bearer {tokens[d['id']]}",
            }
            r = requests.post(
                f"{API}/data",
                json={"temperature": round(random.uniform(20, 35), 1)},
                headers=headers,
                timeout=5,
            )
            print(f"  HTTP {d['id']} ({d['ip']}): {r.json()}")
        else:
            headers = {
                "Content-Type": "application/json",
                "X-Forwarded-For": d["ip"],
                "X-MQTT-Key": d["key"],
                "X-MQTT-ClientId": d["id"],
            }
            r = requests.post(
                f"{API}/mqtt/publish",
                json={
                    "topic": f"sensors/{d['id']}/telemetry",
                    "payload": {
                        "temperature": round(random.uniform(20, 35), 1),
                        "humidity": round(random.uniform(40, 80), 1),
                    },
                    "qos": 1,
                },
                headers=headers,
                timeout=5,
            )
            print(f"  MQTT {d['id']} ({d['ip']}): {r.json()}")
    except Exception as e:
        print(f"  ERROR {d['id']}: {e}")

    i += 1
    time.sleep(1)
