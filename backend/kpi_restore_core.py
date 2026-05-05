"""Restore/verify backup KPI (JSON /api/kpi/backup). Flask: restore_kpi_payload, verify_*. CLI: run_restore_backup_cli."""
from __future__ import annotations

import os
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from bson import json_util
from pymongo import MongoClient, UpdateOne
from pymongo.errors import DocumentTooLarge, PyMongoError

RESTORE_BACKUP_CLI_HELP = """python3 restore_backup_cli.py <backup.json>
MONGO_URI (mặc định mongodb://127.0.0.1:27017/kpi_db), RESTORE_JOBS_PER_WAVE, MONGO_IMPORT_BATCH."""


def strip_mongo_id_deep(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: strip_mongo_id_deep(v) for k, v in obj.items() if k != "_id"}
    if isinstance(obj, list):
        return [strip_mongo_id_deep(x) for x in obj]
    return obj


def _chunk_list(seq: list, size: int):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def job_document_for_db(job: dict) -> dict:
    """Job lưu DB: bỏ records nhúng (nguồn chân lý là collection results)."""
    jd = strip_mongo_id_deep(dict(job))
    jd.pop("records", None)
    return jd


def validate_backup_consistency(jobs_list: list, results_list: list) -> None:
    job_ids = {j.get("jobId") for j in jobs_list if isinstance(j, dict) and j.get("jobId")}
    for idx, r in enumerate(results_list):
        if not isinstance(r, dict):
            raise ValueError(f"Phần tử results[{idx}] không phải object")
        jid = r.get("Job ID")
        if jid not in job_ids:
            raise ValueError(
                f"Record tại chỉ số {idx} có Job ID không có trong danh sách gói hàng backup: {jid!r}"
            )


def partition_backup_by_job_waves(
    jobs_list: list, results_list: list, jobs_per_wave: int
) -> list[dict[str, Any]]:
    """
    Chia backup thành các đợt (wave): mỗi đợt gồm vài gói hàng và toàn bộ results thuộc các gói đó.
    jobs_per_wave: số gói hàng tối đa mỗi wave (1–50).
    """
    validate_backup_consistency(jobs_list, results_list)
    jpw = max(1, min(50, int(jobs_per_wave)))
    by_job: dict[str, list] = defaultdict(list)
    for r in results_list:
        if isinstance(r, dict):
            jid = r.get("Job ID")
            if jid is not None:
                by_job[str(jid)].append(r)
    waves: list[dict[str, Any]] = []
    for i in range(0, len(jobs_list), jpw):
        chunk_jobs = jobs_list[i : i + jpw]
        ids: list[str] = []
        for j in chunk_jobs:
            if isinstance(j, dict) and j.get("jobId"):
                ids.append(str(j["jobId"]))
        chunk_results: list = []
        for jid in ids:
            chunk_results.extend(by_job.get(jid, []))
        waves.append(
            {
                "jobIds": ids,
                "jobs": chunk_jobs,
                "results": chunk_results,
                "resultCount": len(chunk_results),
            }
        )
    return waves


def bulk_upsert_job_wave(db, jobs_chunk: list, results_chunk: list) -> dict[str, int]:
    """Upsert một wave: jobs + results (bulk theo lô)."""
    batch = max(100, min(3000, int(os.getenv("MONGO_IMPORT_BATCH", "2500"))))
    job_ops: list = []
    for j in jobs_chunk:
        if not isinstance(j, dict):
            continue
        jd = job_document_for_db(j)
        jid = jd.get("jobId")
        if not jid:
            continue
        job_ops.append(UpdateOne({"jobId": jid}, {"$set": jd}, upsert=True))
    for chunk in _chunk_list(job_ops, batch):
        if chunk:
            db.jobs.bulk_write(chunk, ordered=False)

    res_ops: list = []
    for r in results_chunk:
        if not isinstance(r, dict):
            continue
        rd = strip_mongo_id_deep(dict(r))
        jid = rd.get("Job ID")
        rid = rd.get("Record ID")
        if jid is None or rid is None:
            continue
        res_ops.append(
            UpdateOne({"Job ID": jid, "Record ID": rid}, {"$set": rd}, upsert=True)
        )
    for chunk in _chunk_list(res_ops, batch):
        if chunk:
            db.results.bulk_write(chunk, ordered=False)

    return {"jobsUpserted": len(job_ops), "resultsUpserted": len(res_ops)}


