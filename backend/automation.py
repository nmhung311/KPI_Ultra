from kpi_automation import (
    create_driver, URL, XPATH_USERNAME, XPATH_PASSWORD, XPATH_LOGIN_BUTTON, 
    XPATH_BPO_MENU_UL, fill_job_search_input, XPATH_SEARCH_BUTTON, XPATH_VIEW_BUTTON, 
    log_no_new_tab_expected, XPATH_DATA_CENTER_UL, XPATH_COMPLETED_LABEL, 
    process_records, export_results, STEP_DELAY_SECONDS, logger
)
import time
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

class KPIAutomation:
    def __init__(self, username, password, job_id):
        self.username = username
        self.password = password
        self.job_id = job_id
        self.progress = 0
        self.stop_requested = False

    def request_stop(self):
        self.stop_requested = True

    def run(self):
        driver = create_driver(headless=True)
        wait = WebDriverWait(driver, 20)
        try:
            logger.info("Starting workflow for Job ID %s", self.job_id)
            self.progress = 5

            driver.get(URL)
            time.sleep(STEP_DELAY_SECONDS)

            wait.until(EC.visibility_of_element_located((By.XPATH, XPATH_USERNAME))).send_keys(self.username)
            wait.until(EC.visibility_of_element_located((By.XPATH, XPATH_PASSWORD))).send_keys(self.password)
            time.sleep(STEP_DELAY_SECONDS)
            self.progress = 10

            wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_LOGIN_BUTTON))).click()
            time.sleep(STEP_DELAY_SECONDS)

            menu_ul = wait.until(EC.presence_of_element_located((By.XPATH, XPATH_BPO_MENU_UL)))
            bpo_job_list = menu_ul.find_element(By.XPATH, ".//*[contains(normalize-space(), 'BPO Job List')]")
            wait.until(EC.element_to_be_clickable(bpo_job_list)).click()
            time.sleep(STEP_DELAY_SECONDS)
            self.progress = 20

            fill_job_search_input(wait, self.job_id)

            wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_SEARCH_BUTTON))).click()
            time.sleep(STEP_DELAY_SECONDS)
            self.progress = 30

            wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_VIEW_BUTTON))).click()
            log_no_new_tab_expected()
            time.sleep(STEP_DELAY_SECONDS)

            wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_DATA_CENTER_UL))).click()
            time.sleep(STEP_DELAY_SECONDS)

            wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_COMPLETED_LABEL))).click()
            time.sleep(STEP_DELAY_SECONDS)
            self.progress = 40

            results = process_records(driver, wait, self.job_id)
            
            export_results(results)
            
            self.progress = 100
            logger.info("Finished workflow for Job ID %s", self.job_id)
            return results
        finally:
            logger.info("Closing browser")
            driver.quit()
