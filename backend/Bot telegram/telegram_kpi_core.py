"""
Lõi KPI + Telegram: MongoDB (liên kết chat ↔ worker), tổng hợp số liệu theo gói hàng,
gửi tin qua Bot API (HTTP) để dùng chung từ Flask và từ bot polling.
"""
from __future__ import annotations

import html
import os
import re
from datetime import datetime, timezone
from typing import Any

import requests
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

LINK_COLLECTION = "telegram_links"


def _mongo_uri() -> str:
    return os.environ.get("MONGO_URI", "mongodb://127.0.0.1:27017/kpi_db")


def get_db() -> Database:
    return MongoClient(_mongo_uri()).kpi_db


def links_collection(db: Database) -> Collection:
    return db[LINK_COLLECTION]


def ensure_telegram_indexes(db: Database) -> None:
    col = links_collection(db)
    col.create_index("chatId", unique=True)
    col.create_index("workerUsername")
    db["users"].create_index("username", unique=True)


def _to_float(v: Any, default: float = 0.0) -> float:
    if v is None:
        return default
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", ".").strip())
    except (TypeError, ValueError):
        return default


def _telegram_chat_id_from_user_doc(doc: dict[str, Any] | None) -> int | None:
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


def parse_admin_chat_ids(raw: str | None) -> set[int]:
    if not raw or not str(raw).strip():
        return set()
    out: set[int] = set()
    for part in str(raw).split(","):
        part = part.strip()
        if part.isdigit() or (part.startswith("-") and part[1:].isdigit()):
            out.add(int(part))
    return out


def is_admin_chat(chat_id: int) -> bool:
    return chat_id in parse_admin_chat_ids(os.environ.get("TELEGRAM_ADMIN_IDS", ""))


def send_telegram_message(
    token: str,
    chat_id: int,
    text: str,
    *,
    parse_mode: str | None = "HTML",
    disable_web_page_preview: bool = True,
) -> tuple[bool, str]:
    if not token:
        return False, "Thiếu TELEGRAM_BOT_TOKEN"
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": disable_web_page_preview,
    }
    if parse_mode:
        payload["parse_mode"] = parse_mode
    try:
        r = requests.post(url, json=payload, timeout=45)
        if not r.ok:
            try:
                err = r.json()
            except Exception:
                err = r.text
            return False, str(err)
        return True, ""
    except requests.RequestException as e:
        return False, str(e)


def link_worker(db: Database, chat_id: int, worker_username: str) -> tuple[bool, str]:
    worker_username = (worker_username or "").strip()
    if not worker_username:
        return False, "Tên worker không được để trống."
    if len(worker_username) > 200:
        return False, "Tên worker quá dài."

    hits = db.results.count_documents({"Current Worker": worker_username})
    if hits == 0:
        return (
            False,
            "Không thấy bản ghi nào với Current Worker trùng tên này trong hệ thống. "
            "Kiểm tra chính tả (phân biệt hoa thường).",
        )

    links_collection(db).update_one(
        {"chatId": chat_id},
        {
            "$set": {
                "workerUsername": worker_username,
                "updatedAt": datetime.now(timezone.utc),
            },
            "$setOnInsert": {"createdAt": datetime.now(timezone.utc)},
        },
        upsert=True,
    )
    return True, f"Đã liên kết Telegram với worker <b>{html.escape(worker_username)}</b>."


def unlink_worker(db: Database, chat_id: int) -> tuple[bool, str]:
    r = links_collection(db).delete_one({"chatId": chat_id})
    if r.deleted_count:
        return True, "Đã hủy liên kết."
    return False, "Chưa có liên kết để hủy."


def get_linked_username(db: Database, chat_id: int) -> str | None:
    doc = links_collection(db).find_one({"chatId": chat_id}, {"workerUsername": 1})
    if not doc:
        return None
    u = doc.get("workerUsername")
    return (u or "").strip() or None


def distinct_workers_in_job(db: Database, job_id: str) -> list[str]:
    job_id = (job_id or "").strip()
    if not job_id:
        return []
    names = db.results.distinct("Current Worker", {"Job ID": job_id})
    out: list[str] = []
    for n in names:
        s = (n or "").strip()
        if s:
            out.append(s)
    return sorted(set(out))


def chat_ids_for_worker(db: Database, worker_username: str) -> list[int]:
    """Hợp nhất chat ID từ bot /link (telegram_links) và từ collection users.id_telegram."""
    seen: set[int] = set()
    out: list[int] = []
    cur = links_collection(db).find({"workerUsername": worker_username}, {"chatId": 1})
    for d in cur:
        cid = d.get("chatId")
        if cid is None:
            continue
        i = int(cid)
        if i not in seen:
            seen.add(i)
            out.append(i)
    wu = (worker_username or "").strip()
    udoc = db["users"].find_one({"username": wu}) if wu else None
    if not udoc and wu:
        udoc = db["users"].find_one({"username": {"$regex": f"^{re.escape(wu)}$", "$options": "i"}})
    tid = _telegram_chat_id_from_user_doc(udoc)
    if tid is not None:
        i = int(tid)
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


