import undetected_chromedriver as uc
import time
import csv
import os
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException, UnexpectedAlertPresentException, NoSuchElementException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys

# === CONFIGURATION ===
LOGIN_URL = "https://www.atozdatabases.com/librarysignin?fromHttps=DB5B7CAF9B83E3399D181683DA41C1B7"
WAIT_TIME = 45
MAX_WAIT_FOR_IDS = 60
MAX_PAGES = 2305

OUTPUT_FILE = os.path.expanduser("~/Downloads/torrance_residents_data.csv")
PROGRESS_FILE = os.path.expanduser("~/Downloads/torrance_residents_progress.txt")

fieldnames = ["record_id", "first_name", "last_name", "address", "city_state", "zip", "phone"]
file_exists = os.path.exists(OUTPUT_FILE)

# Start browser
options = uc.ChromeOptions()
options.headless = False

driver = uc.Chrome(options=options)

print(f"🌐 Opening login page: {LOGIN_URL}")
driver.get(LOGIN_URL)
print(f"🔐 Please log in manually if prompted. You have {WAIT_TIME} seconds...")
time.sleep(WAIT_TIME)

print("📄 Page title:", driver.title)
print("🌍 URL:", driver.current_url)

# Load progress
start_page = 1
if os.path.exists(PROGRESS_FILE):
    with open(PROGRESS_FILE, "r") as pf:
        content = pf.read().strip()
        if content.startswith("last_scraped_page="):
            try:
                start_page = int(content.split("=")[-1])
            except ValueError:
                print("⚠️ Malformed progress file. Defaulting to page 1.")

with open(OUTPUT_FILE, mode="a", encoding="utf-8", newline="") as csvfile:
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    if not file_exists:
        writer.writeheader()

    if start_page > 1:
        try:
            print(f"🔁 Resuming from page {start_page}...")
            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.NAME, "paginationuppertextbox"))
            )
            page_input = driver.find_element(By.NAME, "paginationuppertextbox")
            page_input.clear()
            page_input.send_keys(str(start_page))
            page_input.send_keys(Keys.RETURN)
            WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='checkbox']"))
            )
            print("✅ Page loaded. Continuing scrape...")
        except Exception as e:
            print(f"❌ Failed to resume at page {start_page}: {e}")
            driver.quit()
            exit(1)

    for current_page in range(start_page, MAX_PAGES + 1):
        print(f"\n📄 Scraping page {current_page}...")

        found_ids = False
        for attempt in range(MAX_WAIT_FOR_IDS):
            checkboxes = driver.find_elements(By.CSS_SELECTOR, "input[name='checkbox']")
            if checkboxes:
                found_ids = True
                break
            time.sleep(1)

        if not found_ids:
            print(f"⏳ No IDs after {MAX_WAIT_FOR_IDS}s, retrying page refresh...")
            driver.refresh()
            time.sleep(5)

            for retry in range(MAX_WAIT_FOR_IDS):
                checkboxes = driver.find_elements(By.CSS_SELECTOR, "input[name='checkbox']")
                if checkboxes:
                    found_ids = True
                    break
                time.sleep(1)

        if not found_ids:
            print(f"❌ Still no IDs after refresh. Stopping at page {current_page}.")
            break

        soup = BeautifulSoup(driver.page_source, "html.parser")
        rows = soup.select("tr.search-result-stripe1, tr.search-result-stripe2")
        new_count = 0

        for row in rows:
            cols = row.find_all("td")
            if len(cols) >= 7:
                record_id = cols[0].find("input")["value"]
                writer.writerow({
                    "record_id": record_id,
                    "first_name": cols[1].get_text(strip=True),
                    "last_name": cols[2].get_text(strip=True),
                    "address": cols[3].get_text(strip=True),
                    "city_state": cols[4].get_text(strip=True),
                    "zip": cols[5].get_text(strip=True),
                    "phone": cols[6].get_text(strip=True) if len(cols) > 6 else ""
                })
                new_count += 1

        print(f"✅ Page {current_page}: {new_count} records written.")

        with open(PROGRESS_FILE, "w") as f:
            f.write(f"last_scraped_page={current_page}")

        try:
            WebDriverWait(driver, 60).until(
                EC.invisibility_of_element_located((By.CLASS_NAME, "ui-widget-overlay"))
            )
        except TimeoutException:
          print("⏳ Overlay did not disappear — checking for close button...")

          try:
              # Wait up to 10s for the dialog close button to appear
              close_button = WebDriverWait(driver, 10).until(
                  EC.visibility_of_element_located((By.CSS_SELECTOR, "a.ui-dialog-titlebar-close"))
              )
              close_button.click()
              print("✅ Overlay closed via dialog button.")

              # Wait again for checkboxes to appear
              WebDriverWait(driver, 60).until(
                  EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='checkbox']"))
              )

          except TimeoutException:
              print("❌ Close button did not appear — giving up on this page.")
              with open("debug_page.html", "w", encoding="utf-8") as f:
                  f.write(driver.page_source)
              driver.quit()
              exit(1)

        try:
            next_button = driver.find_element(By.ID, "next_button_upper")
            icon = driver.find_element(By.ID, "span_next_button_upper")
            if "disabled-button" in icon.get_attribute("class"):
                print("🛑 Reached final page.")
                break
            next_button.click()
            time.sleep(1)
        except NoSuchElementException:
            print("❌ Next button missing. Ending pagination.")
            with open("debug_page.html", "w", encoding="utf-8") as f:
                f.write(driver.page_source)

driver.quit()
