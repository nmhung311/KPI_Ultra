import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  vi: {
    translation: {
      "kpi_dashboard": "KPI & Gói Hàng.",
      "kpi_desc": "Theo dõi tiến độ, chất lượng và thống kê KPI theo từng gói công việc (Package Workflow).",
      "manage_package": "Quản lý Gói hàng",
      "package_list": "Danh sách gói hàng",
      "import_package": "Import gói hàng",
      "backup_all_kpi": "Backup toàn bộ dữ liệu",
      "backing_up": "Đang tạo backup...",
      "backup_failed": "Không tạo được file backup.",
      "restore_kpi_backup": "Khôi phục từ backup",
      "restoring": "Đang khôi phục...",
      "restore_failed": "Khôi phục thất bại.",
      "restore_confirm": "Restore sẽ XÓA toàn bộ gói hàng và records KPI hiện tại, thay bằng dữ liệu trong file backup. Tiếp tục?",
      "importing": "Đang import...",
      "filter_month": "Tất cả tháng",
      "filter_status": "Tất cả tình trạng",
      "status_labeling": "Đang gán nhãn",
      "status_pending": "Đang chờ duyệt",
      "status_approved": "Đã được duyệt",
      "no_packages": "Không tìm thấy gói hàng",
      "no_packages_desc": "Không có dữ liệu nào khớp với bộ lọc tháng hoặc tình trạng của bạn.",
      "records": "records",
      "month": "Tháng",
      "back": "Quay lại danh sách gói hàng",
      "package_details": "Chi tiết gói hàng",
      "record_list": "Danh sách Records",
      "qa_list": "Danh sách QA",
      "worker": "Người làm",
      "rework": "Sửa lại",
      "kpi": "KPI",
      "import_record": "Import record",
      "qa_username": "Username (QA)",
      "qa_workers_count": "Số người làm",
      "qa_records_count": "Số record đã QA",
      "qa_kpi": "KPI QA",
      "actions": "Thao tác",
      "view_details": "Xem chi tiết",
      "qa_details_title": "Chi tiết công việc QA",
      "qa_details_desc": "Đã chấm {{records}} records từ {{workers}} người làm",
      "empty_qa": "Không có dữ liệu QA nào cho gói hàng này.",
      "lang_vi": "Tiếng Việt",
      "lang_zh": "中文 (Giản thể)"
    }
  },
  zh: {
    translation: {
      "kpi_dashboard": "KPI与任务包",
      "kpi_desc": "根据每个任务包 (Package Workflow) 跟踪进度、质量和KPI统计。",
      "manage_package": "管理任务包",
      "package_list": "任务包列表",
      "import_package": "导入任务包",
      "backup_all_kpi": "备份全部数据",
      "backing_up": "正在生成备份...",
      "backup_failed": "备份失败。",
      "restore_kpi_backup": "从备份恢复",
      "restoring": "正在恢复...",
      "restore_failed": "恢复失败。",
      "restore_confirm": "恢复将删除当前全部任务包与KPI记录，并用备份文件替换。是否继续？",
      "importing": "正在导入...",
      "filter_month": "所有月份",
      "filter_status": "所有状态",
      "status_labeling": "标注中",
      "status_pending": "待审核",
      "status_approved": "已审核",
      "no_packages": "未找到任务包",
      "no_packages_desc": "没有符合您选择的月份或状态的数据。",
      "records": "条记录",
      "month": "月份",
      "back": "返回任务包列表",
      "package_details": "任务包详情",
      "record_list": "记录列表",
      "qa_list": "质检(QA)列表",
      "worker": "执行者",
      "rework": "重做",
      "kpi": "KPI",
      "import_record": "导入记录",
      "qa_username": "用户名 (QA)",
      "qa_workers_count": "质检人数",
      "qa_records_count": "质检记录数",
      "qa_kpi": "QA KPI",
      "actions": "操作",
      "view_details": "查看详情",
      "qa_details_title": "QA 工作详情",
      "qa_details_desc": "已对 {{workers}} 名执行者的 {{records}} 条记录进行质检",
      "empty_qa": "该任务包没有QA数据。",
      "lang_vi": "Tiếng Việt",
      "lang_zh": "中文 (Giản thể)"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "vi",
    fallbackLng: "vi",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
