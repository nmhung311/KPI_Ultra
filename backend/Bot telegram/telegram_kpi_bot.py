"""
Bot Telegram: liên kết worker, xem KPI theo Job ID, admin gửi thông báo hàng loạt.

Biến môi trường:
  TELEGRAM_BOT_TOKEN     (bắt buộc) — token từ @BotFather
  MONGO_URI              — giống backend
  TELEGRAM_ADMIN_IDS     — chat id admin, cách nhau bởi dấu phẩy (cho /notify_job)
  PUBLIC_ADMIN_BASE_URL  — URL frontend (mặc định http://localhost:3000) để gắn link chi tiết gói hàng

Chạy từ thư mục backend: python "Bot telegram/telegram_kpi_bot.py"
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from telegram_kpi_core import (
    default_admin_base_url,
    ensure_telegram_indexes,
    format_kpi_message_html,
    get_db,
    get_linked_username,
    is_admin_chat,
    job_detail_path,
    link_worker,
    notify_linked_workers_for_job,
    unlink_worker,
    worker_kpi_summary,
)

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("telegram_kpi_bot")


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    text = (
        "<b>KPI Bot</b>\n\n"
        "• /link <code>worker_appen</code> — liên kết tài khoản Appen (Current Worker) với Telegram này\n"
        "• /kpi <code>JOB_ID</code> — xem KPI của bạn trong gói (vd: G1889-F3748-L16156)\n"
        "• /status — xem đang liên kết worker nào\n"
        "• /unlink — hủy liên kết\n\n"
        "<i>Admin:</i> /notify_job <code>JOB_ID</code> — gửi KPI tới mọi worker trong gói đã liên kết Telegram."
    )
    await update.message.reply_html(text)


async def cmd_link(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat:
        return
    args = context.args or []
    if len(args) != 1:
        await update.message.reply_html("Dùng: <code>/link ten_worker_appen</code>")
        return
    db = get_db()
    ok, msg = link_worker(db, update.effective_chat.id, args[0])
    await update.message.reply_html(msg, disable_web_page_preview=True)


async def cmd_unlink(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat:
        return
    db = get_db()
    ok, msg = unlink_worker(db, update.effective_chat.id)
    await update.message.reply_html(msg)


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat:
        return
    db = get_db()
    u = get_linked_username(db, update.effective_chat.id)
    if not u:
        await update.message.reply_html("Chưa liên kết. Dùng <code>/link ten_worker</code>.")
        return
    await update.message.reply_html(f"Đang liên kết worker: <code>{u}</code>")


async def cmd_kpi(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat:
        return
    args = context.args or []
    if len(args) != 1:
        await update.message.reply_html("Dùng: <code>/kpi JOB_ID</code>\nVí dụ: <code>/kpi G1889-F3748-L16156</code>")
        return
    job_id = args[0].strip()
    db = get_db()
    worker = get_linked_username(db, update.effective_chat.id)
    if not worker:
        await update.message.reply_html("Bạn chưa liên kết worker. Dùng <code>/link ten_worker</code> trước.")
        return
    summary = worker_kpi_summary(db, job_id, worker)
    if summary is None:
        await update.message.reply_html("Không tìm thấy gói hàng với Job ID này.")
        return
    url = job_detail_path(job_id)
    text = format_kpi_message_html(summary, admin_url_hint=url)
    await update.message.reply_html(text, disable_web_page_preview=False)


async def cmd_notify_job(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat:
        return
    chat_id = update.effective_chat.id
    if not is_admin_chat(chat_id):
        await update.message.reply_html("Bạn không có quyền dùng lệnh này.")
        return
    args = context.args or []
    if len(args) != 1:
        await update.message.reply_html("Dùng: <code>/notify_job JOB_ID</code>")
        return
    job_id = args[0].strip()
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        await update.message.reply_html("Thiếu TELEGRAM_BOT_TOKEN trên server.")
        return
    db = get_db()
    await update.message.reply_html(f"Đang gửi thông báo KPI cho gói <code>{job_id}</code>…")
    result = await asyncio.to_thread(notify_linked_workers_for_job, db, token, job_id)
    lines = [
        "<b>Kết quả gửi</b>",
        f"Job ID: <code>{job_id}</code>",
        f"Worker trong gói: {result.get('workersInJob', 0)}",
        f"Đã gửi thành công: {result.get('messagesOk', 0)} / {result.get('messagesAttempted', 0)}",
        f"Bỏ qua (chưa liên kết TG): {result.get('workersSkippedNoTelegram', 0)}",
        f"Bỏ qua (0 bản ghi): {result.get('workersSkippedNoRecords', 0)}",
    ]
    errs = result.get("errors") or []
    if errs:
        lines.append("")
        lines.append("<b>Lỗi một phần:</b>")
        for e in errs[:8]:
            lines.append(f"• chat <code>{e.get('chatId')}</code>: {(e.get('error') or '')[:200]}")
        if len(errs) > 8:
            lines.append(f"… và {len(errs) - 8} lỗi khác")
    await update.message.reply_html("\n".join(lines))


async def cmd_jobs(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Gợi ý nhanh: liệt kê vài job gần nhất (theo jobId sort)."""
    if not update.message:
        return
    db = get_db()
    cur = db.jobs.find({}, {"jobId": 1, "jobName": 1, "_id": 0}).sort("jobId", -1).limit(15)
    rows = list(cur)
    if not rows:
        await update.message.reply_html("Chưa có gói hàng trong database.")
        return
    lines = ["<b>Một số Job ID</b> (dùng với /kpi):\n"]
    for j in rows:
        jid = j.get("jobId", "")
        jn = (j.get("jobName") or "")[:40]
        lines.append(f"• <code>{jid}</code> — {jn}")
    await update.message.reply_html("\n".join(lines))


def main() -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        logger.error("Thiếu TELEGRAM_BOT_TOKEN")
        sys.exit(1)
    ensure_telegram_indexes(get_db())
    base = default_admin_base_url()
    logger.info("PUBLIC_ADMIN_BASE_URL=%s", base)

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_start))
    app.add_handler(CommandHandler("link", cmd_link))
    app.add_handler(CommandHandler("unlink", cmd_unlink))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("kpi", cmd_kpi))
    app.add_handler(CommandHandler("notify_job", cmd_notify_job))
    app.add_handler(CommandHandler("jobs", cmd_jobs))

    logger.info("Bot đang chạy polling…")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
