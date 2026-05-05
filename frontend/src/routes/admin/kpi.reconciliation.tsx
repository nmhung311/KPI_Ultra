import { useState, useRef, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  GitCompareArrows,
  Upload,
  Package,
  Search,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BarChart2,
  X,
  Check,
  Trash2,
} from "lucide-react";
import { apiBase } from "@/lib/apiBase";

interface ReconciliationRow {
  recordId: string;
  username: string;
  kpiSystem: number;
  kpiCustomer: number;
  diffPercent: number;
  status: "good" | "ok" | "acceptable" | "abnormal";
}

interface ReconciliationJob {
  jobId: string;
  jobName: string;
  kpiLabel: number;
  kpiQa: number;
  rows: ReconciliationRow[];
}

export const Route = createFileRoute("/admin/kpi/reconciliation")({
  head: () => ({ meta: [{ title: "Đối soát KPI" }] }),
  loader: async () => {
    try {
      const res = await fetch(`${apiBase()}/api/kpi/reconciliation`);
      if (!res.ok) throw new Error("Failed");
      return { data: (await res.json()) as ReconciliationJob[] };
    } catch {
      return { data: [] as ReconciliationJob[] };
    }
  },
  component: ReconciliationPage,
});

const STATUS_CONFIG = {
  good: { label: "Tốt", icon: CheckCircle2, bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20" },
  ok: { label: "Chấp nhận", icon: ShieldCheck, bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
  acceptable: { label: "Tạm chấp nhận", icon: AlertCircle, bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
  abnormal: { label: "Bất thường", icon: AlertTriangle, bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/20" },
};

function ReconciliationPage() {
  const { data: initialData } = Route.useLoaderData();
  const [data, setData] = useState<ReconciliationJob[]>(initialData);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set(initialData.map((j) => j.jobId)));
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const totalSystemKpi = useMemo(() => data.reduce((acc, j) => acc + (j.kpiLabel || 0), 0), [data]);
  const totalCustomerKpi = useMemo(() => data.reduce((acc, j) => acc + j.rows.reduce((sum, r) => sum + (r.kpiCustomer || 0), 0), 0), [data]);
  
  const diffKpi = Math.abs(totalSystemKpi - totalCustomerKpi);
  const diffPercent = totalCustomerKpi > 0 ? (diffKpi / totalCustomerKpi) * 100 : (totalSystemKpi > 0 ? 100 : 0);
  const isMatch = diffPercent <= 2; // Khớp nếu độ lệch <= 2%

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${apiBase()}/api/kpi/reconciliation`);
      if (res.ok) setData(await res.json());
    } catch {}
    setIsRefreshing(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${apiBase()}/api/kpi/reconciliation/import`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setImportError(json.error || "Upload failed");
      } else {
        showToast("✅ " + json.message);
        await refresh();
      }
    } catch (err: any) {
      setImportError(`Lỗi kết nối server: ${err.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xoá toàn bộ dữ liệu KPI Khách hàng đã import không? Hành động này không thể hoàn tác.")) {
      return;
    }
    
    setIsResetting(true);
    try {
      const res = await fetch(`${apiBase()}/api/kpi/reconciliation/reset`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Reset failed");
      showToast(json.message);
      await refresh();
    } catch (err: any) {
      showToast(`Lỗi: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const toggleJob = (jobId: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      next.has(jobId) ? next.delete(jobId) : next.add(jobId);
      return next;
    });
  };

  const q = searchQuery.toLowerCase().trim();
  const filtered = data
    .map((job) => ({
      ...job,
      rows: q ? job.rows.filter((r) => r.username.toLowerCase().includes(q)) : job.rows,
    }))
    .filter((job) => job.rows.length > 0);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:py-16">
      <Link to="/admin/kpi" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Quay lại danh sách gói hàng
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mt-8">
        <h1 className="mt-4 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
          Đối soát KPI
        </h1>
      </motion.div>

      {/* Toolbar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mt-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm transition-all hover:shadow-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Tìm username..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent py-0.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/60 w-44" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowStats(true)} className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-all hover:bg-muted hover:shadow-md shadow-sm">
            <BarChart2 className="h-4 w-4 text-accent" /> Thống kê KPI
          </button>
          <button onClick={refresh} disabled={isRefreshing} className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-all hover:bg-muted hover:shadow-md shadow-sm">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} /> Làm mới
          </button>
          <button onClick={handleReset} disabled={isResetting || isUploading} className="group inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-100 hover:shadow-md shadow-sm dark:border-red-900/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20">
            <Trash2 className={`h-4 w-4 ${isResetting ? "animate-bounce" : ""}`} /> 
            {isResetting ? "Đang xoá..." : "Reset KPI khách hàng"}
          </button>
          <div>
            <input type="file" accept=".csv" className="hidden" ref={fileRef} onChange={handleImport} />
            <button onClick={() => fileRef.current?.click()} disabled={isUploading || isResetting} className={`group inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 hover:shadow-md shadow-sm dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 ${isUploading || isResetting ? "opacity-70 cursor-not-allowed" : ""}`}>
              <Upload className={`h-4 w-4 ${isUploading ? "animate-bounce" : ""}`} />
              {isUploading ? "Đang import..." : "Import KPI khách hàng"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Job Tables */}
      {filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-10 flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-border bg-card/50 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
            <GitCompareArrows className="h-10 w-10 opacity-50" />
          </div>
          <h3 className="mt-6 text-xl font-semibold tracking-tight">Chưa có dữ liệu đối soát</h3>
          <p className="mt-2 text-muted-foreground">Import KPI khách hàng để bắt đầu đối soát.</p>
        </motion.div>
      ) : (
        <div className="mt-8 space-y-6">
          {filtered.map((job, ji) => (
            <motion.div key={job.jobId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: ji * 0.08 }} className="overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-lg">
              {/* Job Header */}
              <button onClick={() => toggleJob(job.jobId)} className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 text-accent">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">{job.jobName}</h3>
                    <p className="text-xs text-muted-foreground">Job ID: {job.jobId} · {job.rows.length} người</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusSummary rows={job.rows} />
                  {expandedJobs.has(job.jobId) ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>
              </button>

              {/* Table */}
              <AnimatePresence>
                {expandedJobs.has(job.jobId) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                    <div className="overflow-x-auto border-t border-border/40">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-border bg-muted/40 text-[13px] font-medium text-muted-foreground">
                          <tr>
                            <th className="px-5 py-4 w-14 text-center">STT</th>
                            <th className="px-5 py-4">Username</th>
                            <th className="px-5 py-4 text-center">Record ID</th>
                            <th className="px-5 py-4 text-right">KPI Hệ thống</th>
                            <th className="px-5 py-4 text-right">KPI Khách hàng</th>
                            <th className="px-5 py-4 text-right">Chênh lệch (%)</th>
                            <th className="px-5 py-4 text-center">Đánh giá</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {job.rows.map((r, idx) => {
                            const cfg = STATUS_CONFIG[r.status];
                            const Icon = cfg.icon;
                            return (
                              <motion.tr key={r.recordId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: idx * 0.02 }} className="transition-colors hover:bg-muted/30">
                                <td className="px-5 py-4 text-center font-mono text-xs text-muted-foreground">{idx + 1}</td>
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 text-accent text-xs font-bold uppercase">{r.username.charAt(0)}</div>
                                    <span className="font-semibold text-foreground">{r.username}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-4 text-center font-medium tabular-nums text-foreground/80">{r.recordId}</td>
                                <td className="px-5 py-4 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{r.kpiSystem}</td>
                                <td className="px-5 py-4 text-right font-semibold tabular-nums text-blue-600 dark:text-blue-400">{r.kpiCustomer || "—"}</td>
                                <td className="px-5 py-4 text-right">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums ${cfg.bg} ${cfg.text}`}>
                                    {r.diffPercent}%
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <span className={`inline-flex items-center gap-1 rounded-full ${cfg.bg} border ${cfg.border} px-2.5 py-1 text-[11px] font-semibold tracking-wide ${cfg.text}`}>
                                    <Icon className="h-3 w-3" /> {cfg.label}
                                  </span>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className="fixed bottom-6 right-6 z-50 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-medium shadow-xl">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Modal */}
      <AnimatePresence>
        {showStats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowStats(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-2xl sm:p-8">
              <button onClick={() => setShowStats(false)} className="absolute right-6 top-6 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <BarChart2 className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Thống kê KPI tổng</h2>
                  <p className="text-sm text-muted-foreground">So sánh KPI giữa hệ thống và đối tác</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
                  <span className="font-medium text-muted-foreground">Tổng KPI Hệ thống (Label)</span>
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {Math.round(totalSystemKpi).toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
                  <span className="font-medium text-muted-foreground">Tổng KPI Khách hàng</span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                    {Math.round(totalCustomerKpi).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 ${isMatch ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                {isMatch ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-6 w-6 shrink-0 text-red-500" />
                )}
                <div>
                  <h3 className={`font-semibold ${isMatch ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                    {isMatch ? 'Độ lệch trong mức an toàn (<=2%)' : `Độ lệch bất thường (${diffPercent.toFixed(2)}%)`}
                  </h3>
                  <p className={`mt-1 text-sm ${isMatch ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-red-600/80 dark:text-red-400/80'}`}>
                    {isMatch 
                      ? 'Tổng số liệu giữa hệ thống đếm và khách hàng đếm khá khớp nhau.' 
                      : `Chênh lệch ${Math.round(diffKpi).toLocaleString()} KPI. Vui lòng kiểm tra lại chất lượng hoặc đàm phán với khách hàng.`}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Error Modal */}
      <AnimatePresence>
        {importError && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-0">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setImportError(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-red-500/30 bg-card p-6 shadow-2xl sm:p-8">
              <button onClick={() => setImportError(null)} className="absolute right-6 top-6 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-red-600 dark:text-red-400">Import thất bại</h2>
                  <p className="text-sm text-muted-foreground">Dữ liệu trong file không khớp với hệ thống</p>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm font-medium text-red-800 dark:text-red-200 whitespace-pre-wrap leading-relaxed font-mono">
                  {importError}
                </div>
              </div>
              
              <div className="mt-8 flex justify-end">
                <button onClick={() => setImportError(null)} className="rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors">
                  Đã hiểu & Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

function StatusSummary({ rows }: { rows: ReconciliationRow[] }) {
  const counts = { good: 0, ok: 0, acceptable: 0, abnormal: 0 };
  rows.forEach((r) => counts[r.status]++);
  return (
    <div className="hidden items-center gap-2 md:flex">
      {(["abnormal", "acceptable", "ok", "good"] as const).map((s) => {
        if (!counts[s]) return null;
        const c = STATUS_CONFIG[s];
        return (
          <span key={s} className={`inline-flex items-center gap-1 rounded-full ${c.bg} px-2 py-0.5 text-[11px] font-semibold tabular-nums ${c.text}`}>
            {counts[s]}
          </span>
        );
      })}
    </div>
  );
}
