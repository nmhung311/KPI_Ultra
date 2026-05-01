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

Bước 13.1: Trích xuất Record ID (cột 1) và cột Current worker (cột 2)
ví dụ: Record 12, Current worker: jr-peiyabo-ty

Bước 13.2: Lựa chọn icon con mắt:
xpath: /html/body/div[1]/div/section/div[2]/main/div/div[3]/div/div/div/div[2]/div/div[1]/div/div/div/div/div/table/tbody/tr[2]/td[6]/span

Lúc này trình duyệt sẽ mở ra một tab mới
Hãy chuyển vào iframe để đọc nút Valid

Bước 15: Kiểm tra xem nút "Valid" có được bật hay không:
xpath: /html/body/div[1]/div/div/div[2]/div[1]/div[2]/div/div/div[3]/div[1]/div[2]/button

Nếu bật sẽ có element:
<button type="button" role="switch" aria-checked="true" disabled="" class="easyform-switch easyform-switch-small easyform-switch-checked easyform-switch-disabled"><div class="easyform-switch-handle"></div><span class="easyform-switch-inner"></span></button>

Nếu tắt sẽ không đếm KPI, cột KPI sẽ đặt là "Invalid"

Bước 16: Đếm các element:
<div class="b-ShapeLabel__value"><div class="b-ShapeLabel__number">1</div><div class="b-ShapeLabel__count">(7)</div><div class="b-ShapeLabel__group"><span><button class="b-Button b-ShapeLabel__icon" type="button" tabindex="-1"><svg class="b-SVGIcon" fill="currentColor" viewBox="0 0 16 16" style="height: 16px; width: 16px;"><path d="M12.8666667,3 L3.13333333,3 C3.06,3 3,3.05625 3,3.125 L3,4 C3,4.06875 3.06,4.125 3.13333333,4.125 L12.8666667,4.125 C12.94,4.125 13,4.06875 13,4 L13,3.125 C13,3.05625 12.94,3 12.8666667,3 Z M12.8666667,7.4375 L3.13333333,7.4375 C3.06,7.4375 3,7.49375 3,7.5625 L3,8.4375 C3,8.50625 3.06,8.5625 3.13333333,8.5625 L12.8666667,8.5625 C12.94,8.5625 13,8.50625 13,8.4375 L13,7.5625 C13,7.49375 12.94,7.4375 12.8666667,7.4375 Z M12.8666667,11.875 L3.13333333,11.875 C3.06,11.875 3,11.93125 3,12 L3,12.875 C3,12.94375 3.06,13 3.13333333,13 L12.8666667,13 C12.94,13 13,12.94375 13,12.875 L13,12 C13,11.93125 12.94,11.875 12.8666667,11.875 Z"></path></svg></button></span><span><button class="b-Button b-ShapeLabel__icon" type="button" tabindex="-1"><svg class="b-SVGIcon" fill="currentColor" viewBox="0 0 16 16" style="height: 16px; width: 16px;"><path d="M8,3.5 C10.8784128,3.5 13.4257503,5.26995752 14.4651823,7.90759124 L14.4651823,7.90759124 L14.5374237,8.09090909 L14.4651823,8.27422694 C13.4257503,10.9118607 10.8784128,12.6818182 8,12.6818182 C5.12158721,12.6818182 2.57424967,10.9118607 1.53481771,8.27422694 L1.53481771,8.27422694 L1.46257628,8.09090909 L1.53481771,7.90759124 C2.57424967,5.26995752 5.12158721,3.5 8,3.5 Z M8,4.5 C5.70045056,4.5 3.64741169,5.81998654 2.66013121,7.8325836 L2.66013121,7.8325836 L2.541,8.09 L2.66013121,8.34923459 C3.61215167,10.2899532 5.55516431,11.58665 7.7546003,11.6767958 L7.7546003,11.6767958 L8,11.6818182 C10.2995494,11.6818182 12.3525883,10.3618316 13.3398688,8.34923458 L13.3398688,8.34923458 L13.458,8.09 L13.3398688,7.8325836 C12.3878483,5.891865 10.4448357,4.59516818 8.2453997,4.50502239 L8.2453997,4.50502239 Z M8,5.5 C9.38014238,5.5 10.5,6.61985762 10.5,8 C10.5,9.38014238 9.38014238,10.5 8,10.5 C6.61985762,10.5 5.5,9.38014238 5.5,8 C5.5,6.61985762 6.61985762,5.5 8,5.5 Z M8,6.5 C7.17214237,6.5 6.5,7.17214237 6.5,8 C6.5,8.82785763 7.17214237,9.5 8,9.5 C8.82785763,9.5 9.5,8.82785763 9.5,8 C9.5,7.17214237 8.82785763,6.5 8,6.5 Z"></path></svg></button></span></div></div>

Bỏ qua các element: 
<div class="b-ShapeLabel b-ShapeLabel--hidden"><div class="b-ShapeLabel__content"><div class="b-ShapeLabel__value"><div class="b-ShapeLabel__number">3</div><div class="b-ShapeLabel__count">(0)</div><div class="b-ShapeLabel__group"></div></div></div></div>

Lưu ý: <div class="b-ShapeLabel__value"><div class="b-ShapeLabel__number">1 số 1 ở đây sẽ phải linh hoạt, không cố định là 1.

Bước 17: Xuất ra kết quả dưới dạng file Excel
Cột A: Job ID
Cột B: Record ID (sắp xếp theo thứ tự tăng dần của số trên Record ID, ví dụ 12, 19, 20)
Cột C: Current Worker
Cột D: KPI



