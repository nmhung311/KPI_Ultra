import argparse
import logging
import os
import time
import math
import pandas as pd
import re

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service


URL = "http://global-autolabeling-service.evad.xiaomi.srv/appen/ui#/welcome"
USERNAME = "jr-peiyabo-ty"
PASSWORD = "biaozhu123."

XPATH_USERNAME = "/html/body/div/div/div[2]/div[2]/div/div/div/form/div[1]/div/div/div/div/span/input"
XPATH_PASSWORD = "/html/body/div/div/div[2]/div[2]/div/div/div/form/div[2]/div/div/div/div/span/input"
XPATH_LOGIN_BUTTON = "/html/body/div[1]/div/div[2]/div[2]/div/div/div/form/button"
XPATH_BPO_MENU_UL = "/html/body/div[1]/div/section/aside/div/div[2]/ul"
XPATH_JOB_SEARCH_CONTAINER = "/html/body/div[1]/div/section/div[2]/main/div/div[2]/div/div/form/div[1]/div/div[2]/div/div/span"
XPATH_SEARCH_BUTTON = "/html/body/div[1]/div/section/div[2]/main/div/div[2]/div/div/form/div[5]/button[1]"
XPATH_VIEW_BUTTON = "/html/body/div[1]/div/section/div[2]/main/div/div[2]/div/div/div[2]/div/div/div/div/div/table/tbody/tr[2]/td[7]/button"
XPATH_DATA_CENTER_UL = "/html/body/div[1]/div/section/div[2]/main/div/ul/li[2]"
XPATH_COMPLETED_LABEL = "/html/body/div[1]/div/section/div[2]/main/div/div[3]/div/div/div/div[1]/label[2]"
XPATH_TOTAL_ITEMS = "/html/body/div[1]/div/section/div[2]/main/div/div[3]/div/div/div/div[2]/div/div[2]/div/ul/li[1]"
XPATH_TABLE_BODY = "/html/body/div[1]/div/section/div[2]/main/div/div[3]/div/div/div/div[2]/div/div[1]/div/div/div/div/div/table/tbody"
XPATH_VALID_BUTTON = "/html/body/div[1]/div/div/div[2]/div[1]/div[2]/div/div/div[3]/div[1]/div[2]/button"
STEP_DELAY_SECONDS = 0.5


logging.basicConfig(
	level=logging.INFO,
	format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Selenium automation for workflow steps 1-8."
	)
	parser.add_argument("--job-id", required=True, help="Job ID to search")
	parser.add_argument(
		"--headless",
		action="store_true",
		help="Run browser in headless mode",
	)
	return parser.parse_args()


def create_driver(headless: bool = False) -> webdriver.Chrome | webdriver.Remote:
	options = webdriver.ChromeOptions()
	if headless:
		options.add_argument("--headless=new")
	options.add_argument("--start-maximized")
	options.add_argument("--no-sandbox")
	options.add_argument("--disable-dev-shm-usage")
	
	selenium_url = os.getenv("SELENIUM_URL")
	if selenium_url:
		return webdriver.Remote(command_executor=selenium_url, options=options)
	else:
		service = Service(ChromeDriverManager().install())
		return webdriver.Chrome(service=service, options=options)


def fill_job_search_input(wait: WebDriverWait, job_id: str) -> None:
	logger.info("Step 7: entering Job ID %s", job_id)
	container = wait.until(
		EC.element_to_be_clickable((By.XPATH, XPATH_JOB_SEARCH_CONTAINER))
	)
	container.click()

	# Some ant-design inputs wrap a hidden/active input inside the span container.
	input_xpath = f"{XPATH_JOB_SEARCH_CONTAINER}//input"
	try:
		target_input = wait.until(EC.visibility_of_element_located((By.XPATH, input_xpath)))
	except Exception:
		# Fallback to the nearest visible input if structure changes slightly.
		target_input = wait.until(
			EC.visibility_of_element_located(
				(By.CSS_SELECTOR, "input[role='combobox'], input.ant-select-selection-search-input")
			)
		)

	target_input.clear()
	target_input.send_keys(job_id)
	time.sleep(STEP_DELAY_SECONDS)


def log_no_new_tab_expected() -> None:
	logger.info("Step 9: View does not open a new tab; staying on current tab")


def extract_number(record_id: str) -> int:
	match = re.search(r'\d+', record_id)
	return int(match.group()) if match else 0


