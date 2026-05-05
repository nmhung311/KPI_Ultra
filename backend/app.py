from flask import Flask, request, jsonify, make_response, Response
from bson import json_util, ObjectId
from flask_cors import CORS
from pymongo import MongoClient, UpdateOne
from automation import KPIAutomation
import os
import threading
import time
import csv
import math
import io
import importlib.util
import json
from pathlib import Path
from datetime import datetime
from pymongo.errors import BulkWriteError, DocumentTooLarge, PyMongoError
import requests
from requests.exceptions import RequestException

from kpi_restore_core import restore_kpi_payload, verify_restored_data_matches_payload

app = Flask(__name__)
CORS(app)

# Kết nối MongoDB
mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/kpi_db')
client = MongoClient(mongo_uri)
db = client.kpi_db
collection = db.results

_telegram_kpi_core_module = None


def get_telegram_kpi_core():
    """Load module từ thư mục `Bot telegram/` (tên thư mục có khoảng trắng)."""
    global _telegram_kpi_core_module
    if _telegram_kpi_core_module is None:
        core_path = Path(__file__).resolve().parent / "Bot telegram" / "telegram_kpi_core.py"
        spec = importlib.util.spec_from_file_location("telegram_kpi_core_impl", core_path)
        if spec is None or spec.loader is None:
            raise ImportError("Không load được Bot telegram/telegram_kpi_core.py")
        _telegram_kpi_core_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_telegram_kpi_core_module)
    return _telegram_kpi_core_module


# Theo dõi bot đang hoạt động
active_bot = None
active_thread = None
active_sync_job_id = None
bot_lock = threading.Lock()

sync_logs = {"kpi": [], "qa1": [], "qa2": [], "pass_rate": []}

# Trạng thái hoàn thành sync (persist sau khi bot cleanup)
sync_completion = {"job_id": None, "status": None, "progress": 0}

pass_rate_status = {"job_id": None, "running": False, "started_at": None, "finished_at": None}
pass_rate_lock = threading.Lock()

import kpi_automation
import list_qa
import pass_rate
import logging

class SyncLogHandler(logging.Handler):
    def emit(self, record):
        thread_name = threading.current_thread().name
        if thread_name in sync_logs:
            msg = self.format(record)
            sync_logs[thread_name].append(msg)

sync_log_handler = SyncLogHandler()
sync_log_handler.setFormatter(logging.Formatter('%(asctime)s | %(levelname)s | %(message)s', "%H:%M:%S"))
kpi_automation.logger.addHandler(sync_log_handler)
list_qa.logger.addHandler(sync_log_handler)
pass_rate.logger.addHandler(sync_log_handler)


def _serialize_error(message, code=500):
    return jsonify({"error": message}), code


def _restore_mongo_detail(exc: BaseException) -> str:
    """Thông tin thêm từ BulkWriteError để hiển thị cho người dùng / log."""
    if isinstance(exc, BulkWriteError):
        wes = (exc.details or {}).get("writeErrors") or []
        if wes:
            return f" | writeErrors[0]: {wes[0].get('errmsg', wes[0])}"
    return ""


def _mongo_connection_hint(exc) -> str:
    """Gợi ý khi PyMongo báo không phân giải được hostname (vd. mongodb trong Compose)."""
    msg = str(exc).lower()
    needles = (
        "no address associated",
        "errno -5",
        "name or service not known",
        "getaddrinfo",
        "enotfound",
        "nodename nor servname",
        "name resolution",
    )
    if not any(n in msg for n in needles):
        return ""
    return (
        " [Gợi ý] Tên `mongodb` trong MONGO_URI chỉ phân giải được khi backend chạy **trong** Docker Compose. "
        "Nếu bạn chạy `python app.py` trên máy host: đặt MONGO_URI=mongodb://127.0.0.1:27017/kpi_db. "
        "Nếu dùng Docker: `docker compose up -d` và `docker compose ps` (mongodb phải Up/healthy)."
    )


def _to_jsonable(value):
    """Chuyển BSON / datetime / Decimal128 thành kiểu an toàn cho jsonify (tránh 500 do TypeError)."""
    if value is None:
        return None
    if isinstance(value, dict):
        return {k: _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_jsonable(v) for v in value]
    if isinstance(value, set):
        return [_to_jsonable(v) for v in sorted(value, key=lambda x: (str(type(x)), str(x)))]
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, ObjectId):
        return str(value)
    try:
        from bson.decimal128 import Decimal128

        if isinstance(value, Decimal128):
            return float(value.to_decimal())
    except (AttributeError, ValueError, TypeError, OverflowError):
        pass
    try:
        from bson.int64 import Int64

        if isinstance(value, Int64):
            return int(value)
    except (ImportError, TypeError, ValueError, OverflowError):
        pass
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, str):
        return value
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)


def _telegram_chat_id_from_user_doc(doc: dict) -> int | None:
    """Chat ID Telegram từ document `users` (hỗ trợ nhiều tên field / BSON)."""
    if not doc:
        return None
    raw = doc.get("id_telegram")
    if raw is None:
        raw = doc.get("idTelegram") or doc.get("telegram_id") or doc.get("telegramId")
    if raw is None:
        for k, v in doc.items():
            if k == "_id" or v is None:
                continue
            lk = str(k).lower().replace(" ", "_")
            if lk in ("id_telegram", "idtelegram", "telegram_id", "telegramid") and str(v).strip() != "":
                raw = v
                break
    if raw is None or raw == "":
        return None
    try:
        return int(str(raw).strip().replace(",", "").replace(" ", ""))
    except (TypeError, ValueError):
        return None


def _username_from_user_doc(doc: dict) -> str:
    u = doc.get("username")
    if u is None:
        u = doc.get("Username")
    return str(u or "").strip()


def _load_users_telegram_lookup(client_db):
    """
    Đọc collection 'users' (tránh db.users nếu trùng thuộc tính Database).
    Trả về (tg_exact dict, lookup(uname) -> int | None) có fallback không phân biệt hoa thường.
    """
    tg_exact: dict[str, int] = {}
    try:
        for d in client_db["users"].find({}):
            u = _username_from_user_doc(d)
            if not u:
                continue
            tid = _telegram_chat_id_from_user_doc(d)
            if tid is None:
                continue
            tg_exact[u] = tid
    except PyMongoError:
        pass
    tg_fold = {k.casefold(): v for k, v in tg_exact.items()}

    def lookup(uname: str):
        if not uname:
            return None
        if uname in tg_exact:
            return tg_exact[uname]
        return tg_fold.get(uname.casefold())

    return tg_exact, lookup


