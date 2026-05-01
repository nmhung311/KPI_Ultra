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

Bước 10: Click vào "Monitor"
xpath: /html/body/div/div/section/div[2]/main/div/ul/li[3]

Bước 12: Trích xuất text số items có trong trang: /html/body/div/div/section/div[2]/main/div/div[3]/div/div/div[3]/div[2]/div/div/div/ul/li[1]

Vì chỉ có 10 items xuất hiện trong một trang, vậy nếu ví dụ text trả về là "total 59 items thì chúng ta sẽ ấn 5 lần nút next trang.
Lưu lại số lần next trang để biết khi nào dừng lại.

Bước 13: Trích xuất tỉ lệ chính xác trong bảng: xpath: /html/body/div[1]/div/section/div[2]/main/div/div[3]/div/div/div[3]/div[2]/div/div/div/div/div/div/table

Cột 1: Contributor ví dụ: jr-tangtuanminh-ty
xpath: /html/body/div[1]/div/section/div[2]/main/div/div[3]/div/div/div[3]/div[2]/div/div/div/div/div/div/table/tbody/tr[1]/td[1]
Cột 3:  Total Workload(h) ví dụ:
Labeling Workload:2.12 xpath: /html/body/div[1]/div/section/div[2]/main/div/div[3]/div/div/div[3]/div[2]/div/div/div/div/div/div/table/tbody/tr[1]/td[4]/div[1]
Rework Workload:0.34 xpath: /html/body/div[1]/div/section/div[2]/main/div/div[3]/div/div/div[3]/div[2]/div/div/div/div/div/div/table/tbody/tr[1]/td[4]/div[2]
Lưu ý ở cột cell có 2 dòng. Tôi cần bạn trích xuất chính xác text "Labeling Workload" và "Rework Workload" để lấy số giờ phía sau
Cột 5: Pass Rate ví dụ: 61.54 % xpath: /html/body/div[1]/div/section/div[2]/main/div/div[3]/div/div/div[3]/div[2]/div/div/div/div/div/div/table/tbody/tr[1]/td[5]
Hãy trích xuất con số này, nó chính là tỉ lệ chính xác
=> Từ ví dụ này tôi sẽ biết được
username :jr-tangtuanminh-ty 
Thời gian label: 2.12 giờ
Thời gian sửa bài: 0.34 giờ
Tỉ lệ chính xác: 61.54 %

Bước 13: Tôi cần xuất ra file csv:
username,Thời gian label, Thời gian sửa bài, Tỉ lệ chính xác
