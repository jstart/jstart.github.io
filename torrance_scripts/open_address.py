import gzip
import json
import csv

INPUT_FILE = "source.geojson.gz"
OUTPUT_FILE = "torrance_addresses.csv"

rows = []

with gzip.open(INPUT_FILE, 'rt', encoding='utf-8') as f:
    for line in f:
        try:
            feature = json.loads(line)
            props = feature.get("properties", {})
            if str(props.get("city", "")).strip().lower() == "torrance":
                coords = feature.get("geometry", {}).get("coordinates", [None, None])
                rows.append({
                    "number": props.get("number"),
                    "street": props.get("street"),
                    "unit": props.get("unit"),
                    "city": props.get("city"),
                    "postcode": props.get("postcode"),
                    "full_address": props.get("full"),
                    "lat": coords[1],
                    "lon": coords[0]
                })
        except json.JSONDecodeError:
            continue  # skip bad lines

if rows:
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"✅ Wrote {len(rows):,} Torrance addresses to {OUTPUT_FILE}")
else:
    print("❌ No valid addresses found or file is malformed.")
