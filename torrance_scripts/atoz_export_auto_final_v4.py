import os
import time
import shutil
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# === CONFIG ===
DOWNLOAD_DIR = os.path.expanduser("~/Downloads")
EXPORT_DIR = os.path.expanduser("~/Downloads/atoz_exports")

def save_debug_snapshot(driver, page_num):
    screenshot_path = f"atoz_exports/debug_page_{page_num}.png"
    driver.save_screenshot(screenshot_path)
    print(f"📸 Screenshot saved: {screenshot_path}")

os.makedirs(EXPORT_DIR, exist_ok=True)

LOGIN_URL = "https://www.library.torranceca.gov/resources/online-resources/business-reference"
WAIT_TIME = 45
MAX_PAGES = 10000000

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
    WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.ID, "recordFilter")))
    record_dropdown = driver.find_element(By.ID, "recordFilter")
    record_dropdown.send_keys("100")
    time.sleep(0.5)
    print("✅ Records per page set to 100")
except Exception as e:
    print(f"⚠️ Could not set records per page: {e}")

# === LOOP OVER PAGES ===
for page_num in range(1, MAX_PAGES + 1):
    print(f"📄 Exporting page {page_num}...")

    retry_count = 0
    while retry_count < 2:
        try:
            # Wait for any overlay to clear
            WebDriverWait(driver, 30).until(
                EC.invisibility_of_element_located((By.CLASS_NAME, "ui-widget-overlay"))
            )
        except TimeoutException:
            print("⏳ Overlay stuck — attempting to close manually...")
            try:
                driver.find_element(By.CSS_SELECTOR, "a.ui-dialog-titlebar-close").click()
                WebDriverWait(driver, 10).until(
                    EC.invisibility_of_element_located((By.CLASS_NAME, "ui-widget-overlay"))
                )
                print("✅ Overlay closed manually.")
            except:
                print("❌ Manual close failed.")
                save_debug_snapshot(driver, page_num)
                break

        # Check if results loaded
        checkboxes = driver.find_elements(By.CSS_SELECTOR, "input[name='checkbox']")
        if not checkboxes:
            print(f"⚠️ No checkboxes found on page {page_num}. Refreshing (attempt {retry_count + 1})...")
            driver.refresh()
            time.sleep(1)
            retry_count += 1
            continue

        try:
            # Select all records
            select_all = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.ID, "checkall"))
            )
            select_all.click()
            time.sleep(0.5)
            print("✅ Selected all records on this page.")
        except Exception as e:
            print(f"⚠️ Could not select all records: {e}")
            save_debug_snapshot(driver, page_num)
            break

        # Handle 1000-record error modal
        try:
            WebDriverWait(driver, 5).until(
                EC.visibility_of_element_located((By.ID, "maxRecordCountModal"))
            )
            print("⚠️ Too many records selected — closing modal and refreshing page.")
            try:
                modal_close_btn = driver.find_element(
                    By.XPATH,
                    "//div[@id='maxRecordCountModal']/following-sibling::div[contains(@class, 'ui-dialog-buttonpane')]//button[.//span[text()='Close']]"
                )
                modal_close_btn.click()
            except NoSuchElementException:
                driver.find_element(By.CSS_SELECTOR, "a.ui-dialog-titlebar-close").click()
            time.sleep(0.5)
            driver.refresh()
            retry_count += 1
            continue
        except TimeoutException:
            pass  # no modal

        try:
            # Click download
            WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.CLASS_NAME, "jQDownloadPopUp"))
            ).click()
            time.sleep(0.5)

            # Format and detail view
            WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.ID, "download_format1"))
            ).click()
            WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.ID, "download_level_detail1"))
            ).click()

            # Set filename
            custom_name_input = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.ID, "_customName"))
            )
            custom_name_input.clear()
            custom_name_input.send_keys(f"page{page_num}_fulldetail_torrance")
            print(f"📝 Set export filename to: page{page_num}_fulldetail_torrance")

            # Press continue
            WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "button.download-continue"))
            ).click()
            print("✅ Pressed 'Continue' in modal.")

            # Wait for download overlay to disappear
            WebDriverWait(driver, 5).until(
                EC.invisibility_of_element_located((By.CLASS_NAME, "ui-widget-overlay"))
            )
            print("✅ Download overlay cleared.")

        except Exception as e:
            print(f"❌ Download step failed on page {page_num}: {e}")
            save_debug_snapshot(driver, page_num)
            break

        # Click next
        try:
            next_button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.ID, "next_button_upper"))
            )
            next_button.click()
            time.sleep(0.5)
            print("➡️ Next page loaded.")
        except Exception as e:
            print(f"❌ Could not click next on page {page_num}: {e}")
            save_debug_snapshot(driver, page_num)
            break

        break  # end retry loop

print("🏁 Done.")
driver.quit()
