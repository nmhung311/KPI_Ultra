Bước 1: Truy cập vào trang: https://chatgpt.com/
Bước 2: Nhập textfiel: "Xin chào bạn, tôi tên là Hùng labeling cho xe tự động lái!"
xpath: /html/body/div[2]/div/div[1]/div/div[2]/div/main/div/div/div[2]/div[1]/div/div/div/div/div[2]/form/div[2]/div/div[2]/div/textarea

Bước 3: Ấn nút gửi: /html/body/div[2]/div/div[1]/div/div[2]/div/main/div/div/div[2]/div[2]/div/div/div/div/div[2]/form/div[2]/div/div[3]/div/div[2]/button

Bước 4: Đợi câu trả lời rồi trích xuất lại, hiển thị ra logs
xpath câu trả lời: /html/body/div[2]/div/div[1]/div/div[2]/div/main/div/div/div[1]/div/section[2]/div/div/div[1]/div

## Chạy tự động (Selenium)

Trong thư mục `backend/`: `python3 bot.py` (mặc định dùng nội dung bước 2). Tùy chọn: `--message "..."`, `--headless`, `--page-wait 6`.

- Có Docker Selenium: đặt `SELENIUM_URL` (ví dụ `http://selenium:4444/wd/hub`) giống `kpi_automation.py`.
- Không có Remote: cần Chrome + `webdriver-manager` (đã trong `requirements.txt`).

Nếu ChatGPT đổi giao diện, cập nhật xpath trong `workflow_bot.md` và/hoặc bổ sung selector trong `bot.py` (`_locators_*`).