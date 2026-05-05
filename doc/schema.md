```yaml
# KPI_Ultra Database Schema (MongoDB)
# Database Name: kpi_db

collections:
  jobs:
    description: "Lưu trữ thông tin chi tiết của các gói hàng (Job Packages)."
    fields:
      _id:
        type: ObjectId
        description: "MongoDB unique identifier"
      jobId:
        type: String
        description: "Mã định danh gói hàng (VD: 'JOB-10485')"
        required: true
        unique: true
      jobName:
        type: String
        description: "Tên gói hàng (VD: 'Gắn nhãn biển báo giao thông')"
        required: true
      status:
        type: String
        description: "Tình trạng gói hàng (VD: 'Đang gán nhãn', 'Đang chờ duyệt', 'Đã được duyệt')"
        required: true
      receivedAt:
        type: Date
        description: "Thời gian nhận gói hàng này"
        required: true
      workers:
        type: Array[String]
        description: "Danh sách username của những người làm trong gói hàng này"
        default: []
      records:
        type: Array[String]
        description: "Danh sách các Record ID thuộc gói hàng này, tham chiếu đến collection records"
        default: []
      qa1JobId:
        type: String
        description: "Mã định danh gói QA1 liên kết với gói Label này (VD: 'G0097-F0366-Q1449')"
        default: ""
      qa2JobId:
        type: String
        description: "Mã định danh gói QA2 liên kết với gói Label này"
        default: ""

  records:
    description: "Lưu trữ thông tin chi tiết của từng Record."
    fields:
      _id:
        type: ObjectId
        description: "MongoDB unique identifier"
      recordId:
        type: String
        description: "Mã định danh của Record (VD: 'REC-001')"
        required: true
        unique: true
      worker:
        type: String
        description: "Username của người làm record đó"
        required: true
      qa1:
        type: String
        description: "Username của người QA vòng 1"
        default: ""
      qa2:
        type: String
        description: "Username của người QA vòng 2"
        default: ""
      kpi:
        type: Mixed (Integer | Float)
        description: "Điểm KPI của record (KPI hệ thống đếm)"
        required: true
      kpiCustomer:
        type: Mixed (Integer | Float)
        description: "Điểm KPI của record do khách hàng đếm (được điền khi import đối soát KPI)"
        default: 0
      isValid:
        type: Boolean
        description: "Trạng thái record có hợp lệ (valid) hay không"
        required: true
      reworkCount:
        type: Integer
        description: "Số lần record bị yêu cầu làm lại"
        default: 0
      completedAt:
        type: String
        description: "Thời gian làm xong record đó"
        default: ""

  users:
    description: "Danh sách nhân sự cố định: map username (Current Worker / QA) với Telegram để bot gửi KPI."
    fields:
      _id:
        type: ObjectId
        description: "MongoDB unique identifier"
      username:
        type: String
        description: "Username Appen / hệ thống (trùng với Current Worker hoặc QA trong results)"
        required: true
        unique: true
      id_telegram:
        type: Long | Integer
        description: "Chat ID Telegram (số) dùng gửi tin qua Bot API"
        required: true
      createdAt:
        type: Date
        description: "Thời điểm tạo bản ghi (chỉ ghi khi insert lần đầu)"
      updatedAt:
        type: Date
        description: "Cập nhật lần cuối (seed hoặc API)"
```
