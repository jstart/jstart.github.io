import os
import time
import shutil
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, UnexpectedAlertPresentException, NoSuchElementException

# === CONFIG ===
DOWNLOAD_DIR = os.path.expanduser("~/Downloads")
EXPORT_DIR = os.path.expanduser("~/Downloads/atoz_exports")

def save_debug_snapshot(driver, page_num):
    screenshot_path = f"atoz_exports/debug_page_{page_num}.png"
    driver.save_screenshot(screenshot_path)
    print(f"📸 Screenshot saved: {screenshot_path}")

os.makedirs(EXPORT_DIR, exist_ok=True)

LOGIN_URL = "https://www.atozdatabases.com/librarysignin?fromHttps=DB5B7CAF9B83E3399D181683DA41C1B7"
WAIT_TIME = 45
MAX_PAGES = 10000000
DOWNLOAD_WAIT = 20

# === START DRIVER ===
options = uc.ChromeOptions()
options.headless = False
driver = uc.Chrome(options=options)

print("🌐 Opening login page...")
driver.get(LOGIN_URL)
print(f"⏳ Waiting {WAIT_TIME}s for manual login if needed...")
time.sleep(WAIT_TIME)

# === SET RECORDS PER PAGE TO 100 ===
try:
    WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.ID, "recordFilter")))
    record_dropdown = driver.find_element(By.ID, "recordFilter")
    record_dropdown.send_keys("100")
    time.sleep(3)
    print("✅ Records per page set to 100")
except Exception as e:
    print(f"⚠️ Could not set records per page: {e}")



# === LOOP OVER PAGES ===
for page_num in range(1, MAX_PAGES + 1):
    print(f"📄 Exporting page {page_num}...")
    # Select all 100 records before download
    try:
        select_all = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, "checkall"))
        )
        select_all.click()
        time.sleep(0.5)  # wait a moment for selection to apply
        print("✅ Selected all records on this page.")
    except Exception as e:
        print(f"⚠️ Could not select all records: {e}")
    try:
        # Wait for any blocking overlays to disappear before clicking Download
        try:
            WebDriverWait(driver, 30).until(
                EC.invisibility_of_element_located((By.CLASS_NAME, "ui-widget-overlay"))
            )
        except TimeoutException:
            print(f"⚠️ Overlay still present on page {page_num}. Saving debug snapshot.")
            save_debug_snapshot(driver, page_num)
            continue  # skip this page
        # Check for max record count warning modal
        try:
            WebDriverWait(driver, 5).until(
                EC.visibility_of_element_located((By.ID, "maxRecordCountModal"))
            )
            print("⚠️ Too many records selected — closing modal and refreshing page.")

            # Click the 'Close' button inside the modal
            close_button = driver.find_element(By.XPATH, "//div[@id='maxRecordCountModal']/following-sibling::div[contains(@class, 'ui-dialog-buttonpane')]//button[span[text()='Close']]")
            close_button.click()
            time.sleep(2)

            # Refresh the page and wait for checkboxes
            driver.refresh()
            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='checkbox']"))
            )
            print("🔄 Page refreshed after record count modal.")
            continue  # Skip the rest of this loop and start clean
        except TimeoutException:
            pass  # No modal, continue as normal
        # Click Download
        WebDriverWait(driver, 20).until(EC.element_to_be_clickable((By.CLASS_NAME, "jQDownloadPopUp"))).click()
        time.sleep(0.5)

        # Select Format: CSV
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID, "download_format1"))).click()

        # Select Level of Detail: Detail View
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID, "download_level_detail1"))).click()

        # Set custom filename in the export modal
        try:
            custom_name_input = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "_customName"))
            )
            custom_name_input.clear()
            custom_name_input.send_keys(f"page{page_num}_fulldetail_torrance")
            print(f"📝 Set export filename to: page{page_num}_fulldetail_torrance")
        except Exception as e:
            print(f"⚠️ Could not set custom filename: {e}")

        # Click the Continue button in the download modal
        try:
            continue_btn = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "button.download-continue"))
            )
            continue_btn.click()
            print("✅ Pressed 'Continue' in modal.")
        except Exception as e:
            print(f"❌ Could not click 'Continue': {e}")

        # Wait for file to appear in Downloads
        # downloaded = False
        # for _ in range(DOWNLOAD_WAIT):
        #     files = [f for f in os.listdir(DOWNLOAD_DIR) if f.endswith(".csv")]
        #     if files:
        #         latest = max([os.path.join(DOWNLOAD_DIR, f) for f in files], key=os.path.getctime)
        #         target_path = os.path.join(EXPORT_DIR, f"page_{page_num}.csv")
        #         shutil.move(latest, target_path)
        #         print(f"✅ Saved: {target_path}")
        #         downloaded = True
        #         break
        #     time.sleep(1)

        # if not downloaded:
        #     print(f"❌ Download failed on page {page_num}")
        # Close download modal
        # try:
        #     close_btn = driver.find_element(By.CSS_SELECTOR, "a.ui-dialog-titlebar-close")
        #     close_btn.click()
        #     print("✅ Closed export modal.")
        # except Exception as e:
        #     print("⚠️ Could not close modal (may already be gone).")

        # Wait for the modal overlay to disappear before clicking next
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

        next_button = driver.find_element(By.ID, "next_button_upper")
        next_button.click()
        time.sleep(0.5)
        print("➡️ Next page loaded.")

    except Exception as e:
        save_debug_snapshot(driver, page_num)
        print(f"❌ Error on page {page_num}: {e}")
        break

print("🏁 Done.")
driver.quit()