def extract_jobs_results(payload: dict) -> tuple[list, list]:
    if not isinstance(payload, dict):
        raise ValueError("Backup không phải object JSON gốc")
    cols = payload.get("collections")
    if isinstance(cols, dict):
        jobs_list = cols.get("jobs")
        results_list = cols.get("results")
    else:
        jobs_list = payload.get("jobs")
        results_list = payload.get("results")
    if not isinstance(jobs_list, list) or not isinstance(results_list, list):
        raise ValueError(
            "File backup không hợp lệ — cần collections.jobs và collections.results là mảng"
        )
    return jobs_list, results_list


def restore_kpi_payload(db, payload: dict) -> dict:
    """Xóa jobs+results, ghi lại theo wave (RESTORE_JOBS_PER_WAVE) + bulk (MONGO_IMPORT_BATCH)."""
    jobs_list, results_list = extract_jobs_results(payload)
    jpw = max(1, min(50, int(os.getenv("RESTORE_JOBS_PER_WAVE", "5"))))
    waves = partition_backup_by_job_waves(jobs_list, results_list, jpw)

    deleted_results = db.results.delete_many({}).deleted_count
    deleted_jobs = db.jobs.delete_many({}).deleted_count
    inserted_jobs = 0
    inserted_results = 0
    for w in waves:
        counts = bulk_upsert_job_wave(db, w["jobs"], w["results"])
        inserted_jobs += counts["jobsUpserted"]
        inserted_results += counts["resultsUpserted"]

    return {
        "previousDeleted": {"jobs": deleted_jobs, "results": deleted_results},
        "inserted": {"jobs": inserted_jobs, "results": inserted_results},
    }


def _scalar_match_file_db(file_val: Any, db_val: Any) -> bool:
    if file_val == db_val:
        return True
    if file_val is None and db_val in (None, "", 0):
        return True
    if db_val is None and file_val in (None, "", 0):
        return True
    try:
        a = float(str(file_val).strip().replace(",", ".")) if file_val not in (None, "") else 0.0
        b = float(str(db_val).strip().replace(",", ".")) if db_val not in (None, "") else 0.0
        return a == b
    except (TypeError, ValueError):
        return str(file_val) == str(db_val)


def verify_restored_data_matches_payload(
    db, payload: dict, *, max_issues: int = 50
) -> dict[str, Any]:
    """So khớp DB với payload; ok nếu không có issue (tối đa max_issues dòng)."""
    jobs_list, results_list = extract_jobs_results(payload)
    issues: list[str] = []

    nj_db = db.jobs.count_documents({})
    nr_db = db.results.count_documents({})
    checks = {
        "jobCountFile": len(jobs_list),
        "jobCountDb": nj_db,
        "resultCountFile": len(results_list),
        "resultCountDb": nr_db,
    }
    if nj_db != len(jobs_list):
        issues.append(f"Tổng jobs: DB={nj_db}, file={len(jobs_list)}")
    if nr_db != len(results_list):
        issues.append(f"Tổng results: DB={nr_db}, file={len(results_list)}")

    for j in jobs_list:
        if not isinstance(j, dict) or not j.get("jobId"):
            continue
        jid = j["jobId"]
        doc = db.jobs.find_one({"jobId": jid}, {"_id": 0})
        if not doc:
            issues.append(f"Thiếu job trong DB: {jid}")
            if len(issues) >= max_issues:
                return _verify_pack(checks, issues, max_issues)
            continue
        for field in ("jobName", "status", "month"):
            if field not in j:
                continue
            if str(j.get(field, "")).strip() != str(doc.get(field, "")).strip():
                issues.append(
                    f"Job {jid} — {field}: file={j.get(field)!r} DB={doc.get(field)!r}"
                )
                if len(issues) >= max_issues:
                    return _verify_pack(checks, issues, max_issues)

    file_pairs: list[tuple[str, str]] = []
    for idx, r in enumerate(results_list):
        if not isinstance(r, dict):
            issues.append(f"results[{idx}] không phải object")
            if len(issues) >= max_issues:
                return _verify_pack(checks, issues, max_issues)
            continue
        jid, rid = r.get("Job ID"), r.get("Record ID")
        if jid is None or rid is None:
            issues.append(f"results[{idx}] thiếu Job ID hoặc Record ID")
            if len(issues) >= max_issues:
                return _verify_pack(checks, issues, max_issues)
            continue
        file_pairs.append((str(jid), str(rid)))

    dup = [p for p, c in Counter(file_pairs).items() if c > 1]
    if dup:
        issues.append(f"Có {len(dup)} cặp (Job ID, Record ID) trùng trong file (ví dụ: {dup[:3]})")

    compare_fields = (
        "Current Worker",
        "KPI",
        "QA1",
        "QA2",
        "Rework Count",
        "Completed At",
        "kpiCustomer",
        "Customer Username",
    )
    for idx, r in enumerate(results_list):
        if not isinstance(r, dict):
            continue
        jid, rid = r.get("Job ID"), r.get("Record ID")
        if jid is None or rid is None:
            continue
        db_r = db.results.find_one({"Job ID": jid, "Record ID": rid}, {"_id": 0})
        if not db_r:
            issues.append(f"Thiếu record DB: Job ID={jid!r} Record ID={rid!r}")
            if len(issues) >= max_issues:
                return _verify_pack(checks, issues, max_issues)
        else:
            for field in compare_fields:
                if field not in r and field not in db_r:
                    continue
                fv, dv = r.get(field), db_r.get(field)
                if field in ("KPI", "kpiCustomer", "Rework Count"):
                    if not _scalar_match_file_db(fv, dv):
                        issues.append(
                            f"{jid}/{rid} — {field}: file={fv!r} DB={dv!r}"
                        )
                else:
                    if fv != dv and str(fv).strip() != str(dv).strip():
                        issues.append(
                            f"{jid}/{rid} — {field}: file={fv!r} DB={dv!r}"
                        )
                if len(issues) >= max_issues:
                    return _verify_pack(checks, issues, max_issues)

    return _verify_pack(checks, issues, max_issues)