def _chunked(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def _mongo_import_batch_size() -> int:
    """Số thao tác bulk_write mỗi lô (import CSV / reconciliation)."""
    return max(100, min(8000, int(os.getenv("MONGO_IMPORT_BATCH", "2500"))))


def _results_bulk_write_chunked(operations: list) -> None:
    if not operations:
        return
    batch = _mongo_import_batch_size()
    for chunk in _chunked(operations, batch):
        db.results.bulk_write(chunk, ordered=False)


def _jobs_bulk_write_chunked(operations: list) -> None:
    if not operations:
        return
    batch = _mongo_import_batch_size()
    for chunk in _chunked(operations, batch):
        db.jobs.bulk_write(chunk, ordered=False)


def _results_insert_many_chunked(docs: list) -> None:
    if not docs:
        return
    batch = _mongo_import_batch_size()
    for chunk in _chunked(docs, batch):
        collection.insert_many(chunk, ordered=False)


def _to_float(value, default=0.0):
    if value is None:
        return default
    try:
        from bson.decimal128 import Decimal128

        if isinstance(value, Decimal128):
            return float(value.to_decimal())
    except (ImportError, AttributeError, ValueError, TypeError, OverflowError):
        pass
    try:
        return float(str(value).strip().replace(",", "."))
    except (TypeError, ValueError):
        return default

@app.route('/run-automation', methods=['POST'])
def run_automation():
    global active_bot, active_thread
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    password = data.get('password')
    job_id = data.get('job_id')

    if not all([username, password, job_id]):
        return jsonify({"error": "Thiếu thông tin đăng nhập hoặc Job ID"}), 400

    with bot_lock:
        if active_bot is not None:
            return jsonify({"error": "Một tiến trình automation khác đang chạy"}), 409
        active_bot = KPIAutomation(username, password, job_id)

    def background_task():
        global active_bot, active_thread
        try:
            results = active_bot.run()
            if results:
                _results_insert_many_chunked(results)
        except PyMongoError as e:
            print(f"Lỗi MongoDB khi lưu kết quả: {e}")
        except Exception as e:
            print(f"Lỗi khi chạy automation: {e}")
        finally:
            with bot_lock:
                active_bot = None
                active_thread = None

    # Chạy background để không block request
    thread = threading.Thread(target=background_task, daemon=True)
    with bot_lock:
        active_thread = thread
    thread.start()

    return jsonify({"message": "Đang bắt đầu quá trình automation..."}), 202

@app.route('/stop-automation', methods=['POST'])
def stop_automation():
    global active_bot
    with bot_lock:
        bot = active_bot

    if not bot:
        return jsonify({"message": "Không có tiến trình nào đang chạy"}), 400
    
    try:
        bot.request_stop()
        return jsonify({"message": "Đã gửi yêu cầu dừng automation"})
    except Exception as e:
        return _serialize_error(f"Lỗi khi dừng: {str(e)}", 500)

@app.route('/progress', methods=['GET'])
def get_progress():
    global active_bot, active_sync_job_id, active_thread, sync_completion
    with bot_lock:
        bot = active_bot
        sync_job_id = active_sync_job_id
        is_running = active_thread is not None and active_thread.is_alive()

    if bot:
        prog = bot.progress
        if prog == 100 and is_running:
            prog = 99
        return jsonify({"progress": prog, "jobId": sync_job_id})
    
    # Bot đã bị cleanup — kiểm tra xem có trạng thái hoàn thành không
    if sync_completion["status"] == "done" and sync_completion["job_id"]:
        return jsonify({"progress": 100, "jobId": sync_completion["job_id"]})
    
    return jsonify({"progress": 0, "jobId": None})

@app.route('/api/jobs/<job_id>/sync_status', methods=['GET'])
def get_sync_status(job_id):
    """Endpoint bổ sung để frontend kiểm tra trạng thái sync."""
    global active_bot, active_sync_job_id, sync_completion
    with bot_lock:
        bot = active_bot
        sync_job_id = active_sync_job_id
    
    if bot and sync_job_id == job_id:
        return jsonify({"status": "running", "progress": bot.progress})
    
    if sync_completion["job_id"] == job_id and sync_completion["status"] == "done":
        return jsonify({"status": "done", "progress": 100})
    
    return jsonify({"status": "idle", "progress": 0})

@app.route('/api/jobs/<job_id>/clear_sync', methods=['POST'])
def clear_sync_status(job_id):
    """Frontend gọi khi đã xác nhận xong đồng bộ để reset trạng thái."""
    global sync_completion
    if sync_completion["job_id"] == job_id:
        sync_completion = {"job_id": None, "status": None, "progress": 0}
    return jsonify({"ok": True})

@app.route('/api/jobs/<job_id>/sync_logs', methods=['GET'])
def get_sync_logs(job_id):
    # Trả về toàn bộ log hiện tại
    return jsonify(sync_logs)

@app.route('/api/server/appen-health', methods=['GET'])
def check_appen_health():
    """Kiểm tra Appen login page còn online không."""
    target_url = "http://global-autolabeling-service.evad.xiaomi.srv/appen/ui#/user/login"
    try:
        response = requests.get(target_url, timeout=8, allow_redirects=True)
        is_online = response.status_code == 200
        return jsonify({
            "online": is_online,
            "statusCode": response.status_code,
            "url": target_url,
            "checkedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        }), 200
    except RequestException as e:
        return jsonify({
            "online": False,
            "statusCode": None,
            "url": target_url,
            "error": str(e),
            "checkedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        }), 200

@app.route('/results', methods=['GET'])
def get_results():
    try:
        results = list(collection.find({}, {'_id': 0}))
        return jsonify(_to_jsonable(results))
    except PyMongoError as e:
        h = _mongo_connection_hint(e)
        return _serialize_error(f"Lỗi đọc dữ liệu MongoDB: {e}" + (f". {h}" if h else ""), 500)

def _month_from_received_str(received_str: str) -> str:
    """Suy ra tháng hiển thị mm/yyyy từ chuỗi ngày nhận (cùng quy tắc import CSV)."""
    received_str = (received_str or "").strip()
    month_str = ""
    try:
        if "/" in received_str:
            parts = received_str.split("/")
            if len(parts) >= 2:
                month_str = f"{parts[1].zfill(2)}/{parts[2]}" if len(parts) == 3 else f"{parts[0].zfill(2)}/{parts[1]}"
        elif "-" in received_str:
            parts = received_str.split("-")
            if len(parts) >= 2:
                if len(parts[0]) == 4:
                    month_str = f"{parts[1].zfill(2)}/{parts[0]}"
                else:
                    month_str = f"{parts[1].zfill(2)}/{parts[2]}"
    except Exception:
        pass
    if not month_str:
        month_str = datetime.now().strftime("%m/%Y")
    return month_str


def _completed_at_calendar_day(completed_at):
    """Chuẩn hóa ngày YYYY-MM-DD chỉ từ trường Completed At của record."""
    s = (completed_at or "").strip()
    if not s:
        return None
    date_part = s.replace("T", " ").split()[0].strip()
    if len(date_part) >= 10 and date_part[4] == "-" and date_part[7] == "-":
        try:
            datetime.strptime(date_part[:10], "%Y-%m-%d")
            return date_part[:10]
        except ValueError:
            pass
    if "/" in date_part:
        parts = [p.strip() for p in date_part.split("/") if p.strip() != ""]
        if len(parts) >= 3:
            try:
                a, b, c = int(parts[0]), int(parts[1]), int(parts[2])
                if a > 1000:
                    y, mth, d = a, b, c
                else:
                    d, mth, y = a, b, c
                    if y < 100:
                        y += 2000
                datetime(y, mth, d)
                return f"{y:04d}-{mth:02d}-{d:02d}"
            except (ValueError, TypeError, OSError):
                pass
    return None


def _create_job_manual():
    """Tạo một gói hàng từ JSON (không qua CSV). Tháng suy từ receivedAt."""
    data = request.get_json(silent=True) or {}
    job_id = str(data.get("jobId", "")).strip()
    job_name = str(data.get("jobName", "")).strip()
    if not job_id or not job_name:
        return jsonify({"error": "jobId và jobName là bắt buộc"}), 400
    if db.jobs.find_one({"jobId": job_id}):
        return jsonify({"error": "Job ID đã tồn tại"}), 409
    status = str(data.get("status", "Đang gán nhãn")).strip()
    allowed_status = {"Đang gán nhãn", "Đang chờ duyệt", "Đã được duyệt"}
    if status not in allowed_status:
        status = "Đang gán nhãn"
    received_at = str(data.get("receivedAt", "")).strip()
    month = _month_from_received_str(received_at)
    doc = {
        "jobId": job_id,
        "jobName": job_name,
        "status": status,
        "month": month,
        "receivedAt": received_at,
        "workers": [],
        "records": [],
        "hiddenUsers": [],
    }
    qa1 = str(data.get("qa1JobId", "")).strip()
    qa2 = str(data.get("qa2JobId", "")).strip()
    if qa1:
        doc["qa1JobId"] = qa1
    if qa2:
        doc["qa2JobId"] = qa2
    try:
        db.jobs.insert_one(doc)
    except PyMongoError as e:
        return _serialize_error(str(e), 500)
    return jsonify({"message": "Đã tạo gói hàng thành công", "jobId": job_id}), 201


@app.route('/api/jobs', methods=['GET', 'POST'])
def get_jobs():
    """GET: danh sách (không nhúng records). POST: tạo gói thủ công JSON (tháng suy từ receivedAt)."""
    if request.method == "POST":
        return _create_job_manual()
    try:
        jobs_cursor = db.jobs.find({}, {'_id': 0})
        jobs = list(jobs_cursor)

        job_ids = [j.get("jobId") for j in jobs if j.get("jobId")]
        count_by_job: dict = {}
        if job_ids:
            for doc in db.results.aggregate(
                [
                    {"$match": {"Job ID": {"$in": job_ids}}},
                    {"$group": {"_id": "$Job ID", "n": {"$sum": 1}}},
                ],
                allowDiskUse=True,
            ):
                count_by_job[doc["_id"]] = doc["n"]

        for job in jobs:
            job_id = job.get("jobId")
            job["hiddenUsers"] = job.get("hiddenUsers", [])
            if not job_id:
                job["records"] = []
                job["recordCount"] = 0
                continue
            job["recordCount"] = int(count_by_job.get(job_id, 0))
            job["records"] = []

        return jsonify(_to_jsonable(jobs))
    except PyMongoError as e:
        h = _mongo_connection_hint(e)
        return _serialize_error(f"Lỗi đọc dữ liệu MongoDB: {e}" + (f". {h}" if h else ""), 500)
    except Exception as e:
        app.logger.exception("get_jobs: lỗi không mong đợi")
        return _serialize_error(f"Lỗi server: {str(e)}", 500)

@app.route('/api/jobs/<job_id>', methods=['GET'])
def get_job(job_id):
    try:
        job = db.jobs.find_one({"jobId": job_id}, {'_id': 0})
        if not job:
            return jsonify({"error": "Job not found"}), 404
            
        records = list(db.results.find({"Job ID": job_id}, {'_id': 0}))
        mapped_records = []
        for r in records:
            mapped_records.append({
                "recordId": r.get("Record ID", ""),
                "worker": r.get("Current Worker", ""),
                "reworkCount": r.get("Rework Count", 0),
                "qa1": r.get("QA1", ""),
                "qa2": r.get("QA2", ""),
                "kpi": r.get("KPI", 0),
                "completedAt": r.get("Completed At", "")
            })
        job["records"] = mapped_records
        job["hiddenUsers"] = job.get("hiddenUsers", [])
        return jsonify(_to_jsonable(job))
    except PyMongoError as e:
        return _serialize_error(f"Lỗi đọc dữ liệu MongoDB: {str(e)}", 500)
    except Exception as e:
        app.logger.exception("get_job: lỗi không mong đợi")
        return _serialize_error(f"Lỗi server: {str(e)}", 500)


@app.route("/api/jobs/<job_id>/telegram-notify", methods=["POST"])
def api_telegram_notify_job(job_id):
    """Gửi KPI qua Telegram tới từng worker đã /link bot (cùng gói job_id). Cần header bí mật."""
    notify_linked_workers_for_job = get_telegram_kpi_core().notify_linked_workers_for_job

    secret = (os.environ.get("TELEGRAM_NOTIFY_SECRET") or "").strip()
    incoming = (request.headers.get("X-Telegram-Notify-Secret") or "").strip()
    if not secret or incoming != secret:
        return jsonify({"error": "Forbidden"}), 403
    token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        return jsonify({"error": "Chưa cấu hình TELEGRAM_BOT_TOKEN"}), 503
    try:
        res = notify_linked_workers_for_job(db, token, job_id)
        return jsonify(_to_jsonable(res)), 200
    except Exception as e:
        app.logger.exception("api_telegram_notify_job")
        return _serialize_error(str(e), 500)


@app.route('/api/jobs/<job_id>', methods=['PATCH'])
def update_job(job_id):
    try:
        data = request.json
        new_job_id = data.get("jobId", "").strip()
        new_job_name = data.get("jobName", "").strip()
        qa1_job_id = data.get("qa1JobId", "").strip()
        qa2_job_id = data.get("qa2JobId", "").strip()

        if not new_job_id or not new_job_name:
            return jsonify({"error": "jobId và jobName không được trống"}), 400

        job = db.jobs.find_one({"jobId": job_id})
        if not job:
            return jsonify({"error": "Không tìm thấy gói hàng"}), 404

        # Kiểm tra trùng jobId nếu có thay đổi
        if new_job_id != job_id:
            existing = db.jobs.find_one({"jobId": new_job_id})
            if existing:
                return jsonify({"error": "jobId mới đã tồn tại"}), 400

        db.jobs.update_one(
            {"jobId": job_id},
            {"$set": {
                "jobId": new_job_id, 
                "jobName": new_job_name,
                "qa1JobId": qa1_job_id,
                "qa2JobId": qa2_job_id
            }}
        )

        # Cập nhật Job ID trong results nếu có đổi jobId
        if new_job_id != job_id:
            db.results.update_many(
                {"Job ID": job_id},
                {"$set": {"Job ID": new_job_id}}
            )

        return jsonify({"message": "Cập nhật thành công"}), 200
    except Exception as e:
        return _serialize_error(str(e), 500)


def _safe_job_id_filename_part(job_id: str) -> str:
    """Tên file an toàn từ jobId (tránh path traversal)."""
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in (job_id or ""))


def _pass_rate_csv_path_for_job(job_id: str):
    """Ưu tiên CSV import theo jobId, sau đó file pass_rate_results.csv từ automation."""
    base = Path(__file__).resolve().parent
    per_job = base / f"pass_rate_{_safe_job_id_filename_part(job_id)}.csv"
    if per_job.exists():
        return per_job
    legacy = base / "pass_rate_results.csv"
    if legacy.exists():
        return legacy
    return None


@app.route('/api/jobs/<job_id>/pass-rate', methods=['GET'])
def get_job_pass_rate(job_id):
    """
    Trả về dữ liệu tỉ lệ chính xác: file import theo job (pass_rate_<jobId>.csv) nếu có,
    không thì pass_rate_results.csv từ đồng bộ automation.
    """
    try:
        csv_path = _pass_rate_csv_path_for_job(job_id)
        if not csv_path:
            return jsonify({
                "jobId": job_id,
                "rows": [],
                "summary": {
                    "contributors": 0,
                    "avgPassRate": 0,
                    "totalLabelHours": 0,
                    "totalReworkHours": 0,
                },
                "source": None,
                "note": "Chưa có dữ liệu — import CSV hoặc đồng bộ Monitor.",
            }), 200

        rows = []
        with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                username = (row.get("username") or "").strip()
                if not username:
                    continue
                label_hours = _to_float(row.get("Thời gian label"), 0)
                rework_hours = _to_float(row.get("Thời gian sửa bài"), 0)
                pass_rate = _to_float(row.get("Tỉ lệ chính xác"), 0)
                rows.append({
                    "username": username,
                    "labelHours": label_hours,
                    "reworkHours": rework_hours,
                    "passRate": pass_rate,
                })

        contributors = len(rows)
        total_label = round(sum(r["labelHours"] for r in rows), 2)
        total_rework = round(sum(r["reworkHours"] for r in rows), 2)
        avg_pass_rate = round(sum(r["passRate"] for r in rows) / contributors, 2) if contributors else 0

        return jsonify({
            "jobId": job_id,
            "rows": rows,
            "summary": {
                "contributors": contributors,
                "avgPassRate": avg_pass_rate,
                "totalLabelHours": total_label,
                "totalReworkHours": total_rework,
            },
            "source": str(csv_path.name),
        }), 200
    except Exception as e:
        return _serialize_error(f"Lỗi khi đọc pass-rate: {str(e)}", 500)


@app.route('/api/jobs/<job_id>/import-pass-rate', methods=['POST'])
def import_pass_rate(job_id):
    """Import CSV tỉ lệ chính xác (cùng format export Monitor: username, Thời gian label, Thời gian sửa bài, Tỉ lệ chính xác)."""
    if "file" not in request.files:
        return jsonify({"error": "Không tìm thấy file"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Chưa chọn file"}), 400
    if not file.filename.lower().endswith(".csv"):
        return jsonify({"error": "Chỉ hỗ trợ CSV"}), 400
    if not db.jobs.find_one({"jobId": job_id}, {"_id": 1}):
        return jsonify({"error": "Không tìm thấy gói hàng"}), 404

    fieldnames = ["username", "Thời gian label", "Thời gian sửa bài", "Tỉ lệ chính xác"]
    try:
        text = file.stream.read().decode("utf-8-sig")
        stream = io.StringIO(text, newline=None)
        reader = csv.DictReader(stream)
        rows_out = []
        for row in reader:
            username = (row.get("username") or "").strip()
            if not username:
                continue

            def _cell_float(key: str) -> float:
                raw = row.get(key)
                if raw is None:
                    return 0.0
                s = str(raw).replace("%", "").replace(",", ".").strip()
                return _to_float(s, 0.0)

            rows_out.append(
                {
                    "username": username,
                    "Thời gian label": str(_cell_float("Thời gian label")),
                    "Thời gian sửa bài": str(_cell_float("Thời gian sửa bài")),
                    "Tỉ lệ chính xác": str(_cell_float("Tỉ lệ chính xác")),
                }
            )

        if not rows_out:
            return jsonify({"error": "File không có dòng hợp lệ (cần cột username)."}), 400

        out_path = Path(__file__).resolve().parent / f"pass_rate_{_safe_job_id_filename_part(job_id)}.csv"
        with out_path.open("w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(rows_out)

        return jsonify({"message": f"Đã import tỉ lệ chính xác ({len(rows_out)} dòng)."}), 200
    except UnicodeDecodeError:
        return _serialize_error("Không đọc được file (UTF-8).", 400)
    except Exception as e:
        return _serialize_error(f"Lỗi khi import tỉ lệ chính xác: {str(e)}", 500)

@app.route('/api/jobs/<job_id>/pass-rate/sync', methods=['POST'])
def sync_pass_rate(job_id):
    """Chạy pass_rate automation và ghi lại pass_rate_results.csv."""
    def background_task():
        with pass_rate_lock:
            pass_rate_status["job_id"] = job_id
            pass_rate_status["running"] = True
            pass_rate_status["started_at"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            pass_rate_status["finished_at"] = None
        sync_logs["pass_rate"] = []
        try:
            csv_path = Path(__file__).resolve().parent / f"pass_rate_{_safe_job_id_filename_part(job_id)}.csv"
            pass_rate.run_automation(job_id=job_id, headless=True, output_path=str(csv_path))
        except Exception as e:
            app.logger.exception("Pass-rate sync failed for %s: %s", job_id, e)
        finally:
            with pass_rate_lock:
                pass_rate_status["running"] = False
                pass_rate_status["finished_at"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    thread = threading.Thread(target=background_task, name="pass_rate", daemon=True)
    thread.start()
    return jsonify({"message": "Đang đồng bộ pass-rate..."}), 202

@app.route('/api/jobs/<job_id>/pass-rate/status', methods=['GET'])
def get_pass_rate_status(job_id):
    with pass_rate_lock:
        running = pass_rate_status["running"] and pass_rate_status["job_id"] == job_id
        return jsonify({
            "jobId": job_id,
            "running": running,
            "startedAt": pass_rate_status["started_at"],
            "finishedAt": pass_rate_status["finished_at"],
        }), 200

@app.route('/api/jobs/<job_id>/hide-user', methods=['POST'])
def toggle_hide_user(job_id):
    try:
        data = request.json
        username = data.get("username", "").strip()
        if not username:
            return jsonify({"error": "Username không hợp lệ"}), 400
            
        job = db.jobs.find_one({"jobId": job_id})
        if not job:
            return jsonify({"error": "Không tìm thấy gói hàng"}), 404
            
        hidden_users = job.get("hiddenUsers", [])
        if username in hidden_users:
            hidden_users.remove(username)
        else:
            hidden_users.append(username)
            
        db.jobs.update_one({"jobId": job_id}, {"$set": {"hiddenUsers": hidden_users}})
        return jsonify({"message": "Đã cập nhật trạng thái hiển thị của nhân sự", "hiddenUsers": hidden_users})
    except Exception as e:
        return _serialize_error(f"Lỗi: {str(e)}", 500)

@app.route('/api/jobs/import', methods=['POST'])
def import_jobs():
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy file"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Chưa chọn file"}), 400

    if not file.filename.endswith('.csv'):
        return jsonify({"error": "Chỉ hỗ trợ file CSV"}), 400

    try:
        # Đọc file CSV
        stream = io.StringIO(file.stream.read().decode("utf-8-sig"), newline=None)
        csv_input = csv.reader(stream)
        
        row_count = 0
        jobs_to_insert = []
        for row in csv_input:
            if not row or len(row) < 6:
                continue
                
            # Bỏ qua header
            if "job" in str(row[1]).lower() or "id" in str(row[1]).lower():
                continue
                
            received_str = row[0].strip()
            job_id = row[1].strip()
            job_name = row[2].strip()
            # Bỏ qua index 3 và 4
            status_raw = row[5].strip()
            
            # Ánh xạ trạng thái
            if status_raw in ["Đang nghiệm thu", "验收中"]:
                status = "Đang chờ duyệt"
            elif status_raw in ["Đã nghiệm thu", "验收通过"]:
                status = "Đã được duyệt"
            elif status_raw in ["Đang gán nhãn", "标注中"]:
                status = "Đang gán nhãn"
            else:
                status = status_raw
            
            month_str = _month_from_received_str(received_str)

            jobs_to_insert.append({
                "jobId": job_id,
                "jobName": job_name,
                "status": status,
                "month": month_str,
                "receivedAt": received_str,
                "workers": [],
                "records": []
            })
            row_count += 1
            
        if jobs_to_insert:
            job_ops = [
                UpdateOne({"jobId": j["jobId"]}, {"$set": j}, upsert=True) for j in jobs_to_insert
            ]
            _jobs_bulk_write_chunked(job_ops)

        return jsonify({"message": f"Đã import thành công {row_count} gói hàng."}), 200
        
    except Exception as e:
        return _serialize_error(f"Lỗi khi import file: {str(e)}", 500)

@app.route('/api/jobs/<job_id>/import-records', methods=['POST'])
def import_records(job_id):
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy file"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Chưa chọn file"}), 400

    if not file.filename.endswith('.csv'):
        return jsonify({"error": "Chỉ hỗ trợ file CSV"}), 400

    try:
        # Lấy thông tin job để so sánh jobName
        job = db.jobs.find_one({"jobId": job_id})
        if not job:
            return jsonify({"error": "Không tìm thấy gói hàng"}), 404
            
        expected_job_name = job.get("jobName", "")

        text = file.stream.read().decode("utf-8-sig")

        def iter_record_rows():
            stream = io.StringIO(text, newline=None)
            for row in csv.reader(stream):
                if not row or len(row) < 11:
                    continue
                if "record id" in str(row[0]).lower():
                    continue
                yield row

        for row in iter_record_rows():
            flow_name = row[2].strip()
            if flow_name != expected_job_name:
                return jsonify(
                    {
                        "error": f"Tên dự án trong file ({flow_name}) không khớp với gói hàng hiện tại ({expected_job_name})."
                    }
                ), 400

        row_count = 0
        batch: list = []
        batch_sz = _mongo_import_batch_size()
        for row in iter_record_rows():
            record_id = row[0].strip()
            rework_count = 0
            try:
                rework_count = int(row[6].strip())
            except Exception:
                pass
            worker = row[7].strip()
            completed_at = row[10].strip()
            rec = {
                "Job ID": job_id,
                "Record ID": record_id,
                "Current Worker": worker,
                "Rework Count": rework_count,
                "Completed At": completed_at,
                "KPI": 0,
                "QA1": "",
                "QA2": "",
            }
            batch.append(
                UpdateOne(
                    {"Job ID": job_id, "Record ID": rec["Record ID"]},
                    {"$set": rec},
                    upsert=True,
                )
            )
            row_count += 1
            if len(batch) >= batch_sz:
                db.results.bulk_write(batch, ordered=False)
                batch.clear()
        if batch:
            db.results.bulk_write(batch, ordered=False)

        return jsonify({"message": f"Đã import thành công {row_count} records."}), 200
        
    except Exception as e:
        return _serialize_error(f"Lỗi khi import file: {str(e)}", 500)

@app.route('/api/jobs/<job_id>/import-kpi', methods=['POST'])
def import_kpi(job_id):
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy file"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Chưa chọn file"}), 400

    if not file.filename.endswith('.csv'):
        return jsonify({"error": "Chỉ hỗ trợ file CSV"}), 400

    try:
        stream = io.StringIO(file.stream.read().decode("utf-8-sig"), newline=None)
        csv_input = csv.reader(stream)
        
        affected = 0
        header = True
        batch: list = []
        batch_sz = _mongo_import_batch_size()
        for row in csv_input:
            if header:
                header = False
                continue

            if not row or len(row) < 4:
                continue

            csv_job_id = row[0].strip()
            record_id = row[1].strip()

            try:
                kpi_val = float(row[3].strip())
            except ValueError:
                kpi_val = 0

            if csv_job_id == job_id:
                worker = row[2].strip() if len(row) > 2 else ""
                batch.append(
                    UpdateOne(
                        {"Job ID": job_id, "Record ID": record_id},
                        {"$set": {"KPI": kpi_val, "Current Worker": worker}},
                        upsert=True,
                    )
                )
                if len(batch) >= batch_sz:
                    r = db.results.bulk_write(batch, ordered=False)
                    affected += r.matched_count + r.upserted_count
                    batch.clear()
        if batch:
            r = db.results.bulk_write(batch, ordered=False)
            affected += r.matched_count + r.upserted_count

        return jsonify({"message": f"Đã import thành công KPI cho {affected} records."}), 200
        
    except Exception as e:
        return _serialize_error(f"Lỗi khi import file KPI: {str(e)}", 500)

@app.route('/api/jobs/<job_id>/import-qa1', methods=['POST'])
def import_qa1(job_id):
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy file"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Chưa chọn file"}), 400

    if not file.filename.endswith('.csv'):
        return jsonify({"error": "Chỉ hỗ trợ file CSV"}), 400

    try:
        stream = io.StringIO(file.stream.read().decode("utf-8-sig"), newline=None)
        csv_input = csv.reader(stream)
        
        affected = 0
        header = True
        batch: list = []
        batch_sz = _mongo_import_batch_size()
        for row in csv_input:
            if header:
                header = False
                continue

            if not row or len(row) < 3:
                continue

            record_id = row[1].strip()
            qa_worker = row[2].strip()

            batch.append(
                UpdateOne(
                    {"Job ID": job_id, "Record ID": record_id},
                    {"$set": {"QA1": qa_worker}},
                )
            )
            if len(batch) >= batch_sz:
                r = db.results.bulk_write(batch, ordered=False)
                affected += r.matched_count
                batch.clear()
        if batch:
            r = db.results.bulk_write(batch, ordered=False)
            affected += r.matched_count

        return jsonify({"message": f"Đã import thành công QA1 cho {affected} records."}), 200
        
    except Exception as e:
        return _serialize_error(f"Lỗi khi import file QA1: {str(e)}", 500)

@app.route('/api/jobs/<job_id>/import-qa2', methods=['POST'])
def import_qa2(job_id):
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy file"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Chưa chọn file"}), 400

    if not file.filename.endswith('.csv'):
        return jsonify({"error": "Chỉ hỗ trợ file CSV"}), 400

    try:
        stream = io.StringIO(file.stream.read().decode("utf-8-sig"), newline=None)
        csv_input = csv.reader(stream)
        
        affected = 0
        header = True
        batch: list = []
        batch_sz = _mongo_import_batch_size()
        for row in csv_input:
            if header:
                header = False
                continue

            if not row or len(row) < 3:
                continue

            record_id = row[1].strip()
            qa_worker = row[2].strip()

            batch.append(
                UpdateOne(
                    {"Job ID": job_id, "Record ID": record_id},
                    {"$set": {"QA2": qa_worker}},
                )
            )
            if len(batch) >= batch_sz:
                r = db.results.bulk_write(batch, ordered=False)
                affected += r.matched_count
                batch.clear()
        if batch:
            r = db.results.bulk_write(batch, ordered=False)
            affected += r.matched_count

        return jsonify({"message": f"Đã import thành công QA2 cho {affected} records."}), 200
        
    except Exception as e:
        return _serialize_error(f"Lỗi khi import file QA2: {str(e)}", 500)

