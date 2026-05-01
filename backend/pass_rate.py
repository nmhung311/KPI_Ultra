import argparse
import logging
import math
import os
import re
import time
from typing import Any

import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


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
XPATH_MONITOR_TAB = "/html/body/div/div/section/div[2]/main/div/ul/li[3]"
XPATH_TOTAL_ITEMS = "/html/body/div/div/section/div[2]/main/div/div[3]/div/div/div[3]/div[2]/div/div/div/ul/li[1]"
XPATH_MONITOR_TABLE = "/html/body/div[1]/div/section/div[2]/main/div/div[3]/div/div/div[3]/div[2]/div/div/div/div/div/div/table"
XPATH_MONITOR_TABLE_BODY = f"{XPATH_MONITOR_TABLE}/tbody"

STEP_DELAY_SECONDS = 0.5


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract monitor pass-rate table to CSV.")
    parser.add_argument("--job-id", required=True, help="Job ID to search in BPO Job List")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode")
    parser.add_argument(
        "--output",
        default="pass_rate_results.csv",
        help="Output CSV path (default: pass_rate_results.csv)",
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

    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)


def fill_job_search_input(wait: WebDriverWait, job_id: str) -> None:
    logger.info("Step 7: entering Job ID %s", job_id)
    container = wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_JOB_SEARCH_CONTAINER)))
    container.click()

    input_xpath = f"{XPATH_JOB_SEARCH_CONTAINER}//input"
    try:
        target_input = wait.until(EC.visibility_of_element_located((By.XPATH, input_xpath)))
    except Exception:
        target_input = wait.until(
            EC.visibility_of_element_located(
                (By.CSS_SELECTOR, "input[role='combobox'], input.ant-select-selection-search-input")
            )
        )

    target_input.clear()
    target_input.send_keys(job_id)
    time.sleep(STEP_DELAY_SECONDS)


def parse_total_items(text: str) -> int:
    match = re.search(r"\d+", text or "")
    return int(match.group()) if match else 0


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def parse_workload_value(raw_text: str, label_name: str) -> str:
    """
    Extract numeric hours from strings like:
    - "Labeling Workload:2.12"
    - "Rework Workload:0.34"
    """
    text = normalize_space(raw_text)
    pattern = rf"{re.escape(label_name)}\s*:\s*([0-9]+(?:\.[0-9]+)?)"
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(1)
    # Fallback: pick the first number if label is not present.
    fallback = re.search(r"([0-9]+(?:\.[0-9]+)?)", text)
    return fallback.group(1) if fallback else ""


def get_row_text(cell: Any) -> str:
    return normalize_space(cell.get_attribute("textContent") or "")


def click_next_page(driver: webdriver.Chrome) -> bool:
    next_btn_xpath = (
        "//li[contains(@class,'ant-pagination-next') and not(contains(@class,'ant-pagination-disabled'))]"
        " | //button[contains(@class,'btn-next') and not(@disabled)]"
        " | //li[contains(@title, 'Next Page') and not(contains(@class,'disabled'))]"
    )
    try:
        next_btn = driver.find_element(By.XPATH, next_btn_xpath)
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", next_btn)
        driver.execute_script("arguments[0].click();", next_btn)
        time.sleep(1.5)
        return True
    except Exception:
        return False