def worker_kpi_summary(db: Database, job_id: str, worker_username: str) -> dict[str, Any] | None:
    job_id = (job_id or "").strip()
    worker_username = (worker_username or "").strip()
    if not job_id or not worker_username:
        return None

    job = db.jobs.find_one({"jobId": job_id}, {"jobName": 1, "month": 1, "status": 1})
    if not job:
        return None

    q = {"Job ID": job_id, "Current Worker": worker_username}
    rows = list(
        db.results.find(
            q,
            {"KPI": 1, "Record ID": 1, "QA1": 1, "QA2": 1, "Rework Count": 1},
        )
    )
    kpis = [_to_float(r.get("KPI")) for r in rows]
    n = len(kpis)
    avg = sum(kpis) / n if n else 0.0
    mn = min(kpis) if kpis else 0.0
    mx = max(kpis) if kpis else 0.0

    return {
        "jobId": job_id,
        "jobName": (job.get("jobName") or "").strip() or job_id,
        "month": (job.get("month") or "").strip(),
        "status": (job.get("status") or "").strip(),
        "worker": worker_username,
        "recordCount": n,
        "avgKpi": avg,
        "minKpi": mn,
        "maxKpi": mx,
    }


def format_kpi_message_html(summary: dict[str, Any], *, admin_url_hint: str | None = None) -> str:
    jid = html.escape(str(summary.get("jobId", "")))
    jname = html.escape(str(summary.get("jobName", "")))
    worker = html.escape(str(summary.get("worker", "")))
    month = html.escape(str(summary.get("month", "")))
    status = html.escape(str(summary.get("status", "")))
    n = int(summary.get("recordCount", 0))
    avg = float(summary.get("avgKpi", 0))
    mn = float(summary.get("minKpi", 0))
    mx = float(summary.get("maxKpi", 0))

    lines = [
        f"<b>KPI — gói hàng</b>",
        f"Tên: {jname}",
        f"Job ID: <code>{jid}</code>",
        f"Worker: <code>{worker}</code>",
    ]
    if month:
        lines.append(f"Tháng: {month}")
    if status:
        lines.append(f"Trạng thái gói: {status}")
    lines.append("")
    if n == 0:
        lines.append("Không có bản ghi với Current Worker của bạn trong gói này.")
    else:
        lines.append(f"Số bản ghi: {n}")
        lines.append(f"KPI trung bình: <b>{avg:.4f}</b>")
        lines.append(f"KPI min / max: {mn:.4f} / {mx:.4f}")
    if admin_url_hint:
        lines.append("")
        lines.append(f"Chi tiết web: {html.escape(admin_url_hint, quote=True)}")
    return "\n".join(lines)


def default_admin_base_url() -> str:
    return (os.environ.get("PUBLIC_ADMIN_BASE_URL") or "http://localhost:3000").rstrip("/")


def job_detail_path(job_id: str) -> str:
    return f"{default_admin_base_url()}/admin/kpi/{job_id}"


def notify_linked_workers_for_job(db: Database, token: str, job_id: str) -> dict[str, Any]:
    """
    Gửi tin nhắn KPI (theo từng worker đã liên kết Telegram) cho mọi worker có bản ghi trong job.
    """
    job_id = (job_id or "").strip()
    out: dict[str, Any] = {
        "jobId": job_id,
        "messagesAttempted": 0,
        "messagesOk": 0,
        "workersInJob": 0,
        "workersSkippedNoTelegram": 0,
        "workersSkippedNoRecords": 0,
        "errors": [],
    }
    if not job_id:
        out["errors"].append("job_id trống")
        return out

    workers = distinct_workers_in_job(db, job_id)
    out["workersInJob"] = len(workers)
    url_hint = job_detail_path(job_id)

    for worker in workers:
        summary = worker_kpi_summary(db, job_id, worker)
        if not summary:
            continue
        if summary["recordCount"] == 0:
            out["workersSkippedNoRecords"] += 1
            continue
        chats = chat_ids_for_worker(db, worker)
        if not chats:
            out["workersSkippedNoTelegram"] += 1
            continue
        text = format_kpi_message_html(summary, admin_url_hint=url_hint)
        for cid in chats:
            out["messagesAttempted"] += 1
            ok, err = send_telegram_message(token, cid, text)
            if ok:
                out["messagesOk"] += 1
            else:
                out["errors"].append({"chatId": cid, "worker": worker, "error": err[:500]})

    return out
