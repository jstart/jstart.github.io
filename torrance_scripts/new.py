import pandas as pd
import requests

# Provided from the script's context
GROUPS = ["DP02", "DP03", "DP04", "DP05"]
census_base_url = "https://api.census.gov/data/2022/acs/acs5/profile/groups/"

# Download and parse all variable metadata from the API
all_labels = []
for group in GROUPS:
    url = f"{census_base_url}{group}.json"
    response = requests.get(url)
    data = response.json()
    for var_name, var_info in data["variables"].items():
        # Filter out margin of error variables
        if not var_name.endswith("M"):
            all_labels.append({"Variable": var_name, "Label": var_info["label"]})

# Create a DataFrame
labels_df = pd.DataFrame(all_labels)

# Export to CSV
labels_df.to_csv("acs_variable_labels.csv", index=False)
print(f"Exported {len(all_labels)} variables to acs_variable_labels.csv")

# import ace_tools as tools; tools.display_dataframe_to_user(name="ACS Variable Labels (DP02–DP05)", dataframe=labels_df)
print(all_labels)