def extract_pass_rate_rows(driver: webdriver.Chrome, wait: WebDriverWait) -> list[dict[str, str]]:
    logger.info("Step 12: reading total items")
    try:
        total_el = wait.until(EC.presence_of_element_located((By.XPATH, XPATH_TOTAL_ITEMS)))
        total_text = total_el.text.strip()
    except Exception:
        total_text = ""
    total_items = parse_total_items(total_text)
    total_pages = max(1, math.ceil(total_items / 10)) if total_items else 1
    logger.info("Monitor total items: %s | total pages: %d", total_text or "unknown", total_pages)

    results: list[dict[str, str]] = []

    for page_idx in range(total_pages):
        logger.info("Scraping monitor page %d/%d", page_idx + 1, total_pages)
        try:
            wait.until(EC.presence_of_element_located((By.XPATH, XPATH_MONITOR_TABLE)))
            tbody = wait.until(EC.presence_of_element_located((By.XPATH, XPATH_MONITOR_TABLE_BODY)))
            rows = tbody.find_elements(By.XPATH, "./tr")
        except Exception as exc:
            logger.warning("Cannot read monitor table body on page %d: %s", page_idx + 1, exc)
            rows = []

        for row in rows:
            cols = row.find_elements(By.TAG_NAME, "td")
            # workflow_pass_rate.md: Contributor=td[1], Total Workload(h)=td[4], Pass Rate=td[5]
            if len(cols) < 5:
                continue

            username = get_row_text(cols[0])  # td[1]
            pass_rate_text = get_row_text(cols[4])  # td[5]

            if not username:
                continue

            try:
                label_text = get_row_text(row.find_element(By.XPATH, "./td[4]/div[1]"))
                rework_text = get_row_text(row.find_element(By.XPATH, "./td[4]/div[2]"))
            except Exception:
                workload_text = get_row_text(cols[3])  # td[4] fallback as combined text
                label_text = workload_text
                rework_text = workload_text

            label_hours = parse_workload_value(label_text, "Labeling Workload")
            rework_hours = parse_workload_value(rework_text, "Rework Workload")
            pass_rate_text = pass_rate_text.replace("%", "").strip()

            results.append(
                {
                    "username": username,
                    "Thời gian label": label_hours,
                    "Thời gian sửa bài": rework_hours,
                    "Tỉ lệ chính xác": pass_rate_text,
                }
            )

        if page_idx < total_pages - 1:
            if not click_next_page(driver):
                logger.warning("Could not move to next page at page %d, stopping early.", page_idx + 1)
                break

    return results


def export_results(rows: list[dict[str, str]], output_path: str) -> None:
    if not rows:
        logger.warning("No pass-rate rows extracted, CSV not written.")
        return
    df = pd.DataFrame(rows)
    df.to_csv(
        output_path,
        index=False,
        encoding="utf-8-sig",
        columns=["username", "Thời gian label", "Thời gian sửa bài", "Tỉ lệ chính xác"],
    )
    logger.info("Exported %d rows to %s", len(rows), output_path)


def run_automation(job_id: str, headless: bool = False, output_path: str = "pass_rate_results.csv") -> list[dict[str, str]]:
    driver = create_driver(headless=headless)
    wait = WebDriverWait(driver, 20)

    try:
        logger.info("Step 2: opening %s", URL)
        driver.get(URL)
        time.sleep(STEP_DELAY_SECONDS)

        logger.info("Step 3-4: filling credentials")
        wait.until(EC.visibility_of_element_located((By.XPATH, XPATH_USERNAME))).send_keys(USERNAME)
        wait.until(EC.visibility_of_element_located((By.XPATH, XPATH_PASSWORD))).send_keys(PASSWORD)
        time.sleep(STEP_DELAY_SECONDS)

        logger.info("Step 5: clicking Login")
        wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_LOGIN_BUTTON))).click()
        time.sleep(STEP_DELAY_SECONDS)

        logger.info("Step 6: opening BPO Job List")
        menu_ul = wait.until(EC.presence_of_element_located((By.XPATH, XPATH_BPO_MENU_UL)))
        bpo_job_list = menu_ul.find_element(By.XPATH, ".//*[contains(normalize-space(), 'BPO Job List')]")
        wait.until(EC.element_to_be_clickable(bpo_job_list)).click()
        time.sleep(STEP_DELAY_SECONDS)

        fill_job_search_input(wait, job_id)

        logger.info("Step 8: clicking Search")
        wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_SEARCH_BUTTON))).click()
        time.sleep(STEP_DELAY_SECONDS)

        logger.info("Step 9: clicking View")
        wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_VIEW_BUTTON))).click()
        time.sleep(STEP_DELAY_SECONDS)

        logger.info("Step 10: opening Monitor tab")
        wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_MONITOR_TAB))).click()
        time.sleep(1)

        rows = extract_pass_rate_rows(driver, wait)
        export_results(rows, output_path)
        return rows
    finally:
        logger.info("Closing browser")
        driver.quit()


if __name__ == "__main__":
    args = parse_args()
    run_automation(job_id=args.job_id, headless=args.headless, output_path=args.output)