@app.route('/api/jobs/<job_id>/sync', methods=['POST'])
def sync_job(job_id):
    global active_bot, active_thread, sync_logs, active_sync_job_id, sync_completion
    
    force = request.args.get('force', 'false').lower() == 'true'
    
    with bot_lock:
        if active_bot is not None:
            if not force:
                return jsonify({
                    "error": "Hệ thống đang bận đồng bộ một gói hàng khác",
                    "requires_confirmation": True,
                    "activeJobId": active_sync_job_id
                }), 409
            else:
                try:
                    if hasattr(active_bot, 'request_stop'):
                        active_bot.request_stop()
                except Exception:
                    pass
                # Reset state for force restart
                active_bot = None
                active_thread = None
                active_sync_job_id = None
        
        sync_logs["kpi"] = []
        sync_logs["qa1"] = []
        sync_logs["qa2"] = []
        sync_logs["pass_rate"] = []
        
        # Reset trạng thái hoàn thành trước đó
        sync_completion = {"job_id": None, "status": None, "progress": 0}
        
        from automation import KPIAutomation
        from kpi_automation import USERNAME, PASSWORD
        active_bot = KPIAutomation(USERNAME, PASSWORD, job_id)
        active_sync_job_id = job_id
    
    # Lấy thông tin qa1JobId và qa2JobId từ database
    job = db.jobs.find_one({"jobId": job_id})
    qa1_job_id = job.get("qa1JobId", "").strip() if job else ""
    qa2_job_id = job.get("qa2JobId", "").strip() if job else ""
    
    warnings = []
    if not qa1_job_id:
        warnings.append("Chưa có Job ID QA1")
    if not qa2_job_id:
        warnings.append("Chưa có Job ID QA2")
    req_data = request.get_json(silent=True) or {}
    run_kpi = req_data.get('kpi', True)
    run_qa1 = req_data.get('qa1', True)
    run_qa2 = req_data.get('qa2', True)
    
    def kpi_task():
        """Chạy KPI automation và cập nhật DB."""
        try:
            results = active_bot.run()
            if results:
                count = 0
                for row in results:
                    csv_job_id = row.get("Job ID")
                    record_id = row.get("Record ID")
                    kpi = row.get("KPI")
                    worker = row.get("Current Worker", "")
                    
                    if kpi is not None:
                        kpi = _to_float(kpi)
                            
                    if csv_job_id == job_id and record_id:
                        res = db.results.update_one(
                            {"Job ID": job_id, "Record ID": str(record_id)},
                            {"$set": {
                                "KPI": kpi,
                                "Current Worker": worker
                            }},
                            upsert=True
                        )
                        if res.modified_count > 0 or res.matched_count > 0 or res.upserted_id is not None:
                            count += 1
                kpi_automation.logger.info(f"Đã đồng bộ KPI {count} records cho {job_id}")
        except Exception as e:
            kpi_automation.logger.error(f"Lỗi khi chạy automation KPI: {e}")

    def qa_task(qa_job_id, qa_field):
        """Chạy list_qa.py automation và cập nhật trường QA1 hoặc QA2 vào DB."""
        try:
            from list_qa import run_automation as run_list_qa
            results = run_list_qa(job_id=qa_job_id, headless=True)
            if results:
                count = 0
                for row in results:
                    record_id = str(row.get("Record ID", "")).strip()
                    qa_worker = row.get("Current worker", "").strip()
                    
                    if record_id and qa_worker:
                        res = db.results.update_one(
                            {"Job ID": job_id, "Record ID": record_id},
                            {"$set": {qa_field: qa_worker}},
                            upsert=True
                        )
                        if res.modified_count > 0 or res.matched_count > 0 or res.upserted_id is not None:
                            count += 1
                list_qa.logger.info(f"Đã đồng bộ {qa_field} cho {count} records (QA Job: {qa_job_id})")
        except Exception as e:
            list_qa.logger.error(f"Lỗi khi chạy list_qa ({qa_field}, {qa_job_id}): {e}")

    def master_background_task():
        """Luồng chính: chạy song song các script đã chọn."""
        global active_bot, active_thread, active_sync_job_id, sync_completion
        try:
            threads = []
            
            if run_kpi:
                kpi_automation.logger.info(f"[Sync] Bắt đầu khởi chạy KPI (Job: {job_id})...")
                tkpi = threading.Thread(target=kpi_task, name="kpi", daemon=True)
                tkpi.start()
                threads.append(tkpi)
            else:
                kpi_automation.logger.info(f"[Sync] Bỏ qua KPI automation cho {job_id}.")

            if run_qa1 and qa1_job_id:
                kpi_automation.logger.info(f"[Sync] Bắt đầu khởi chạy QA1 (Job: {qa1_job_id})...")
                t1 = threading.Thread(target=qa_task, args=(qa1_job_id, "QA1"), name="qa1", daemon=True)
                t1.start()
                threads.append(t1)
            
            if run_qa2 and qa2_job_id:
                kpi_automation.logger.info(f"[Sync] Bắt đầu khởi chạy QA2 (Job: {qa2_job_id})...")
                t2 = threading.Thread(target=qa_task, args=(qa2_job_id, "QA2"), name="qa2", daemon=True)
                t2.start()
                threads.append(t2)
            
            for t in threads:
                t.join()
            
            # Lưu trạng thái hoàn thành TRƯỚC khi cleanup bot
            sync_completion["job_id"] = job_id
            sync_completion["status"] = "done"
            sync_completion["progress"] = 100
            
            try:
                active_bot.progress = 100
            except Exception:
                pass
                
            kpi_automation.logger.info(f"[Sync] Hoàn tất đồng bộ cho {job_id}.")
            time.sleep(5)  # Chờ đủ lâu để frontend kịp fetch 100%
        except Exception as e:
            kpi_automation.logger.error(f"[Sync] Lỗi master task: {e}")
            sync_completion["job_id"] = job_id
            sync_completion["status"] = "done"
            sync_completion["progress"] = 100
        finally:
            with bot_lock:
                active_bot = None
                active_thread = None
                active_sync_job_id = None

    thread = threading.Thread(target=master_background_task, name="master", daemon=True)
    with bot_lock:
        active_thread = thread
    thread.start()
    
    msg = "Hệ thống đang chạy nền để đồng bộ dữ liệu. Quá trình này có thể mất vài phút."
    if warnings:
        msg += " Lưu ý: " + ", ".join(warnings) + " — các luồng QA tương ứng sẽ không được chạy."
    
    return jsonify({"message": msg}), 202