def _verify_pack(checks: dict, issues: list, max_issues: int) -> dict[str, Any]:
    total_issues = len(issues)
    return {
        "ok": total_issues == 0,
        "checks": checks,
        "issueCount": total_issues,
        "issues": issues[:max_issues],
        "issuesTruncated": total_issues > max_issues,
        "message": "Dữ liệu DB khớp file backup."
        if total_issues == 0
        else f"Phát hiện {total_issues} lệch (hiển thị tối đa {max_issues} dòng đầu).",
    }


def load_backup_payload(path: str | Path) -> dict:
    """Đọc file JSON backup từ đĩa và parse (BSON extended JSON)."""
    p = Path(path)
    raw = p.read_bytes()
    payload = json_util.loads(raw.decode("utf-8-sig"))
    if not isinstance(payload, dict):
        raise ValueError("File backup không hợp lệ (thiếu cấu trúc object gốc)")
    return payload


def run_restore_backup_cli(argv: list[str] | None = None) -> int:
    """CLI: restore kpi_db + verify. Exit 0/1/2/3."""
    args = argv if argv is not None else sys.argv
    if len(args) < 2:
        print(RESTORE_BACKUP_CLI_HELP.strip())
        return 2
    path = Path(args[1])
    if not path.is_file():
        print("Không tìm thấy file:", path)
        return 2

    uri = os.environ.get("MONGO_URI", "mongodb://127.0.0.1:27017/kpi_db")
    print("MONGO_URI:", uri.split("@")[-1] if "@" in uri else uri)
    print("File:", path.resolve(), "size:", path.stat().st_size, "bytes")

    try:
        payload = load_backup_payload(path)
    except (UnicodeDecodeError, ValueError, OSError) as e:
        print("Lỗi đọc/parse JSON:", e)
        return 1

    client = MongoClient(uri)
    db = client.kpi_db

    try:
        stats = restore_kpi_payload(db, payload)
    except ValueError as e:
        print("Dữ liệu không hợp lệ:", e)
        return 1
    except DocumentTooLarge as e:
        print("Document quá lớn:", e)
        return 1
    except PyMongoError as e:
        print("Lỗi MongoDB:", e)
        return 1

    print("Hoàn tất restore:", stats)
    try:
        v = verify_restored_data_matches_payload(db, payload)
    except Exception as e:  # noqa: BLE001
        print("Cảnh báo: không kiểm tra được DB vs file:", e)
        return 0
    print("Kiểm tra khớp file vs DB (ok):", v.get("ok"), v.get("message"), "checks:", v.get("checks"))
    if not v.get("ok") and v.get("issues"):
        for line in v["issues"][:50]:
            print("  -", line)
        if v.get("issuesTruncated"):
            print("  ... (truncated)")
    return 0 if v.get("ok") else 3
