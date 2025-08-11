import json
import pandas as pd

# Load the full JSON with ACS overlay data
with open("Precinct_ACS_FullOverlay.json") as f:
    precinct_data = json.load(f)

# Define labels that indicate rent burden or rent costs
rent_burden_keywords = [
    "Gross rent as a percentage of household income",
    "Selected monthly owner costs as a percentage of household income",
    "Renters paying 30 percent or more of income",
    "Monthly housing costs",
    "Median gross rent"
]

# Flatten and extract relevant variables
rows = []
for entry in precinct_data:
    precinct_id = entry.get("Precinct_ID")
    tract = entry.get("Census_Tract")
    acs_fields = entry.get("ACS_2022", {})

    filtered = {
        label: value for label, value in acs_fields.items()
        if any(k.lower() in label.lower() for k in rent_burden_keywords)
    }
    filtered["Precinct_ID"] = precinct_id
    filtered["Census_Tract"] = tract
    rows.append(filtered)

df = pd.DataFrame(rows)

# Try to convert all relevant columns to numeric, where possible
for col in df.columns:
    if col not in ["Precinct_ID", "Census_Tract"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

# Sort by highest rent burden if column exists
sort_columns = [col for col in df.columns if "30 percent or more" in col.lower()]
if sort_columns:
    df_sorted = df.sort_values(by=sort_columns[0], ascending=False)
else:
    df_sorted = df

print("Highest Rent Burden by Precinct:")
print("================================")
print(df)
# Show sorted table
# import ace_tools as tools; tools.display_dataframe_to_user(name="Highest Rent Burden by Precinct", dataframe=df_sorted)
