#!/usr/bin/env python3
"""
Selenium bot theo workflow doc/workflow_bot.md:
  1) Mở https://chatgpt.com/
  2) Nhập tin nhắn vào ô chat
  3) Gửi
  4) Đợi phản hồi và ghi log

Chạy trong backend/:
  SELENIUM_URL=http://selenium:4444/wd/hub python3 bot.py
  python3 bot.py --headless
  python3 bot.py --message "Câu hỏi của bạn"

Giao diện ChatGPT hay đổi — nếu lỗi không tìm thấy phần tử, cập nhật XPATH_* trong file này
hoặc bổ sung selector trong _locators_*.
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

CHAT_URL = "https://chatgpt.com/"
DEFAULT_MESSAGE = "Xin chào bạn, tôi tên là Hùng labeling cho xe tự động lái!"

# Theo doc/workflow_bot.md (có thể lỗi thời khi OpenAI đổi DOM)
XPATH_TEXTAREA = (
    "/html/body/div[2]/div/div[1]/div/div[2]/div/main/div/div/div[2]/div[1]/div/div/div/div/div[2]/form/div[2]/div/div[2]/div/textarea"
)
XPATH_SEND = (
    "/html/body/div[2]/div/div[1]/div/div[2]/div/main/div/div/div[2]/div[2]/div/div/div/div/div[2]/form/div[2]/div/div[3]/div/div[2]/button"
)
XPATH_REPLY = (
    "/html/body/div[2]/div/div[1]/div/div[2]/div/main/div/div/div[1]/div/section[2]/div/div/div[1]/div"
)


def _locators_textarea():
    return [
        (By.XPATH, XPATH_TEXTAREA),
        (By.CSS_SELECTOR, "textarea[data-id]"),
        (By.CSS_SELECTOR, "textarea#prompt-textarea"),
        (By.CSS_SELECTOR, "div[contenteditable='true'][data-placeholder]"),
        (By.TAG_NAME, "textarea"),
    ]


def _locators_send():
    return [
        (By.XPATH, XPATH_SEND),
        (By.CSS_SELECTOR, "button[data-testid='send-button']"),
        (By.CSS_SELECTOR, "button[aria-label*='Send']"),
        (By.CSS_SELECTOR, "button[aria-label*='send']"),
    ]


def _first_present(driver, wait: WebDriverWait, locators: list[tuple[By, str]], desc: str):
    last: Exception | None = None
    for by, sel in locators:
        try:
            el = wait.until(EC.presence_of_element_located((by, sel)))
            logger.info("Tìm thấy %s: %s %r", desc, by, sel[:80] + ("..." if len(sel) > 80 else ""))
            return el
        except Exception as e:
            last = e
    raise TimeoutException(f"Không tìm thấy {desc}: {last}") from last


def _first_clickable(wait: WebDriverWait, locators: list[tuple[By, str]], desc: str):
    last: Exception | None = None
    for by, sel in locators:
        try:
            el = wait.until(EC.element_to_be_clickable((by, sel)))
            logger.info("Click được %s: %s", desc, sel[:80])
            return el
        except Exception as e:
            last = e
    raise TimeoutException(f"Không click được {desc}: {last}") from last


def create_driver(headless: bool) -> webdriver.Remote | webdriver.Chrome:
    options = webdriver.ChromeOptions()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1400,900")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")

    selenium_url = os.environ.get("SELENIUM_URL")
    if selenium_url:
        logger.info("Dùng Remote WebDriver: %s", selenium_url.split("@")[-1] if "@" in selenium_url else selenium_url)
        return webdriver.Remote(command_executor=selenium_url, options=options)
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)


def _element_text(el) -> str:
    t = (el.text or "").strip()
    if t:
        return t
    try:
        return (el.get_attribute("innerText") or "").strip()
    except Exception:
        return ""


def wait_for_reply(driver, wait: WebDriverWait, timeout: int = 120) -> str:
    """Ưu tiên xpath doc; fallback: tin nhắn assistant cuối cùng."""
    deadline = time.monotonic() + timeout
    last_snapshot = ""

    while time.monotonic() < deadline:
        # Thử xpath cố định trong doc
        try:
            el = driver.find_element(By.XPATH, XPATH_REPLY)
            txt = _element_text(el)
            if len(txt) > 10:
                return txt
        except Exception:
            pass

        try:
            nodes = driver.find_elements(By.CSS_SELECTOR, "div[data-message-author-role='assistant']")
            if nodes:
                txt = _element_text(nodes[-1])
                if txt and txt != last_snapshot:
                    last_snapshot = txt
                    time.sleep(1.5)
                    nodes2 = driver.find_elements(By.CSS_SELECTOR, "div[data-message-author-role='assistant']")
                    if nodes2 and _element_text(nodes2[-1]) == txt:
                        return txt
        except Exception:
            pass

        time.sleep(0.6)

    raise TimeoutError(f"Sau {timeout}s vẫn chưa có nội dung phản hồi (kiểm tra đăng nhập / captcha / DOM).")


def run(message: str, headless: bool, page_wait: int) -> int:
    driver = create_driver(headless)
    wait = WebDriverWait(driver, 25)
    try:
        logger.info("Bước 1: Mở %s", CHAT_URL)
        driver.get(CHAT_URL)
        time.sleep(max(1, page_wait))

        logger.info("Bước 2: Nhập tin nhắn")
        box = _first_present(driver, wait, _locators_textarea(), "ô nhập")
        try:
            box.click()
        except Exception:
            pass
        try:
            box.clear()
        except Exception:
            pass
        box.send_keys(message)
        time.sleep(0.3)

        logger.info("Bước 3: Gửi")
        send_btn = _first_clickable(wait, _locators_send(), "nút gửi")
        send_btn.click()

        logger.info("Bước 4: Đợi phản hồi…")
        reply = wait_for_reply(driver, wait)
        logger.info("--- Câu trả lời (trích xuất) ---\n%s", reply)
        return 0
    except TimeoutException as e:
        logger.error("Timeout / không tìm thấy phần tử: %s", e)
        return 1
    except Exception as e:
        logger.exception("Lỗi: %s", e)
        return 1
    finally:
        try:
            driver.quit()
        except Exception:
            pass


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="ChatGPT workflow bot (Selenium) — doc/workflow_bot.md")
    p.add_argument(
        "--message",
        default=DEFAULT_MESSAGE,
        help="Nội dung gửi lên ChatGPT",
    )
    p.add_argument("--headless", action="store_true", help="Chạy headless")
    p.add_argument(
        "--page-wait",
        type=int,
        default=4,
        help="Giây chờ sau khi load trang (cookie/consent)",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    return run(args.message, args.headless, args.page_wait)


if __name__ == "__main__":
    sys.exit(main())
