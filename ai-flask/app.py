import os, json
from flask import Flask, jsonify
from flask_cors import CORS
import requests
import redis

app = Flask(__name__)
CORS(app)

TRACCAR_BASE = os.getenv("TRACCAR_BASE_URL", "https://demo.traccar.org").rstrip("/")
TRACCAR_USER = os.getenv("TRACCAR_USER", "demo")
TRACCAR_PASS = os.getenv("TRACCAR_PASS", "demo")
REDIS_URL    = os.getenv("REDIS_URL", "redis://redis:6379/0")

rc = redis.from_url(REDIS_URL, decode_responses=True)  # redis client

def cache_get(key):
    raw = rc.get(key)
    return json.loads(raw) if raw else None

def cache_set(key, value, ttl):
    rc.setex(key, ttl, json.dumps(value))

def fetch_json(path):
    try:
        resp = requests.get(f"{TRACCAR_BASE}{path}", auth=(TRACCAR_USER, TRACCAR_PASS), timeout=15)
        ct = resp.headers.get("content-type","")
        if "application/json" not in ct:
            app.logger.warning("Non-JSON from %s: %s %s, body=%r", path, resp.status_code, ct, resp.text[:200])
            return []
        return resp.json()
    except Exception as e:
        app.logger.exception("Error fetching %s: %s", path, e)
        return []

@app.get("/api/health")
def health():
    ok = True
    try:
        rc.ping()
        return jsonify(ok=ok, redis=True)
    except Exception:
        return jsonify(ok=ok, redis=False)

@app.get("/api/traccar/devices")
def devices():
    key, ttl = "traccar:devices", 60
    data = cache_get(key)
    if data is None:
        raw = fetch_json("/api/devices")
        data = raw if isinstance(raw, list) else []
        cache_set(key, data, ttl)
    return jsonify(data)

@app.get("/api/traccar/positions")
def positions():
    key, ttl = "traccar:positions", 10
    data = cache_get(key)
    if data is None:
        raw = fetch_json("/api/positions")
        if isinstance(raw, list):
            data = raw
        elif isinstance(raw, dict) and isinstance(raw.get("positions"), list):
            data = raw["positions"]
        else:
            data = []
        cache_set(key, data, ttl)
    return jsonify(data)

from flask import request
from geopy.distance import geodesic

@app.post("/api/predict_eta")
def predict_eta():
    payload = request.get_json(force=True) or {}
    a = (payload["current_lat"], payload["current_lng"])
    b = (payload["dropoff_lat"], payload["dropoff_lng"])
    km = geodesic(a, b).km
    return jsonify({"eta_minutes": round(km * 3, 2)})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