@app.route('/api/users', methods=['GET'])
def get_users():
    """Trả về danh sách tất cả nhân sự (workers + QA) được trích xuất từ records."""
    try:
        # Lấy tất cả jobs để có thông tin tháng
        all_jobs = list(db.jobs.find({}, {"jobId": 1, "month": 1, "_id": 0}))
        job_month_map = {j["jobId"]: j.get("month", "") for j in all_jobs}
        job_ids = list(job_month_map.keys())
        
        # Lấy tất cả records
        records = list(db.results.find({"Job ID": {"$in": job_ids}}, {"_id": 0}))
        
        # Aggregate per user — giống logic kpi/stats
        label_map = {}
        qa_job_map = {}
        qa_meta = {}
        
        for rec in records:
            worker = rec.get("Current Worker", "").strip()
            kpi = _to_float(rec.get("KPI", 0))
            qa1 = rec.get("QA1", "").strip()
            qa2 = rec.get("QA2", "").strip()
            job_id = rec.get("Job ID", "")
            
            if worker:
                if worker not in label_map:
                    label_map[worker] = {"kpiLabel": 0, "recordsLabel": 0, "jobsLabel": set()}
                label_map[worker]["kpiLabel"] += kpi
                label_map[worker]["recordsLabel"] += 1
                label_map[worker]["jobsLabel"].add(job_id)
            
            for qa_user in [qa1, qa2]:
                if qa_user:
                    if qa_user not in qa_job_map:
                        qa_job_map[qa_user] = {}
                        qa_meta[qa_user] = {"recordsQA": 0, "jobsQA": set()}
                    if job_id not in qa_job_map[qa_user]:
                        qa_job_map[qa_user][job_id] = {"kpiSum": 0, "workers": set()}
                    qa_job_map[qa_user][job_id]["kpiSum"] += kpi
                    if worker:
                        qa_job_map[qa_user][job_id]["workers"].add(worker)
                    qa_meta[qa_user]["recordsQA"] += 1
                    qa_meta[qa_user]["jobsQA"].add(job_id)
        
        # Tính KPI QA cuối cùng
        qa_kpi_final = {}
        for qa_user, jobs_data in qa_job_map.items():
            total_qa_kpi = 0
            for jid, data in jobs_data.items():
                total_qa_kpi += data["kpiSum"]
            qa_kpi_final[qa_user] = round(total_qa_kpi)
        
        # Gộp tất cả users
        user_map = {}
        
        def ensure_user(name):
            if name not in user_map:
                user_map[name] = {
                    "username": name,
                    "kpiLabel": 0,
                    "kpiQA": 0,
                    "recordsLabel": 0,
                    "recordsQA": 0,
                    "jobsLabel": set(),
                    "jobsQA": set()
                }
        
        for uname, ldata in label_map.items():
            ensure_user(uname)
            user_map[uname]["kpiLabel"] = ldata["kpiLabel"]
            user_map[uname]["recordsLabel"] = ldata["recordsLabel"]
            user_map[uname]["jobsLabel"] = ldata["jobsLabel"]
        
        for qa_user in qa_kpi_final:
            ensure_user(qa_user)
            user_map[qa_user]["kpiQA"] = qa_kpi_final[qa_user]
            user_map[qa_user]["recordsQA"] = qa_meta[qa_user]["recordsQA"]
            user_map[qa_user]["jobsQA"] = qa_meta[qa_user]["jobsQA"]
        
        tg_map, tg_lookup = _load_users_telegram_lookup(db)

        # Build response
        users = []
        for uname, data in user_map.items():
            role = "Label"
            if data["recordsLabel"] > 0 and data["recordsQA"] > 0:
                role = "Label / QA"
            elif data["recordsQA"] > 0:
                role = "QA"
            
            users.append({
                "username": uname,
                "role": role,
                "id_telegram": tg_lookup(uname),
                "kpiLabel": round(data["kpiLabel"], 2),
                "kpiQA": round(data["kpiQA"], 2),
                "totalKpi": round(data["kpiLabel"] + data["kpiQA"], 2),
                "recordsLabel": data["recordsLabel"],
                "recordsQA": data["recordsQA"],
                "totalRecords": data["recordsLabel"] + data["recordsQA"],
                "jobCountLabel": len(data["jobsLabel"]),
                "jobCountQA": len(data["jobsQA"]),
                "totalJobs": len(data["jobsLabel"] | data["jobsQA"]),
            })

        # User chỉ có trong users (Telegram seed) nhưng chưa có trong results của job nào
        in_list = {u["username"] for u in users}
        for uname, tid in tg_map.items():
            if uname in in_list:
                continue
            users.append({
                "username": uname,
                "role": "Telegram",
                "id_telegram": tid,
                "kpiLabel": 0.0,
                "kpiQA": 0.0,
                "totalKpi": 0.0,
                "recordsLabel": 0,
                "recordsQA": 0,
                "totalRecords": 0,
                "jobCountLabel": 0,
                "jobCountQA": 0,
                "totalJobs": 0,
            })
        
        users.sort(key=lambda u: u["totalKpi"], reverse=True)
        
        payload = _to_jsonable(users)
        # json.dumps giữ key id_telegram kể cả giá trị null (jsonify mặc định có thể bỏ key None).
        for row in payload:
            if isinstance(row, dict) and "id_telegram" not in row:
                row["id_telegram"] = None
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        return Response(body, mimetype="application/json; charset=utf-8")

    except PyMongoError as e:
        return _serialize_error(f"Lỗi đọc dữ liệu MongoDB: {str(e)}", 500)
    except Exception as e:
        return _serialize_error(f"Lỗi server: {str(e)}", 500)

