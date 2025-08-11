import os
import time
import json
import requests
import pandas as pd
import geopandas as gpd
from pathlib import Path
from urllib.parse import urlencode

# ----------------------------- CONFIG -----------------------------
REST_URL = "https://arcgis.gis.lacounty.gov/arcgis/rest/services/DRP/GISNET_Public/MapServer/402/query"
OUT_SRID = 4326
MAX_RECORDS = 2000
CHUNK_DIR = Path("cams_chunks")        # folder for temporary JSON chunks
FINAL_CSV = "torrance_knockable_addresses.csv"
RETRIES = 5
SLEEP = 2                              # seconds between retries
CHUNK_DIR.mkdir(exist_ok=True)
# ------------------------------------------------------------------

def download_chunk(offset):
    params = {
        "where": "1=1",
        "outFields": "*",
        "outSR": OUT_SRID,
        "f": "geojson",
        "resultOffset": offset,
        "resultRecordCount": MAX_RECORDS
    }
    url = f"{REST_URL}?{urlencode(params)}"
    for attempt in range(RETRIES):
        try:
            gdf = gpd.read_file(url)
            return gdf
        except (requests.exceptions.RequestException, OSError) as e:
            print(f"⚠️  Error on offset {offset} (try {attempt+1}/{RETRIES}): {e}")
            time.sleep(SLEEP * (2 ** attempt))
    print(f"❌  Failed to download offset {offset} after {RETRIES} retries.")
    return None

# ------------------ MAIN DOWNLOAD LOOP -------------------
offset = 0
downloaded = []

print("📥 Starting chunked download of CAMS address points…")

while True:
    chunk_file = CHUNK_DIR / f"cams_{offset}.geojson"

    # Skip if already downloaded
    if chunk_file.exists():
        print(f"✅ Found cached chunk: {chunk_file.name}")
        offset += MAX_RECORDS
        continue

    gdf = download_chunk(offset)
    if gdf is None or gdf.empty:
        break

    gdf.to_file(chunk_file, driver="GeoJSON")
    print(f"💾 Saved chunk: {chunk_file.name} ({len(gdf)} rows)")
    offset += len(gdf)

print("🧩 Reassembling all chunks into one GeoDataFrame…")

frames = []
for file in sorted(CHUNK_DIR.glob("cams_*.geojson")):
    frames.append(gpd.read_file(file))
cams_all = pd.concat(frames, ignore_index=True)
print(f"✅ Total points: {len(cams_all):,}")

# ------------------ TORRANCE FILTERING -------------------
print("🌐 Clipping to Torrance city boundary…")
torrance = gpd.read_file(
    "https://open-data-torranceca.hub.arcgis.com/datasets/3bda3af1a3f04b2cb5d3a419eca36924_0.geojson"
).to_crs(cams_all.crs)

cams_torr = gpd.sjoin(cams_all, torrance, predicate="within")[[
    "Number", "StreetName", "PostType", "UnitName", "ZipCode", "geometry"
]].rename(columns={
    "Number": "HOUSE_NUM", "StreetName": "STREET_NAME",
    "PostType": "STREET_TYPE", "UnitName": "UNIT_NUM",
    "ZipCode": "ZIP_CODE"
})

# Build unique key
cams_torr["addr_key"] = (
    cams_torr["HOUSE_NUM"].astype(str).str.strip() + " " +
    cams_torr["STREET_NAME"].str.strip() + " " +
    cams_torr["STREET_TYPE"].str.strip() + " " +
    cams_torr["UNIT_NUM"].fillna("").apply(lambda u: "" if u=="" else "#"+u) + " " +
    cams_torr["ZIP_CODE"].astype(str)
).str.upper().str.replace(r"\s+", " ", regex=True)

deduped = cams_torr.drop_duplicates("addr_key")

deduped.to_csv(FINAL_CSV, index=False)
print(f"🏁 Done! Wrote {len(deduped):,} unique knockable addresses to {FINAL_CSV}")
