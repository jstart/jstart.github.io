import json

# Load the unique tracts
with open("unique_tracts.json", "r") as f:
    fips_codes = json.load(f)

def decode_census_tract(fips_code):
    """
    Decode FIPS code to actual census tract number
    FIPS format: SSSSSCCCCCTTTTTT
    Where: SSSSS = State (06037 = CA, Los Angeles County)
           CCCCCC = County code (already included)
           TTTTTT = Tract number (last 6 digits, divide by 100 for decimal)
    """
    # Extract the tract portion (last 6 digits)
    tract_code = fips_code[-6:]
    
    # Convert to actual tract number (divide by 100 for decimal places)
    tract_number = int(tract_code) / 100
    
    # Format as string, removing unnecessary decimal places
    if tract_number == int(tract_number):
        return str(int(tract_number))
    else:
        return f"{tract_number:.2f}".rstrip('0').rstrip('.')

print("FIPS Code → Census Tract Number")
print("================================")

tract_mappings = []
for fips_code in fips_codes:
    tract_num = decode_census_tract(fips_code)
    tract_mappings.append({
        "fips_code": fips_code,
        "tract_number": tract_num,
        "formatted": f"Census Tract {tract_num}"
    })
    print(f"{fips_code} → Census Tract {tract_num}")

print(f"\nTotal tracts: {len(tract_mappings)}")

# Save the mapping
with open("tract_number_mapping.json", "w") as f:
    json.dump(tract_mappings, f, indent=2)

print("\nMapping saved to: tract_number_mapping.json")
