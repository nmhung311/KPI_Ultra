1. Máy chủ (Server) nhận API:

Base URL: https://app.expsolution.io
Thêm vào đó, có biến môi trường hoặc key được sử dụng trong authorization: LABEL_INGEST_API_KEY=1234567890!!!@@@
2. Các Endpoint và định dạng (Format) của API:

2.1. API Kiểm tra trạng thái (Health Check)
Endpoint: GET https://app.expsolution.io/api/v1/health
Mục đích: Để kiểm tra xem server (label API) có đang hoạt động ok không. (Trả về 200 kèm service "label-api").
2.2. API Ingest KPI (Ghi nhận số lượng tác vụ KPI)
Endpoint: POST https://app.expsolution.io/api/v1/ingest/kpi
Headers:
Content-Type: application/json
Authorization: Bearer 1234567890!!!@@@
Body Request (JSON):
json
{
  "schema_version": 1,                          // Phiên bản dữ liệu (thường là 1)
  "appen_id": "jr-nguyenquanghiep-ty",          // ID của người dùng (bắt buộc)
  "job_id": "G0344-F0670-L2860",         // Mã công việc hiện tại (bắt buộc)
  "kpi_count": 1580,                            // Số KPI trọn đời của tài khoản cho job này (bắt buộc, là số nguyên >= 0)
  "record_id": "345",                       // ID của tác vụ hiện tại (Không bắt buộc)
  "assigned_time": "2026-04-03 15:49",          // Thời gian nhận task (Lấy từ bảng History - Không bắt buộc)
  "confirmed_time": "2026-04-03 15:50",         // Thời gian hoàn thành task (Lấy từ bảng History - Không bắt buộc)
  "occurred_at": "2026-03-22T14:30:00+07:00",   // Thời điểm làm trên client (Không bắt buộc)
  "idempotency_key": "550e8400-e29b-41d4-a..." // Key để chống gửi trùng lặp/double-submit (Không bắt buộc)
}
Response trả về thành công (HTTP 200):
json
{
  "ok": true,
  "day": "2026-03-23",          
  "baseline": 100,              
  "daily_kpi_count": 50,        
  "closing_total": 1580,        
  "total_kpi": 1580             
}
// Hoặc nếu gửi trùng key idempotency:
{
  "ok": true,
  "idempotent_replay": true
}