@app.route('/api/users/<username>', methods=['DELETE'])
def delete_user(username):
    try:
        del_res = db.results.delete_many({"Current Worker": username})
        qa1_res = db.results.update_many({"QA1": username}, {"$set": {"QA1": ""}})
        qa2_res = db.results.update_many({"QA2": username}, {"$set": {"QA2": ""}})
        try:
            db["users"].delete_one({"username": username})
        except PyMongoError:
            pass
        
        return jsonify({
            "message": f"Đã xóa user {username}",
            "deleted_records": del_res.deleted_count,
            "modified_qa": qa1_res.modified_count + qa2_res.modified_count
        }), 200
    except Exception as e:
        return _serialize_error(f"Lỗi khi xóa user: {str(e)}", 500)

@app.route('/api/users/bulk-delete', methods=['POST'])
def bulk_delete_users():
    try:
        data = request.get_json()
        usernames = data.get("usernames", [])
        if not usernames:
            return jsonify({"error": "Không có user nào được chọn"}), 400
            
        del_res = db.results.delete_many({"Current Worker": {"$in": usernames}})
        qa1_res = db.results.update_many({"QA1": {"$in": usernames}}, {"$set": {"QA1": ""}})
        qa2_res = db.results.update_many({"QA2": {"$in": usernames}}, {"$set": {"QA2": ""}})
        try:
            db["users"].delete_many({"username": {"$in": usernames}})
        except PyMongoError:
            pass
        
        return jsonify({
            "message": f"Đã xóa {len(usernames)} users",
            "deleted_records": del_res.deleted_count,
            "modified_qa": qa1_res.modified_count + qa2_res.modified_count
        }), 200
    except Exception as e:
        return _serialize_error(f"Lỗi khi xóa users: {str(e)}", 500)

