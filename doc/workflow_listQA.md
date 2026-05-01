Bước 1: Sử dụng tài khoản:
username: jr-peiyabo-ty
password: biaozhu123.

Bước 1.1: Nhập Job ID

Bước 2: Truy cập vào link: http://global-autolabeling-service.evad.xiaomi.srv/appen/ui#/welcome

Bước 3: Điền Username vào ô:
xpath: /html/body/div/div/div[2]/div[2]/div/div/div/form/div[1]/div/div/div/div/span/input

Bước 4: Điền Password vào ô:
xpath: /html/body/div/div/div[2]/div[2]/div/div/div/form/div[2]/div/div/div/div/span/input

Bước 5: Click vào nút Login
xpath: /html/body/div[1]/div/div[2]/div[2]/div/div/div/form/button

Bước 6: Chọn BPO Job List
- Xpath: /html/body/div[1]/div/section/aside/div/div[2]/ul
- Tìm đến element chứa text "BPO Job List" trong ul trên
- Click vào element đó

Bước 7: Nhập text vào ô tìm kiếm Job ID:
- Xpath: /html/body/div[1]/div/section/div[2]/main/div/div[2]/div/div/form/div[1]/div/div[2]/div/div/span

Bước 8: Chọn nút "Search":
- Xpath: /html/body/div[1]/div/section/div[2]/main/div/div[2]/div/div/form/div[5]/button[1]

Bước 9: Click vào nút "View" ở cột số 7
xpath: /html/body/div[1]/div/section/div[2]/main/div/div[2]/div/div/div[2]/div/div/div/div/div/table/tbody/tr[2]/td[7]/button
text: "View"

Bước 10: Chọn "Data Center" trong thanh điều hướng:
xpath: /html/body/div[1]/div/section/div[2]/main/div/ul/li[2]

Bước 11: Chọn "Completed" 
- Xpath: /html/body/div[1]/div/section/div[2]/main/div/div[3]/div/div/div/div[1]/label[2]

Bước 12: Trích xuất text số items có trong trang: /html/body/div[1]/div/section/div[2]/main/div/div[3]/div/div/div/div[2]/div/div[2]/div/ul/li[1]

Vì chỉ có 10 items xuất hiện trong một trang, vậy nếu ví dụ text trả về là "total 59 items thì chúng ta sẽ ấn 5 lần nút next trang.
Lưu lại số lần next trang để biết khi nào dừng lại.

Bước 13: Trích xuất Record ID (cột 1) và cột Current worker (cột 2)
ví dụ: Record 12, Current worker: jr-peiyabo-ty

Bước 14:
xuất file csv: 
column 1: Job ID
column 2: Record ID, 
column 3: Current worker