def process_records(driver: webdriver.Chrome, wait: WebDriverWait, job_id: str) -> list:
	# Step 12
	logger.info("Step 12: Extracting total items")
	try:
		total_el = wait.until(EC.presence_of_element_located((By.XPATH, XPATH_TOTAL_ITEMS)))
		total_text = total_el.text.strip()
		logger.info("Total text found: %s", total_text)
	except Exception as e:
		logger.warning("Could not find total items text: %s", e)
		total_text = ""
	
	total_items = 0
	match = re.search(r'\d+', total_text)
	if match:
		total_items = int(match.group())
		logger.info("Parsed total items: %d", total_items)
	else:
		logger.warning("Could not parse total items from text, assuming 1 page.")
	
	total_pages = math.ceil(total_items / 10) if total_items > 0 else 1
	logger.info("Total pages to process: %d", total_pages)

	results = []
	main_window = driver.current_window_handle
	
	for page_idx in range(total_pages):
		logger.info("Processing page %d/%d", page_idx + 1, total_pages)
		
		try:
			tbody = wait.until(EC.presence_of_element_located((By.XPATH, XPATH_TABLE_BODY)))
			rows = tbody.find_elements(By.XPATH, "./tr")
			row_count = len(rows)
			logger.info("Found %d rows on page", row_count)
		except Exception as e:
			logger.error("Could not find table body: %s", e)
			row_count = 0
			
		for r_idx in range(row_count):
			try:
				tbody = wait.until(EC.presence_of_element_located((By.XPATH, XPATH_TABLE_BODY)))
				current_rows = tbody.find_elements(By.XPATH, "./tr")
				if r_idx >= len(current_rows):
					break
					
				row = current_rows[r_idx]
				cols = row.find_elements(By.TAG_NAME, "td")
				
				if len(cols) < 3:
					continue
					
				record_id = cols[1].get_attribute("textContent").strip()
				worker = cols[2].get_attribute("textContent").strip()
				
				if record_id:
					results.append({
						"Job ID": job_id,
						"Record ID": record_id,
						"Current worker": worker
					})
					logger.info("Extracted Record: %s, Worker: %s", record_id, worker)
			except Exception as e:
				logger.error("Error in row %d: %s", r_idx, e)
				
		if page_idx < total_pages - 1:
			logger.info("Clicking Next Page button")
			try:
				next_btn_xpath = "//button[contains(@class, 'btn-next')] | //li[contains(@title, 'Next Page')] | //li[contains(@class, 'ant-pagination-next')]"
				next_btn = driver.find_element(By.XPATH, next_btn_xpath)
				driver.execute_script("arguments[0].scrollIntoView({block: 'center'}); arguments[0].click();", next_btn)
				time.sleep(3)
			except Exception as e:
				logger.error("Failed to click next page: %s", e)
				break
				
	return results


def export_results(results: list) -> None:
	logger.info("Step 14: Exporting to CSV")
	if not results:
		logger.warning("No results to export")
		return
		
	results.sort(key=lambda x: extract_number(x["Record ID"]))
	df = pd.DataFrame(results)
	df.to_csv("list_qa_results.csv", index=False, columns=["Job ID", "Record ID", "Current worker"])
	logger.info("Exported to list_qa_results.csv")


def run_automation(job_id: str, headless: bool = False) -> list:
	driver = create_driver(headless=headless)
	wait = WebDriverWait(driver, 20)

	try:
		logger.info("Starting workflow for Job ID %s", job_id)

		# Step 2
		logger.info("Step 2: opening %s", URL)
		driver.get(URL)
		time.sleep(STEP_DELAY_SECONDS)

		# Step 3-4
		logger.info("Step 3: filling username")
		wait.until(EC.visibility_of_element_located((By.XPATH, XPATH_USERNAME))).send_keys(USERNAME)
		logger.info("Step 4: filling password")
		wait.until(EC.visibility_of_element_located((By.XPATH, XPATH_PASSWORD))).send_keys(PASSWORD)
		time.sleep(STEP_DELAY_SECONDS)

		# Step 5
		logger.info("Step 5: clicking Login")
		wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_LOGIN_BUTTON))).click()
		time.sleep(STEP_DELAY_SECONDS)

		# Step 6
		logger.info("Step 6: opening BPO Job List")
		menu_ul = wait.until(EC.presence_of_element_located((By.XPATH, XPATH_BPO_MENU_UL)))
		bpo_job_list = menu_ul.find_element(By.XPATH, ".//*[contains(normalize-space(), 'BPO Job List')]")
		wait.until(EC.element_to_be_clickable(bpo_job_list)).click()
		time.sleep(STEP_DELAY_SECONDS)

		# Step 7
		fill_job_search_input(wait, job_id)

		# Step 8
		logger.info("Step 8: clicking Search")
		wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_SEARCH_BUTTON))).click()
		time.sleep(STEP_DELAY_SECONDS)

		# Step 9
		logger.info("Step 9: clicking View in column 7")
		wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_VIEW_BUTTON))).click()
		log_no_new_tab_expected()
		time.sleep(STEP_DELAY_SECONDS)

		# Step 10
		logger.info("Step 10: selecting Data Center")
		wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_DATA_CENTER_UL))).click()
		time.sleep(STEP_DELAY_SECONDS)

		# Step 11
		logger.info("Step 11: selecting Completed")
		wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_COMPLETED_LABEL))).click()
		time.sleep(STEP_DELAY_SECONDS)

		# Process records (Steps 12 - 16)
		results = process_records(driver, wait, job_id)
		
		# Export results (Step 17)
		export_results(results)

		logger.info("Finished workflow for Job ID %s", job_id)
		time.sleep(2)
		return results
	finally:
		logger.info("Closing browser")
		driver.quit()


if __name__ == "__main__":
	args = parse_args()
	run_automation(job_id=args.job_id, headless=args.headless)
