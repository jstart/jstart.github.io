import requests
import json
import pandas as pd
import os
from shapely.geometry import shape
from geojson import FeatureCollection, Feature
from itertools import islice

precinct_csv_path = "Torrance_Precincts_Overlay.csv"
precinct_df = pd.read_csv(precinct_csv_path)
valid_precinct_ids = set(precinct_df["Precinct_ID"].astype(str).str.strip().str.upper())

with open("RegistrarRecorder_Precincts-simple.geojson") as f:
    all_geojson = json.load(f)
    geojson_data = {
        "type": "FeatureCollection",
        "features": [
            f for f in all_geojson["features"]
            if str(f["properties"].get("PRECINCT", "")).strip().upper() in valid_precinct_ids
        ]
    }

results = []
csv_rows = []
failed_lookups = []

GROUPS = ["DP02", "DP03", "DP04", "DP05"]

def load_json_cache(filename):
    if os.path.exists(filename):
        with open(filename) as f:
            return json.load(f)
    return {}

def save_json_cache(filename, data):
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)

tract_cache = load_json_cache("tract_cache.json")
acs_data_cache = load_json_cache("acs_cache.json")
chunk_cache = load_json_cache("acs_chunk_cache.json")

all_vars = {}
for group in GROUPS:
    var_meta_url = f"https://api.census.gov/data/2022/acs/acs5/profile/groups/{group}.json"
    var_meta = requests.get(var_meta_url).json()
    for var in var_meta['variables']:
        if not var.endswith(('M',)):
            all_vars[var] = var_meta['variables'][var]['label']

def chunks(data, size=40):
    it = iter(data)
    for first in it:
        yield [first] + list(islice(it, size - 1))

acs_url = "https://api.census.gov/data/2022/acs/acs5/profile"
tract_to_precinct = {}

for idx_feature in enumerate(geojson_data['features']):
    i, feature = idx_feature
    properties = feature["properties"]
    precinct_id = str(properties.get("PRECINCT", "UNKNOWN")).strip().upper()
    geom = shape(feature["geometry"])
    centroid = geom.centroid
    lat, lon = centroid.y, centroid.x

    fcc_url = "https://geo.fcc.gov/api/census/block/find"
    if precinct_id in tract_cache:
        tract_code = tract_cache[precinct_id]
        print(f"📍 Using cached tract code {tract_code} for precinct {precinct_id} at lat={lat}, lon={lon}")
    else:
        print(f"🌐 Querying FCC for centroid lat={lat}, lon={lon}...")
        fcc_response = requests.get(fcc_url, params={"latitude": lat, "longitude": lon, "format": "json"})
        if fcc_response.status_code != 200:
            print(f"Error fetching FCC block for precinct {precinct_id} at lat={lat}, lon={lon}. Status: {fcc_response.status_code}")
            failed_lookups.append(precinct_id)
            continue
        try:
            fcc_json = fcc_response.json()
            block_fips = fcc_json['Block']['FIPS']
            tract_code = block_fips[:11]
            tract_cache[precinct_id] = tract_code
            save_json_cache("tract_cache.json", tract_cache)
            print(f"🧭 Resolved tract {tract_code} for precinct {precinct_id} at centroid lat={lat}, lon={lon}")
        except (KeyError, ValueError) as e:
            print(f"No FIPS found for precinct {precinct_id}. FCC response error: {e}")
            failed_lookups.append(precinct_id)
            continue

    tract_to_precinct.setdefault(tract_code, []).append(precinct_id)

    if tract_code not in acs_data_cache:
        acs_data_cache[tract_code] = {}

    acs_data = acs_data_cache[tract_code]

    for chunk_keys in chunks(list(all_vars.keys()), 40):
        chunk_id = "|".join(sorted(chunk_keys))
        cache_key = f"{tract_code}|{chunk_id}"

        if cache_key in chunk_cache:
            print(f"⏩ Skipping cached chunk for tract {tract_code} (chunk hash)")
            acs_data.update(chunk_cache[cache_key])
            continue

        params = {
            "get": ",".join(chunk_keys),
            "for": f"tract:{tract_code[-6:]}",
            "in": "state:06 county:037",
            "key": "308c9f690ab74580ef936ee190664fb263cdb9d8"
        }
        print(f"📊 Fetching ACS data for tract {tract_code} with {len(chunk_keys)} variables...")
        acs_resp = requests.get(acs_url, params=params)
        if acs_resp.status_code != 200:
            print(f"Error fetching chunk for {precinct_id}: {acs_resp.status_code}")
            failed_lookups.append(precinct_id)
            break
        acs_json = acs_resp.json()
        headers, values = acs_json[0], acs_json[1]
        acs_data_chunk = dict(zip(headers, values))
        acs_data.update(acs_data_chunk)
        chunk_cache[cache_key] = acs_data_chunk
        save_json_cache("acs_chunk_cache.json", chunk_cache)
        save_json_cache("acs_cache.json", acs_data_cache)
        print(f"✅ Retrieved {len(acs_data_chunk)} ACS fields for this chunk.")

    acs_data_cache[tract_code] = acs_data

    readable_data = {}
    for key, label in all_vars.items():
        if key in acs_data:
            readable_data[label] = acs_data[key]

    enriched = {
        "Precinct_ID": precinct_id,
        "Census_Tract": tract_code,
        "ACS_2022": readable_data
    }
    results.append(enriched)

    row = {"Precinct_ID": precinct_id, "Census_Tract": tract_code}
    row.update(readable_data)
    csv_rows.append(row)

    print(f"✅ Finished processing precinct {precinct_id} mapped to Census Tract {tract_code}")

save_json_cache("tract_cache.json", tract_cache)
save_json_cache("acs_cache.json", acs_data_cache)
save_json_cache("acs_chunk_cache.json", chunk_cache)
save_json_cache("tract_to_precinct.json", tract_to_precinct)

with open("Precinct_ACS_FullOverlay.json", "w") as f:
    json.dump(results, f, indent=2)

csv_df = pd.DataFrame(csv_rows)
csv_df.to_csv("Precinct_ACS_FullOverlay.csv", index=False)

print("\n🔚 Processing complete.")
print(f"🧮 Unique tracts resolved: {len(set(tract_cache.values()))}")
print(f"❌ Failed lookups: {len(failed_lookups)} precincts.")
if failed_lookups:
    for pid in failed_lookups:
        print(f" - {pid}")
