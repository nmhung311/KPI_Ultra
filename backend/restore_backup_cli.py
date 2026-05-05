#!/usr/bin/env python3
"""Khôi phục KPI từ file JSON (cùng format /api/kpi/backup). Xem kpi_restore_core.RESTORE_BACKUP_CLI_HELP."""
import sys

from kpi_restore_core import run_restore_backup_cli

if __name__ == "__main__":
    raise SystemExit(run_restore_backup_cli(sys.argv))