@app.route('/api/kpi/backup', methods=['GET'])
def kpi_full_backup():
    """Export toàn bộ dữ liệu KPI admin: collection jobs và results (MongoDB kpi_db)."""
    try:
        jobs_docs = list(db.jobs.find({}))
        results_docs = list(db.results.find({}))
        payload = {
            "schemaVersion": 1,
            "database": "kpi_db",
            "exportedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "collections": {
                "jobs": jobs_docs,
                "results": results_docs,
            },
        }
        raw = json.dumps(payload, default=json_util.default, ensure_ascii=False)
        resp = make_response(raw)
        ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        resp.headers["Content-Type"] = "application/json; charset=utf-8"
        resp.headers["Content-Disposition"] = f'attachment; filename="kpi-backup-{ts}.json"'
        return resp
    except PyMongoError as e:
        return _serialize_error(f"Lỗi MongoDB khi backup: {str(e)}", 500)

@app.route('/api/kpi/restore', methods=['POST'])
def kpi_full_restore():
    """Khôi phục đầy đủ KPI từ file JSON do /api/kpi/backup sinh ra (multipart field 'file').
    Xóa toàn bộ jobs + results hiện tại rồi ghi lại."""
    try:
        f = request.files.get("file")
        if not f or not f.filename:
            return _serialize_error("Thiếu file backup (multipart field 'file')", 400)
        raw = f.read()
        try:
            text = raw.decode("utf-8-sig")
            payload = json_util.loads(text)
        except (UnicodeDecodeError, ValueError) as e:
            return _serialize_error(f"Không đọc được JSON backup: {e}", 400)

        try:
            stats = restore_kpi_payload(db, payload)
        except ValueError as e:
            return _serialize_error(str(e), 400)

        verification = verify_restored_data_matches_payload(db, payload)

        return jsonify(
            {
                "message": "Đã khôi phục KPI từ backup",
                **stats,
                "exportedAt": payload.get("exportedAt"),
                "schemaVersion": payload.get("schemaVersion"),
                "verification": verification,
            }
        ), 200
    except DocumentTooLarge as e:
        app.logger.exception("kpi_full_restore DocumentTooLarge")
        return _serialize_error(
            f"Document vượt quá giới hạn 16MB của MongoDB (hoặc lô insert quá lớn). Thử giảm RESTORE_INSERT_BATCH. Chi tiết: {e}",
            400,
        )
    except PyMongoError as e:
        app.logger.exception("kpi_full_restore")
        hint = _mongo_connection_hint(e)
        detail = _restore_mongo_detail(e)
        msg = f"Lỗi MongoDB khi restore: {e}{detail}"
        if hint:
            msg += f". {hint}"
        return _serialize_error(msg, 500)
    except Exception as e:
        app.logger.exception("kpi_full_restore")
        return _serialize_error(f"Lỗi khi restore: {str(e)}", 500)


@app.route('/api/kpi/stats', methods=['GET'])
def kpi_stats():
    """Thống kê KPI toàn bộ nhân sự trong tháng.
    Query params:
        month: Tháng cần lọc, ví dụ "04/2026". Nếu không truyền sẽ lấy tất cả.
    """
    try:
        month = request.args.get('month', None)
        
        # Lấy danh sách job theo tháng
        job_filter = {}
        if month:
            job_filter["month"] = month
        
        jobs = list(db.jobs.find(job_filter, {"jobId": 1, "jobName": 1, "month": 1, "hiddenUsers": 1, "_id": 0}))
        job_ids = [j["jobId"] for j in jobs]
        job_hidden_map = {j["jobId"]: j.get("hiddenUsers", []) for j in jobs}
        
        # Lấy danh sách tháng có sẵn (luôn lấy toàn bộ)
        all_months = sorted(list(set(j.get("month", "") for j in db.jobs.find({}, {"month": 1, "_id": 0}))))
        
        if not job_ids:
            return jsonify({
                "month": month or "all",
                "users": [],
                "totals": {
                    "totalKpiLabel": 0, "totalKpiQA": 0, "totalKpiCustomer": 0,
                    "totalRecords": 0,
                    "totalRecordsLabel": 0, "totalRecordsQA": 0,
                    "totalUsers": 0, "totalJobs": 0
                },
                "availableMonths": all_months
            })
        
        # Lấy tất cả records thuộc các jobs đã lọc
        records = list(db.results.find({"Job ID": {"$in": job_ids}}, {"_id": 0}))
        
        # Tổng records thực tế từ các gói hàng
        total_records = len(records)
        
        # ── Bước 1 & 2: Tính KPI Label, QA1, QA2 ──
        user_map = {}
        
        def ensure_user(name):
            if name not in user_map:
                user_map[name] = {
                    "username": name,
                    "kpiLabel": 0,
                    "kpiQA1": 0,
                    "kpiQA1Customer": 0,
                    "kpiQA2": 0,
                    "recordsLabel": 0,
                    "recordsQA1": 0,
                    "recordsQA2": 0,
                    "jobsLabel": set(),
                    "jobsQA1": set(),
                    "jobsQA2": set()
                }

        total_kpi_customer = 0
        
        for rec in records:
            worker = rec.get("Current Worker", "").strip()
            qa1 = rec.get("QA1", "").strip()
            qa2 = rec.get("QA2", "").strip()
            job_id = rec.get("Job ID", "")
            
            kpi = _to_float(rec.get("KPI", 0))
            kpi_cust = _to_float(rec.get("kpiCustomer", 0))
                
            total_kpi_customer += kpi_cust
            
            hidden_users = job_hidden_map.get(job_id, [])
            
            # KPI Label
            if worker and worker not in hidden_users:
                ensure_user(worker)
                user_map[worker]["kpiLabel"] += kpi
                user_map[worker]["recordsLabel"] += 1
                user_map[worker]["jobsLabel"].add(job_id)
            
            # KPI QA1
            if qa1 and qa1 not in hidden_users:
                ensure_user(qa1)
                user_map[qa1]["kpiQA1"] += kpi
                user_map[qa1]["kpiQA1Customer"] += kpi_cust
                user_map[qa1]["recordsQA1"] += 1
                user_map[qa1]["jobsQA1"].add(job_id)
                
            # KPI QA2
            if qa2 and qa2 not in hidden_users:
                ensure_user(qa2)
                user_map[qa2]["kpiQA2"] += kpi
                user_map[qa2]["recordsQA2"] += 1
                user_map[qa2]["jobsQA2"].add(job_id)
        
        # Build response
        users = []
        total_kpi_label = 0
        total_kpi_qa1 = 0
        total_kpi_qa1_customer = 0
        total_kpi_qa2 = 0
        total_records_label = 0
        total_records_qa1 = 0
        total_records_qa2 = 0
        
        for uname, data in user_map.items():
            role = "Label"
            has_qa = data["recordsQA1"] > 0 or data["recordsQA2"] > 0
            if data["recordsLabel"] > 0 and has_qa:
                role = "Label / QA"
            elif has_qa:
                role = "QA"
            
            users.append({
                "username": uname,
                "role": role,
                "kpiLabel": round(data["kpiLabel"], 2),
                "kpiQA1": round(data["kpiQA1"], 2),
                "kpiQA1Customer": round(data["kpiQA1Customer"], 2),
                "kpiQA2": round(data["kpiQA2"], 2),
                "kpiQA": round(data["kpiQA1"] + data["kpiQA2"], 2),
                "recordsLabel": data["recordsLabel"],
                "recordsQA1": data["recordsQA1"],
                "recordsQA2": data["recordsQA2"],
                "recordsQA": data["recordsQA1"] + data["recordsQA2"],
                "jobCountLabel": len(data["jobsLabel"]),
                "jobCountQA1": len(data["jobsQA1"]),
                "jobCountQA2": len(data["jobsQA2"]),
            })
            total_kpi_label += data["kpiLabel"]
            total_kpi_qa1 += data["kpiQA1"]
            total_kpi_qa1_customer += data["kpiQA1Customer"]
            total_kpi_qa2 += data["kpiQA2"]
            total_records_label += data["recordsLabel"]
            total_records_qa1 += data["recordsQA1"]
            total_records_qa2 += data["recordsQA2"]
        
        # Sắp xếp theo tổng KPI giảm dần
        users.sort(key=lambda u: (u["kpiLabel"] + u["kpiQA1"] + u["kpiQA2"]), reverse=True)
        
        return jsonify({
            "month": month or "all",
            "users": users,
            "totals": {
                "totalKpiLabel": round(total_kpi_label, 2),
                "totalKpiQA1": round(total_kpi_qa1, 2),
                "totalKpiQA1Customer": round(total_kpi_qa1_customer, 2),
                "totalKpiQA2": round(total_kpi_qa2, 2),
                "totalKpiQA": round(total_kpi_qa1 + total_kpi_qa2, 2),
                "totalKpiCustomer": round(total_kpi_customer, 2),
                "totalRecords": total_records,
                "totalRecordsLabel": total_records_label,
                "totalRecordsQA1": total_records_qa1,
                "totalRecordsQA2": total_records_qa2,
                "totalRecordsQA": total_records_qa1 + total_records_qa2,
                "totalUsers": len(users),
                "totalJobs": len(job_ids)
            },
            "availableMonths": all_months
        })
        
    except PyMongoError as e:
        return _serialize_error(f"Lỗi đọc dữ liệu MongoDB: {str(e)}", 500)


