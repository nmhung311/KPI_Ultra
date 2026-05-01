import { useEffect, useState, useMemo, useRef } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Package,
  Layers,
  FileText,
  FolderTree,
  ArrowRight,
  Download,
  DatabaseBackup,
  Filter,
  Calendar,
  CheckCircle2,
  Clock,
  PenTool,
  BarChart3,
  Search,
  ArchiveRestore,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { type JobPackage, type JobStatus } from "@/lib/types";

export const Route = createFileRoute("/admin/kpi/")({
  head: () => ({ meta: [{ title: "KPI Packages Dashboard" }] }),
  loader: async () => {
    try {
      const isServer = typeof window === 'undefined';
      const API_BASE = isServer ? 'http://backend:5000' : 'http://localhost:5000';
      const res = await fetch(`${API_BASE}/api/jobs`);
      if (!res.ok) throw new Error("Failed to fetch");
      const jobs: JobPackage[] = await res.json();
      return { jobs };
    } catch (e) {
      console.error(e);
      return { jobs: [] };
    }
  },
  component: AdminKpiList,
});

function AdminKpiList() {
  const navigate = useNavigate();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { jobs } = Route.useLoaderData();
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const backupMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isBackupModalOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (backupMenuRef.current && !backupMenuRef.current.contains(event.target as Node)) {
        setIsBackupModalOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isBackupModalOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const API_BASE = typeof window === 'undefined' ? 'http://backend:5000' : 'http://localhost:5000';
      const res = await fetch(`${API_BASE}/api/jobs/import`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      
      await router.invalidate();
    } catch (err: any) {
      console.error(err);
      alert(`Có lỗi xảy ra: ${err.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleFullBackup = async () => {
    setIsBackingUp(true);
    const API_BASE = typeof window === "undefined" ? "http://backend:5000" : "http://localhost:5000";
    try {
      const res = await fetch(`${API_BASE}/api/kpi/backup`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      let filename = "kpi-backup.json";
      const m = cd?.match(/filename="([^"]+)"/);
      if (m?.[1]) filename = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error(err);
      alert(`${t("backup_failed")} ${err instanceof Error ? err.message : ""}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(t("restore_confirm"))) {
      e.target.value = "";
      return;
    }

    setIsRestoring(true);
    const API_BASE =
      typeof window === "undefined" ? "http://backend:5000" : "http://localhost:5000";
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/kpi/restore`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error || "Restore failed");
      }
      await router.invalidate();
      const msg = (body as { message?: string }).message || "OK";
      alert(msg);
    } catch (err: unknown) {
      console.error(err);
      alert(`${t("restore_failed")} ${err instanceof Error ? err.message : ""}`);
    } finally {
      setIsRestoring(false);
      e.target.value = "";
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchMonth = selectedMonth === "all" || job.month === selectedMonth;
      const matchStatus = selectedStatus === "all" || job.status === selectedStatus;
      const matchSearch = !searchQuery.trim() || 
        job.jobId.toLowerCase().includes(searchQuery.toLowerCase()) || 
        job.jobName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchMonth && matchStatus && matchSearch;
    });
  }, [jobs, selectedMonth, selectedStatus, searchQuery]);

  const availableMonths = useMemo(() => {
    const months = new Set(jobs.map(job => job.month));
    return Array.from(months).sort();
  }, [jobs]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[12px] font-medium tracking-widest text-accent uppercase backdrop-blur-md">
          <FolderTree className="h-3.5 w-3.5" /> <span>{t("manage_package")}</span>
        </div>
        <h1 className="mt-4 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
          {t("kpi_dashboard")}
        </h1>
      </motion.div>

      {/* Package List Grid */}
      <section className="mt-12 relative z-10">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm transition-all hover:shadow-md">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm Job ID, tên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent py-0.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/60 w-32 md:w-40"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center gap-1.5 pl-3 pr-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent py-1.5 pr-2 text-sm font-medium text-foreground outline-none cursor-pointer"
                >
                  <option value="all">{t("filter_month")}</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{t("month")} {m}</option>
                  ))}
                </select>
              </div>
              <div className="h-4 w-px bg-border"></div>
              <div className="flex items-center gap-1.5 pl-2 pr-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-transparent py-1.5 pr-2 text-sm font-medium text-foreground outline-none cursor-pointer"
                >
                  <option value="all">{t("filter_status")}</option>
                  <option value="Đang gán nhãn">{t("status_labeling")}</option>
                  <option value="Đang chờ duyệt">{t("status_pending")}</option>
                  <option value="Đã được duyệt">{t("status_approved")}</option>
                </select>
              </div>
            </div>

            {/* Stats Button */}
            <button
              onClick={() => navigate({ to: "/admin/kpi/stats" })}
              className="group inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-md shadow-sm"
            >
              <BarChart3 className="h-4 w-4" />
              Thống kê
            </button>

            <div className="relative" ref={backupMenuRef}>
              <button
                type="button"
                onClick={() => setIsBackupModalOpen((prev) => !prev)}
                disabled={isBackingUp || isRestoring}
                className={`group inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-muted hover:shadow-md ${isBackingUp || isRestoring ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                <DatabaseBackup className={`h-4 w-4 ${isBackingUp || isRestoring ? "animate-pulse" : ""}`} />
                {isBackingUp ? t("backing_up") : isRestoring ? t("restoring") : "Backup"}
              </button>

              {isBackupModalOpen ? (
                <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-border bg-card p-4 shadow-2xl">
                  <h3 className="text-sm font-semibold tracking-tight">Quản lý backup KPI</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Chọn thao tác bạn muốn thực hiện.</p>
                  <div className="mt-3 grid gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await handleFullBackup();
                        setIsBackupModalOpen(false);
                      }}
                      disabled={isBackingUp || isRestoring}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-muted ${isBackingUp || isRestoring ? "opacity-70 cursor-not-allowed" : ""}`}
                    >
                      <DatabaseBackup className={`h-4 w-4 ${isBackingUp ? "animate-pulse" : ""}`} />
                      {isBackingUp ? t("backing_up") : t("backup_all_kpi")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsBackupModalOpen(false);
                        restoreFileInputRef.current?.click();
                      }}
                      disabled={isRestoring || isBackingUp}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-900 transition-all hover:bg-amber-500/20 dark:text-amber-100 ${isRestoring || isBackingUp ? "opacity-70 cursor-not-allowed" : ""}`}
                    >
                      <ArchiveRestore className={`h-4 w-4 ${isRestoring ? "animate-pulse" : ""}`} />
                      {isRestoring ? t("restoring") : t("restore_kpi_backup")}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBackupModalOpen(false)}
                    className="mt-2 w-full rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Đóng
                  </button>
                </div>
              ) : null}
            </div>

            {/* Import Button */}
            <div>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isRestoring}
                className={`group inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 hover:shadow-md shadow-sm dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 ${isUploading || isRestoring ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <Download className={`h-4 w-4 ${isUploading ? 'animate-bounce' : ''}`} />
                {isUploading ? t("importing") : t("import_package")}
              </button>
            </div>
          </div>
        </div>

        <input
          type="file"
          accept=".json,application/json"
          className="hidden"
          ref={restoreFileInputRef}
          onChange={handleRestoreFile}
        />

        {filteredJobs.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-8 flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-border bg-card/50 py-24 text-center"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
              <Package className="h-10 w-10 opacity-50" />
            </div>
            <h3 className="mt-6 text-xl font-semibold tracking-tight">{t("no_packages")}</h3>
            <p className="mt-2 text-muted-foreground">{t("no_packages_desc")}</p>
          </motion.div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job, index) => (
              <motion.div 
                key={job.jobId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                onClick={() => navigate({ to: "/admin/kpi/$jobId", params: { jobId: job.jobId } })}
                className="group relative cursor-pointer overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-xl hover:shadow-accent/5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-primary-foreground">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground opacity-0 transition-all group-hover:bg-accent/10 group-hover:text-accent group-hover:opacity-100">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <Layers className="h-3.5 w-3.5" /> {job.jobId}
                    </div>
                    <JobStatusBadge status={job.status} t={t} />
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-xl font-semibold leading-snug tracking-tight">{job.jobName}</h3>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border/50 pt-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{job.records?.length || 0}</span>
                    <span className="text-sm text-muted-foreground">{t("records")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {t("month")} {job.month}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function JobStatusBadge({ status, t }: { status: JobStatus, t: any }) {
  if (status === "Đang gán nhãn") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-blue-600 dark:text-blue-400">
        <PenTool className="h-3 w-3" /> {t("status_labeling")}
      </span>
    );
  }
  if (status === "Đang chờ duyệt") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-600 dark:text-amber-400">
        <Clock className="h-3 w-3" /> {t("status_pending")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-3 w-3" /> {t("status_approved")}
    </span>
  );
}
