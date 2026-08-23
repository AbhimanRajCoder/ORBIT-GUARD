import json
import os

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

# Create a fake debris object colliding with ISS
# We keep the same orbit (line 2) but slightly shift the mean anomaly (last 8 chars before checksum)
# Actually, just changing the inclination slightly or mean anomaly slightly creates a close approach.
# Let's shift the Mean Anomaly (chars 43-51 on line 2) by a tiny fraction.

line2 = iss["line2"]
mean_anomaly_str = line2[43:51]
mean_anomaly = float(mean_anomaly_str)
new_anomaly = (mean_anomaly + 0.05) % 360.0
new_anomaly_str = f"{new_anomaly:8.4f}"

fake_line2 = line2[:43] + new_anomaly_str + line2[51:]
# We should technically fix the checksum, but SGP4 parsers often ignore it or we can just leave it

fake_debris_1 = {
    "name": "COSMOS 1408 DEBRIS (SIMULATED)",
    "norad_id": "99998",
    "line1": iss["line1"].replace("25544U", "99998U").replace("98067A", "82092B"),
    "line2": fake_line2.replace("25544", "99998")
}

fake_debris_2 = {
    "name": "FENGYUN-1C DEBRIS (SIMULATED)",
    "norad_id": "99999",
    "line1": iss["line1"].replace("25544U", "99999U").replace("98067A", "99025C"),
    "line2": line2[:43] + f"{(mean_anomaly - 0.02) % 360.0:8.4f}" + line2[51:]
}
fake_debris_2["line2"] = fake_debris_2["line2"].replace("25544", "99999")

satellites.append(fake_debris_1)
satellites.append(fake_debris_2)

data["satellites"] = satellites
import time
data["timestamp"] = time.time()

with open(CACHE_FILE, "w") as f:
    json.dump(data, f, indent=2)

print(f"Injected fake debris objects into {len(satellites)} total satellites.")