@app.route('/api/kpi/stats/daily', methods=['GET'])
def kpi_stats_daily():
    """KPI gom theo ngày hoàn thành record (trường Completed At), không dùng ngày nhận gói.
    Query:
        month: lọc gói theo tháng (mm/yyyy), giống /api/kpi/stats.
        username: nếu có — chỉ KPI của user đó (Label + QA1 + QA2); nếu rỗng — tổng toàn hệ thống theo ngày.
        from, to: YYYY-MM-DD giới hạn dải ngày trả về (tùy chọn).
        Khi username rỗng: thêm userBreakdown — từng dòng là KPI theo ngày của từng nhân sự (Label/QA1/QA2 tách theo vai trò).
    """
    try:
        month = request.args.get("month", None)
        username = (request.args.get("username") or "").strip() or None
        date_from = (request.args.get("from") or "").strip() or None
        date_to = (request.args.get("to") or "").strip() or None

        job_filter = {}
        if month:
            job_filter["month"] = month

        jobs = list(
            db.jobs.find(
                job_filter,
                {"jobId": 1, "month": 1, "hiddenUsers": 1, "_id": 0},
            )
        )
        job_ids = [j["jobId"] for j in jobs]
        job_hidden_map = {j["jobId"]: j.get("hiddenUsers", []) for j in jobs}
        all_months = sorted(
            list(set(j.get("month", "") for j in db.jobs.find({}, {"month": 1, "_id": 0})))
        )

        if not job_ids:
            return jsonify(
                {
                    "month": month or "all",
                    "username": username,
                    "series": [],
                    "userBreakdown": [],
                    "unknownRecords": 0,
                    "unknownKpiLabel": 0,
                    "unknownKpiQA": 0,
                    "availableMonths": all_months,
                }
            )

        records = list(
            db.results.find(
                {"Job ID": {"$in": job_ids}},
                {
                    "_id": 0,
                    "Job ID": 1,
                    "Record ID": 1,
                    "Current Worker": 1,
                    "QA1": 1,
                    "QA2": 1,
                    "KPI": 1,
                    "Completed At": 1,
                },
            )
        )

        def day_bucket(rec):
            completed = rec.get("Completed At", "")
            d = _completed_at_calendar_day(completed)
            return d if d else "__unknown__"

        buckets = {}
        unknown_keys = set()

        def ensure_bucket(day):
            if day not in buckets:
                buckets[day] = {
                    "kpiLabel": 0.0,
                    "kpiQA1": 0.0,
                    "kpiQA2": 0.0,
                    "recordsLabel": 0,
                    "recordsQA1": 0,
                    "recordsQA2": 0,
                }

        user_day = {}

        def ensure_user_day(u_name, d):
            if d == "__unknown__" or not u_name:
                return None
            k = (u_name, d)
            if k not in user_day:
                user_day[k] = {
                    "kpiLabel": 0.0,
                    "kpiQA1": 0.0,
                    "kpiQA2": 0.0,
                    "recordsLabel": 0,
                    "recordsQA1": 0,
                    "recordsQA2": 0,
                }
            return user_day[k]

        for rec in records:
            worker = (rec.get("Current Worker") or "").strip()
            qa1 = (rec.get("QA1") or "").strip()
            qa2 = (rec.get("QA2") or "").strip()
            jid = rec.get("Job ID", "")
            hidden = job_hidden_map.get(jid, [])
            kpi = _to_float(rec.get("KPI", 0))
            day = day_bucket(rec)

            if username:
                if worker != username and qa1 != username and qa2 != username:
                    continue

            if day == "__unknown__":
                jid_u = rec.get("Job ID", "")
                rid_u = str(rec.get("Record ID", "")).strip()
                unknown_keys.add((jid_u, rid_u))

            ensure_bucket(day)
            b = buckets[day]

            if username:
                if worker == username and worker and worker not in hidden:
                    b["kpiLabel"] += kpi
                    b["recordsLabel"] += 1
                    ub = ensure_user_day(worker, day)
                    if ub is not None:
                        ub["kpiLabel"] += kpi
                        ub["recordsLabel"] += 1
                if qa1 == username and qa1 and qa1 not in hidden:
                    b["kpiQA1"] += kpi
                    b["recordsQA1"] += 1
                    ub = ensure_user_day(qa1, day)
                    if ub is not None:
                        ub["kpiQA1"] += kpi
                        ub["recordsQA1"] += 1
                if qa2 == username and qa2 and qa2 not in hidden:
                    b["kpiQA2"] += kpi
                    b["recordsQA2"] += 1
                    ub = ensure_user_day(qa2, day)
                    if ub is not None:
                        ub["kpiQA2"] += kpi
                        ub["recordsQA2"] += 1
            else:
                if worker and worker not in hidden:
                    b["kpiLabel"] += kpi
                    b["recordsLabel"] += 1
                    ub = ensure_user_day(worker, day)
                    if ub is not None:
                        ub["kpiLabel"] += kpi
                        ub["recordsLabel"] += 1
                if qa1 and qa1 not in hidden:
                    b["kpiQA1"] += kpi
                    b["recordsQA1"] += 1
                    ub = ensure_user_day(qa1, day)
                    if ub is not None:
                        ub["kpiQA1"] += kpi
                        ub["recordsQA1"] += 1
                if qa2 and qa2 not in hidden:
                    b["kpiQA2"] += kpi
                    b["recordsQA2"] += 1
                    ub = ensure_user_day(qa2, day)
                    if ub is not None:
                        ub["kpiQA2"] += kpi
                        ub["recordsQA2"] += 1

        unknown = buckets.pop("__unknown__", None)
        unknown_records = len(unknown_keys)
        unknown_kpi_label = 0.0
        unknown_kpi_qa = 0.0
        if unknown:
            unknown_kpi_label = unknown["kpiLabel"]
            unknown_kpi_qa = unknown["kpiQA1"] + unknown["kpiQA2"]

        ordered_days = sorted(buckets.keys())
        series = []
        for day in ordered_days:
            if date_from and day < date_from:
                continue
            if date_to and day > date_to:
                continue
            b = buckets[day]
            series.append(
                {
                    "date": day,
                    "kpiLabel": round(b["kpiLabel"], 2),
                    "kpiQA1": round(b["kpiQA1"], 2),
                    "kpiQA2": round(b["kpiQA2"], 2),
                    "kpiQA": round(b["kpiQA1"] + b["kpiQA2"], 2),
                    "recordsLabel": b["recordsLabel"],
                    "recordsQA1": b["recordsQA1"],
                    "recordsQA2": b["recordsQA2"],
                    "recordsQA": b["recordsQA1"] + b["recordsQA2"],
                }
            )

        user_breakdown = []
        for (uname, d), b in user_day.items():
            if date_from and d < date_from:
                continue
            if date_to and d > date_to:
                continue
            user_breakdown.append(
                {
                    "date": d,
                    "username": uname,
                    "kpiLabel": round(b["kpiLabel"], 2),
                    "kpiQA1": round(b["kpiQA1"], 2),
                    "kpiQA2": round(b["kpiQA2"], 2),
                    "kpiQA": round(b["kpiQA1"] + b["kpiQA2"], 2),
                    "recordsLabel": b["recordsLabel"],
                    "recordsQA1": b["recordsQA1"],
                    "recordsQA2": b["recordsQA2"],
                    "recordsQA": b["recordsQA1"] + b["recordsQA2"],
                }
            )
        user_breakdown.sort(key=lambda r: r["username"])
        user_breakdown.sort(key=lambda r: r["date"], reverse=True)

        return jsonify(
            {
                "month": month or "all",
                "username": username,
                "series": series,
                "userBreakdown": user_breakdown,
                "unknownRecords": int(unknown_records),
                "unknownKpiLabel": round(unknown_kpi_label, 2),
                "unknownKpiQA": round(unknown_kpi_qa, 2),
                "availableMonths": all_months,
            }
        )
    except PyMongoError as e:
        return _serialize_error(f"Lỗi đọc dữ liệu MongoDB: {str(e)}", 500)
    except Exception as e:
        return _serialize_error(f"Lỗi server: {str(e)}", 500)


