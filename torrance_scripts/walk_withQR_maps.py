import pandas as pd
import geopandas as gpd
import qrcode
from fpdf import FPDF
from shapely.geometry import Point
from pathlib import Path
import tempfile
import re

# ---------- CONFIG ----------
INPUT_FILE = "torrance_canvass_map.csv"
OUTPUT_PDF = "torrance_walklists_final.pdf"
PAGE_HEIGHT_LIMIT = 265  # mm
LINE_HEIGHT = 8
HEADER_HEIGHT = 10
QR_SIZE = 20
# ----------------------------

def sanitize_text(text):
    if not isinstance(text, str):
        return ""
    return (
        text.replace("–", "-")
            .replace("—", "-")
            .replace("“", '"')
            .replace("”", '"')
            .replace("’", "'")
            .replace("‘", "'")
            .replace("•", "*")
            .encode('latin-1', 'ignore')
            .decode('latin-1')
    )

def safe_filename(name):
    return re.sub(r"[^\w\-]", "_", name)

# Load and clean CSV
df = pd.read_csv(INPUT_FILE)
df["full_label_clean"] = df["full_label"].str.replace(r"\s{2,}", " ", regex=True).str.strip()
df["zip"] = df["full_label_clean"].str.extract(r"(\d{5})$")
df["street"] = df["full_label_clean"].str.extract(r"^\d+\s+(.*?)\,")
df["number"] = df["full_label_clean"].str.extract(r"^(\d+)\s")
df["block_group"] = df["zip"] + " - " + df["street"].str.upper().fillna("")
df = df.sort_values(by=["block_group", "street", "number"], ascending=[True, True, True])

# Convert to GeoDataFrame
geometry = [Point(xy) for xy in zip(df["lon"], df["lat"])]
gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")
groups = gdf.groupby("block_group")

# Initialize PDF
pdf = FPDF()
pdf.set_auto_page_break(auto=False)
pdf.set_font("Arial", size=11)
current_y = 10
pdf.add_page()

with tempfile.TemporaryDirectory() as temp_dir:
    for block, group in groups:
        if len(group) < 2:
            continue

        block_height = HEADER_HEIGHT + (len(group) * LINE_HEIGHT)

        if current_y + block_height > PAGE_HEIGHT_LIMIT:
            pdf.add_page()
            current_y = 10

        # Generate QR code
        try:
            safe_block = safe_filename(block)
            lat_center = group["lat"].mean()
            lon_center = group["lon"].mean()
            gmaps_url = f"https://www.google.com/maps/search/?api=1&query={lat_center},{lon_center}"
            qr = qrcode.make(gmaps_url)
            qr_path = Path(temp_dir) / f"{safe_block}_qr.png"
            qr.save(qr_path)
            # Set QR size and position
            qr_size_mm = 20
            qr_x = 180  # right edge (A4 width = 210mm)
            qr_y = current_y

            # Insert QR code (smaller size)
            pdf.image(str(qr_path), x=qr_x - qr_size_mm, y=qr_y, w=qr_size_mm, h=qr_size_mm)

            # Insert label just to the left of the QR code
            pdf.set_xy(qr_x - qr_size_mm - 30, qr_y + 6)  # offset left and down slightly
            pdf.set_font("Arial", "I", 10)
            pdf.set_text_color(80, 80, 80)
            pdf.cell(30, 8, sanitize_text("📍 Map link:"), ln=False)
            pdf.set_text_color(0, 0, 0)  # reset for checklist
        except Exception as e:
            print(f"❌ QR failed for {block}: {e}")

        # Add block header
        pdf.set_xy(10, current_y)
        pdf.set_font("Arial", "B", 12)
        pdf.cell(0, 10, sanitize_text(f"Walk List – {block}"), ln=True)
        current_y += HEADER_HEIGHT

        # Add checklist
        pdf.set_font("Arial", "", 11)
        for _, row in group.iterrows():
            addr = sanitize_text(row["full_label_clean"])
            pdf.set_x(10)
            pdf.cell(10, LINE_HEIGHT, "[  ]", ln=False)
            pdf.cell(0, LINE_HEIGHT, addr, ln=True)
            current_y += LINE_HEIGHT

# Final export
pdf.output(OUTPUT_PDF)
print(f"✅ Walklist PDF generated successfully: {OUTPUT_PDF}")
