import json
import os
import urllib.request

CACHE_FILE = "/Users/abhimanraj/Desktop/ORBIT-GUARD/backend/data/tle_cache_active.json"

if not os.path.exists(CACHE_FILE):
    print("Cache file not found!")
    exit(1)

with open(CACHE_FILE, "r") as f:
    data = json.load(f)

satellites = data.get("satellites", [])
iss = next((s for s in satellites if s["norad_id"] == "25544"), None)

if not iss:
    print("ISS not found in dataset!")
    exit(1)

# Remove any previously injected fakes
satellites = [s for s in satellites if not s["norad_id"].startswith("9999")]

line2 = iss["line2"]
mean_anomaly_str = line2[43:51]
mean_anomaly = float(mean_anomaly_str)

# 1 degree of anomaly ~ 118 km
# Red thresholds (< 3.5 km) -> offset < 0.03 degrees
# Yellow thresholds (3.5 - 7 km) -> offset 0.03 to 0.06 degrees

offsets = [
    ("99991", "COSMOS 1408 DEBRIS 1", 0.003), # ~0.35 km (Red)
    ("99992", "COSMOS 1408 DEBRIS 2", 0.007), # ~0.83 km (Red)
    ("99993", "FENGYUN-1C DEBRIS A", 0.012),  # ~1.42 km (Red)
    ("99994", "FENGYUN-1C DEBRIS B", 0.018),  # ~2.13 km (Red)
    ("99995", "UNKNOWN FRAGMENT X", 0.025),   # ~2.96 km (Red)
    ("99996", "UNKNOWN FRAGMENT Y", 0.045),   # ~5.34 km (Yellow)
    ("99997", "DELTA 1 DEBRIS", 0.055)        # ~6.52 km (Yellow)
]

for norad, name, offset in offsets:
    new_anomaly = (mean_anomaly + offset) % 360.0
    new_anomaly_str = f"{new_anomaly:8.4f}"
    fake_line2 = line2[:43] + new_anomaly_str + line2[51:]
    
    fake_debris = {
        "name": f"{name} (SIMULATED)",
        "norad_id": norad,
        "line1": iss["line1"].replace("25544U", f"{norad}U"),
        "line2": fake_line2.replace("25544", norad)
    }
    satellites.append(fake_debris)

data["satellites"] = satellites
import time
data["timestamp"] = time.time()

with open(CACHE_FILE, "w") as f:
    json.dump(data, f, indent=2)

print(f"Injected 7 fake debris objects into {len(satellites)} total satellites.")


# Trigger backend refresh to update DB
try:
    url = "http://localhost:8000/triage/refresh"
    payload = json.dumps({
        "satellite_group": "active",
        "protected_asset_ids": ["25544"],
        "distance_threshold_km": 10.0,
        "mission_priority": 1.0
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        print("Backend refresh status:", resp.status)
except Exception as e:
    print("Failed to call backend:", e)