@app.route('/api/kpi/reconciliation', methods=['GET'])
def kpi_reconciliation():
    """Đối soát KPI: so sánh KPI hệ thống vs KPI khách hàng, group theo gói hàng."""
    try:
        # Lấy các jobs đã được duyệt
        jobs = list(db.jobs.find({"status": "Đã được duyệt"}, {"_id": 0, "jobId": 1, "jobName": 1, "hiddenUsers": 1}))
        job_ids = [j["jobId"] for j in jobs]
        job_name_map = {j["jobId"]: j["jobName"] for j in jobs}
        job_hidden_map = {j["jobId"]: j.get("hiddenUsers", []) for j in jobs}

        if not job_ids:
            return jsonify([])

        # Lấy tất cả records hệ thống (đã bao gồm kpiCustomer)
        records = list(db.results.find({"Job ID": {"$in": job_ids}}, {"_id": 0}))

        # System map: (jobId, recordId) -> {kpiSystem, kpiCustomer, username}
        system_map = {}
        for rec in records:
            job_id = rec.get("Job ID", "")
            record_id = rec.get("Record ID", "")
            worker = rec.get("Current Worker", "").strip()
            
            qa1 = rec.get("QA1", "").strip()
            qa2 = rec.get("QA2", "").strip()
            
            kpi = _to_float(rec.get("KPI", 0))
            kpi_customer = _to_float(rec.get("kpiCustomer", 0))

            if job_id and record_id:
                key = (job_id, record_id)
                system_map[key] = {
                    "kpiSystem": kpi, 
                    "kpiCustomer": kpi_customer,
                    "username": worker,
                    "qa1": qa1,
                    "qa2": qa2
                }

        # Build result grouped by job
        result = []
        for job_id in job_ids:
            job_name = job_name_map.get(job_id, job_id)

            # Collect all recordIds for this job
            record_ids = set()
            for (jid, rid) in system_map:
                if jid == job_id:
                    record_ids.add(rid)

            if not record_ids:
                continue

            job_kpi_label = 0
            job_kpi_qa = 0

            rows = []
            for rid in sorted(record_ids):
                sys_key = (job_id, rid)
                sys_data = system_map.get(sys_key, {})
                
                sys_kpi = sys_data.get("kpiSystem", 0)
                hidden_users = job_hidden_map.get(job_id, [])
                uname = sys_data.get("username") or "—"
                
                # Calculate Label and QA KPI for this record
                if uname and uname not in hidden_users:
                    job_kpi_label += sys_kpi
                
                qa1 = sys_data.get("qa1", "")
                qa2 = sys_data.get("qa2", "")
                if qa1 and qa1 != "—" and qa1 not in hidden_users:
                    job_kpi_qa += sys_kpi
                if qa2 and qa2 != "—" and qa2 not in hidden_users:
                    job_kpi_qa += sys_kpi

                # System KPI for reconciliation row
                sys_kpi_rounded = round(sys_kpi if uname not in hidden_users else 0, 2)
                cust_kpi_rounded = round(sys_data.get("kpiCustomer", 0), 2)

                # Tính chênh lệch
                if cust_kpi_rounded > 0:
                    diff_pct = round(abs(sys_kpi_rounded - cust_kpi_rounded) / cust_kpi_rounded * 100, 2)
                elif sys_kpi_rounded > 0:
                    diff_pct = 100.0
                else:
                    diff_pct = 0

                # Đánh giá
                if diff_pct > 10:
                    status = "abnormal"
                elif diff_pct > 5:
                    status = "acceptable"
                elif diff_pct > 2:
                    status = "ok"
                else:
                    status = "good"

                rows.append({
                    "recordId": rid,
                    "username": uname,
                    "kpiSystem": sys_kpi_rounded,
                    "kpiCustomer": cust_kpi_rounded,
                    "diffPercent": diff_pct,
                    "status": status,
                })

            result.append({
                "jobId": job_id,
                "jobName": job_name,
                "kpiLabel": round(job_kpi_label, 2),
                "kpiQa": round(job_kpi_qa, 2),
                "rows": rows,
            })

        return jsonify(result)

    except PyMongoError as e:
        return _serialize_error(f"Lỗi đọc dữ liệu MongoDB: {str(e)}", 500)
    except Exception as e:
        return _serialize_error(f"Lỗi server: {str(e)}", 500)


@app.route('/api/kpi/reconciliation/import', methods=['POST'])
def import_customer_kpi():
    """Import KPI khách hàng đếm từ file CSV.
    CSV format expected: 10 columns
    0: job id (chỉ cần khớp phần đầu đến dấu gạch ngang)
    1: job name (khớp chính xác)
    2: record id
    3: username
    ...
    6: KPI
    """
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy file"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Chưa chọn file"}), 400

    if not file.filename.endswith('.csv'):
        return jsonify({"error": "Chỉ hỗ trợ file CSV"}), 400

    try:
        content = file.stream.read().decode("utf-8-sig")
        if not content.strip():
            return jsonify({"error": "File rỗng"}), 400

        delimiter = ','
        first_line = content.split('\n')[0]
        if '\t' in first_line:
            delimiter = '\t'
        elif ';' in first_line:
            delimiter = ';'

        stream = io.StringIO(content, newline=None)
        csv_input = csv.reader(stream, delimiter=delimiter)

        # Lấy tất cả jobs để so khớp
        all_jobs = list(db.jobs.find({}, {"jobId": 1, "jobName": 1, "_id": 0}))

        count = 0
        header = True
        skipped_reasons = []
        
        parsed_rows = []
        file_jobs = {} # job_id -> set of record_ids

        for idx, row in enumerate(csv_input):
            # Check if row has at least 7 columns
            if not row:
                continue

            # Detect if it's a header row
            if header:
                header = False
                # If first column contains "job" or "id" (case insensitive), it's a header, so we skip
                if "job" in row[0].lower() or "id" in row[0].lower():
                    continue
                # If it's actual data (e.g. starts with G), don't skip, just process it

            if len(row) < 7:
                if len(skipped_reasons) < 5:
                    skipped_reasons.append(f"Dòng {idx+1} có ít hơn 7 cột ({len(row)} cột)")
                continue

            csv_job_id = row[0].strip()
            csv_job_name = row[1].strip()
            record_id = str(row[2]).strip()
            username = row[3].strip()

            try:
                # Handle comma as decimal separator
                kpi_str = row[6].strip().replace(',', '.')
                kpi_customer = float(kpi_str)
            except ValueError:
                kpi_customer = 0

            # Xác định prefix của job id từ file (đến dấu gạch ngang đầu tiên)
            if '-' in csv_job_id:
                prefix = csv_job_id.split('-')[0] + '-'
            else:
                prefix = csv_job_id

            # So khớp với database
            matched_job_id = None
            for job in all_jobs:
                db_job_id = job.get("jobId", "")
                db_job_name = job.get("jobName", "")
                
                # Compare job names case-insensitively, ignore extra spaces
                db_name_clean = " ".join(db_job_name.lower().split())
                csv_name_clean = " ".join(csv_job_name.lower().split())
                
                if db_name_clean == csv_name_clean and db_job_id.startswith(prefix):
                    matched_job_id = db_job_id
                    break

            if not matched_job_id:
                if len(skipped_reasons) < 5:
                    skipped_reasons.append(f"Dòng {idx+1}: Không tìm thấy gói hàng tương ứng với '{csv_job_name}'")
                continue
                
            if not record_id:
                if len(skipped_reasons) < 5:
                    skipped_reasons.append(f"Dòng {idx+1}: Thiếu Record ID")
                continue

            parsed_rows.append({
                "job_id": matched_job_id,
                "record_id": record_id,
                "kpi_customer": kpi_customer,
                "username": username
            })
            
            if matched_job_id not in file_jobs:
                file_jobs[matched_job_id] = set()
            file_jobs[matched_job_id].add(record_id)

        if skipped_reasons:
            err_msg = "File bị lỗi định dạng hoặc chứa dữ liệu không hợp lệ:\n" + "\n".join(skipped_reasons)
            return jsonify({"error": err_msg}), 400

        if not parsed_rows:
            return jsonify({"error": "Không có dữ liệu hợp lệ nào được tìm thấy trong file."}), 400

        # Lấy bản đồ tên job để hiển thị thân thiện hơn
        job_map = {j["jobId"]: j.get("jobName", "Unknown") for j in all_jobs}

        # Đối chiếu toàn vẹn (thừa/thiếu) so với DB
        integrity_errors = []
        for job_id, file_records in file_jobs.items():
            # Lấy tất cả record_ids của gói hàng này trên DB
            db_records = set(r["Record ID"] for r in db.results.find({"Job ID": job_id}, {"Record ID": 1}))
            job_name = job_map.get(job_id, job_id)
            
            # Tìm Record thừa (có trong file nhưng không có trong DB)
            extra_records = file_records - db_records
            if extra_records:
                sample = ", ".join(list(extra_records)[:20])
                if len(extra_records) > 20:
                    sample += ", ..."
                integrity_errors.append(f"📦 Gói hàng: '{job_name}' (ID: {job_id})\n❌ Bị THỪA {len(extra_records)} record trong file (các ID này không tồn tại trên hệ thống):\n   -> {sample}\n")
                
            # Tìm Record thiếu (có trong DB nhưng không có trong file)
            missing_records = db_records - file_records
            if missing_records:
                sample = ", ".join(list(missing_records)[:20])
                if len(missing_records) > 20:
                    sample += ", ..."
                integrity_errors.append(f"📦 Gói hàng: '{job_name}' (ID: {job_id})\n❌ Bị THIẾU {len(missing_records)} record trong file (có trên hệ thống nhưng file bị thiếu):\n   -> {sample}\n")

        if integrity_errors:
            err_msg = "Không thể import do dữ liệu không khớp hoàn toàn với hệ thống:\n\n" + "\n".join(integrity_errors)
            return jsonify({"error": err_msg}), 400

        # Nếu mọi thứ hợp lệ (hoàn toàn khớp), tiến hành bulk_write theo lô
        operations = []
        now_iso = datetime.now().isoformat()
        for r in parsed_rows:
            operations.append(
                UpdateOne(
                    {"Job ID": r["job_id"], "Record ID": r["record_id"]},
                    {
                        "$set": {
                            "kpiCustomer": r["kpi_customer"],
                            "Customer Username": r["username"],
                            "importedAt": now_iso,
                        }
                    },
                )
            )

        if operations:
            _results_bulk_write_chunked(operations)

        return jsonify({"message": f"Đã import thành công KPI khách hàng cho {len(operations)} bản ghi."}), 200

    except Exception as e:
        return _serialize_error(f"Lỗi khi import file: {str(e)}", 500)

@app.route('/api/kpi/reconciliation/reset', methods=['POST'])
def reset_customer_kpi():
    try:
        result = db.results.update_many({}, {"$unset": {"kpiCustomer": "", "Customer Username": "", "importedAt": ""}})
        return jsonify({"message": f"Đã reset dữ liệu khách hàng. Đã xoá trên {result.modified_count} records."}), 200
    except Exception as e:
        return _serialize_error(f"Lỗi reset dữ liệu: {str(e)}", 500)


if __name__ == '__main__':
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host='0.0.0.0', port=5000, debug=debug_mode, use_reloader=False)
