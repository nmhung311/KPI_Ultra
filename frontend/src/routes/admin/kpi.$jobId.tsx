import { useState, useMemo, useRef, useEffect } from "react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Layers, 
  Package, 
  Users, 
  FileText, 
  ChevronRight, 
  ChevronDown,
  X,
  Download,
  RefreshCw,
  Tag,
  ShieldCheck,
  TrendingUp,
  Eye,
  EyeOff,
  BarChart3
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { type JobPackage } from "@/lib/types";

export const Route = createFileRoute("/admin/kpi/$jobId")({
  head: () => ({ meta: [{ title: "Package Details" }] }),
  loader: async ({ params }) => {
    try {
      const isServer = typeof window === 'undefined';
      const API_BASE = isServer ? 'http://backend:5000' : 'http://localhost:5000';
      const res = await fetch(`${API_BASE}/api/jobs/${params.jobId}`);
      if (!res.ok) throw notFound();
      const job: JobPackage = await res.json();
      return { job };
    } catch (e) {
      console.error(e);
      throw notFound();
    }
  },
  component: PackageDetail,
});

function PackageDetail() {
  const { job } = Route.useLoaderData();
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "records" | "qa">("overview");
  const [selectedQA, setSelectedQA] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTypeRef = useRef<"record" | "kpi" | "qa1" | "qa2">("record");
  
  // Edit mode states
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editJobName, setEditJobName] = useState(job.jobName);
  const [editJobId, setEditJobId] = useState(job.jobId);
  const [editQa1JobId, setEditQa1JobId] = useState(job.qa1JobId || "");
  const [editQa2JobId, setEditQa2JobId] = useState(job.qa2JobId || "");
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const syncProgressRef = useRef(0);
  const [syncLogs, setSyncLogs] = useState<{kpi: string[], qa1: string[], qa2: string[]}>({kpi: [], qa1: [], qa2: []});
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [syncOptions, setSyncOptions] = useState({ kpi: true, qa1: true, qa2: true });
  const [showSyncPopup, setShowSyncPopup] = useState(false);
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [isTogglingHide, setIsTogglingHide] = useState(false);

  const toggleHiddenUser = async (username: string) => {
    try {
      setIsTogglingHide(true);
      const API_BASE = typeof window === 'undefined' ? 'http://backend:5000' : 'http://localhost:5000';
      const res = await fetch(`${API_BASE}/api/jobs/${job.jobId}/hide-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
      if (!res.ok) throw new Error("Thao tác thất bại");
      await router.invalidate();
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsTogglingHide(false);
    }
  };

  // Kiểm tra khi vào trang: nếu hệ thống đang đồng bộ job này thì hiển thị progress
  useEffect(() => {
    const checkActiveSync = async () => {
      try {
        const API_BASE = typeof window === 'undefined' ? 'http://backend:5000' : 'http://localhost:5000';
        const res = await fetch(`${API_BASE}/progress`);
        if (res.ok) {
          const data = await res.json();
          if (data.jobId === job.jobId && data.progress > 0) {
            setSyncProgress(data.progress);
            syncProgressRef.current = data.progress;
            setIsSyncing(true);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    checkActiveSync();
  }, [job.jobId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSyncing) {
      interval = setInterval(async () => {
        try {
          const API_BASE = typeof window === 'undefined' ? 'http://backend:5000' : 'http://localhost:5000';
          const pRes = await fetch(`${API_BASE}/progress`);
          if (pRes.ok) {
            const data = await pRes.json();
            const prog = data.progress;
            const syncJobId = data.jobId;
            
            // Nếu job đang sync không phải job hiện tại thì dừng polling
            if (syncJobId && syncJobId !== job.jobId) {
              clearInterval(interval);
              setIsSyncing(false);
              setSyncProgress(0);
              syncProgressRef.current = 0;
              return;
            }
            
            if (prog > 0) {
                setSyncProgress(prog);
                syncProgressRef.current = prog;
            }
            
            // Fetch logs
            try {
              const logsRes = await fetch(`${API_BASE}/api/jobs/${job.jobId}/sync_logs`);
              if (logsRes.ok) {
                const logsData = await logsRes.json();
                setSyncLogs(logsData);
              }
            } catch (err) {
              console.error("Lỗi fetch logs:", err);
            }
            
            if (prog === 100) {
              // Đồng bộ hoàn tất → clear trạng thái backend và refresh data
              setSyncProgress(100);
              clearInterval(interval);
              setTimeout(async () => {
                // Clear sync completion state trên backend
                try {
                  await fetch(`${API_BASE}/api/jobs/${job.jobId}/clear_sync`, { method: 'POST' });
                } catch (_) {}
                setIsSyncing(false);
                syncProgressRef.current = 0;
                await router.invalidate();
              }, 3000);
            } else if (prog === 0 && syncProgressRef.current > 0) {
                // Bot đã cleanup — kiểm tra sync_status để xác nhận hoàn thành
                try {
                  const statusRes = await fetch(`${API_BASE}/api/jobs/${job.jobId}/sync_status`);
                  if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    if (statusData.status === "done") {
                      // Sync đã hoàn thành nhưng bị miss 100% → xử lý như hoàn thành
                      setSyncProgress(100);
                      clearInterval(interval);
                      setTimeout(async () => {
                        try {
                          await fetch(`${API_BASE}/api/jobs/${job.jobId}/clear_sync`, { method: 'POST' });
                        } catch (_) {}
                        setIsSyncing(false);
                        syncProgressRef.current = 0;
                        await router.invalidate();
                      }, 2000);
                      return;
                    }
                  }
                } catch (_) {}
                
                // Nếu sync_status cũng không trả done → bot thực sự dừng bất thường
                clearInterval(interval);
                setSyncProgress(0);
                syncProgressRef.current = 0;
                setIsSyncing(false);
                router.invalidate();
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSyncing, router, job.jobId]);

  // Tự động cuộn xuống dưới cùng của panel log
  useEffect(() => {
    if (isSyncing) {
      // Vì có 3 panel, ta không dùng ref chung được, có thể tận dụng scrollIntoView hoặc để mỗi panel tự scroll
      const logContainers = document.querySelectorAll('.log-container');
      logContainers.forEach(container => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [syncLogs, isSyncing]);

  const handleSync = async (force = false) => {
    setShowSyncPopup(false);
    setIsSyncing(true);
    setSyncProgress(1);
    try {
      const API_BASE = typeof window === 'undefined' ? 'http://backend:5000' : 'http://localhost:5000';
      const url = `${API_BASE}/api/jobs/${job.jobId}/sync${force ? '?force=true' : ''}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syncOptions)
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.requires_confirmation) {
           const confirmStop = window.confirm(`Hệ thống đang đồng bộ gói hàng khác (${err.activeJobId || 'không rõ'}). Bạn có muốn dừng gói kia lại để đồng bộ gói hàng này không?`);
           if (confirmStop) {
               return handleSync(true);
           } else {
               setIsSyncing(false);
               setSyncProgress(0);
               return;
           }
        }
        throw new Error(err.error || "Lỗi đồng bộ");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message);
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  const handleSaveHeader = async () => {
    if (!editJobName.trim() || !editJobId.trim()) {
      alert("Tên và ID gói hàng không được trống!");
      return;
    }
    
    setIsSavingHeader(true);
    try {
      const API_BASE = typeof window === 'undefined' ? 'http://backend:5000' : 'http://localhost:5000';
      const res = await fetch(`${API_BASE}/api/jobs/${job.jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          jobId: editJobId, 
          jobName: editJobName,
          qa1JobId: editQa1JobId,
          qa2JobId: editQa2JobId
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Lỗi khi cập nhật gói hàng");
      }
      
      setIsEditingHeader(false);
      
      if (editJobId !== job.jobId) {
        router.navigate({ to: `/admin/kpi/${editJobId}` });
      } else {
        await router.invalidate();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsSavingHeader(false);
    }
  };

  const handleImportTypeClick = (type: "record" | "kpi" | "qa1" | "qa2") => {
    importTypeRef.current = type;
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const API_BASE = typeof window === 'undefined' ? 'http://backend:5000' : 'http://localhost:5000';
      const type = importTypeRef.current;
      
      let endpoint = `${API_BASE}/api/jobs/${job.jobId}/import-records`;
      if (type === 'kpi') endpoint = `${API_BASE}/api/jobs/${job.jobId}/import-kpi`;
      if (type === 'qa1') endpoint = `${API_BASE}/api/jobs/${job.jobId}/import-qa1`;
      if (type === 'qa2') endpoint = `${API_BASE}/api/jobs/${job.jobId}/import-qa2`;

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      
      const data = await res.json();
      alert(data.message);
      
      await router.invalidate();
    } catch (err: any) {
      console.error(err);
      alert(`Có lỗi xảy ra: ${err.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const qaList = useMemo(() => {
    const qaMap = new Map<string, { username: string, kpiQA1: number, kpiQA2: number, recordsQA1: any[], recordsQA2: any[], workersQA1: Set<string>, workersQA2: Set<string>, isHidden: boolean }>();

    job.records.forEach(rec => {
      // Collect QA1
      if (rec.qa1 && rec.qa1 !== "—" && rec.qa1.trim() !== "") {
        const isHidden = job.hiddenUsers?.includes(rec.qa1) || false;
        if (!qaMap.has(rec.qa1)) qaMap.set(rec.qa1, { username: rec.qa1, kpiQA1: 0, kpiQA2: 0, recordsQA1: [], recordsQA2: [], workersQA1: new Set(), workersQA2: new Set(), isHidden });
        const qaData = qaMap.get(rec.qa1)!;
        if (!isHidden) {
          qaData.recordsQA1.push(rec);
          qaData.kpiQA1 += rec.kpi;
          qaData.workersQA1.add(rec.worker);
        }
      }
      // Collect QA2
      if (rec.qa2 && rec.qa2 !== "—" && rec.qa2.trim() !== "") {
        const isHidden = job.hiddenUsers?.includes(rec.qa2) || false;
        if (!qaMap.has(rec.qa2)) qaMap.set(rec.qa2, { username: rec.qa2, kpiQA1: 0, kpiQA2: 0, recordsQA1: [], recordsQA2: [], workersQA1: new Set(), workersQA2: new Set(), isHidden });
        const qaData = qaMap.get(rec.qa2)!;
        if (!isHidden) {
          qaData.recordsQA2.push(rec);
          qaData.kpiQA2 += rec.kpi;
          qaData.workersQA2.add(rec.worker);
        }
      }
    });

    return Array.from(qaMap.values()).map(qa => ({
      username: qa.username,
      recordsCountQA1: qa.recordsQA1.length,
      recordsCountQA2: qa.recordsQA2.length,
      workersCountQA1: qa.workersQA1.size,
      workersCountQA2: qa.workersQA2.size,
      kpiQA1: Math.round(qa.kpiQA1),
      kpiQA2: Math.round(qa.kpiQA2),
      recordsQA1: qa.recordsQA1,
      recordsQA2: qa.recordsQA2,
      isHidden: qa.isHidden
    }));
  }, [job]);

  // Tổng quan: gộp tất cả user (label + QA) với KPI Label, KPI QA1 và KPI QA2 tách riêng
  const overviewList = useMemo(() => {
    const userMap = new Map<string, { username: string, role: string, kpiLabel: number, kpiQA1: number, kpiQA2: number, recordsLB: number, recordsQA1: number, recordsQA2: number, isHidden: boolean }>();

    // Tính KPI Label: tổng KPI của các record mà label worker làm
    job.records.forEach(rec => {
      if (rec.worker && rec.worker.trim() !== "") {
        const key = rec.worker;
        const isHidden = job.hiddenUsers?.includes(key) || false;
        if (!userMap.has(key)) userMap.set(key, { username: key, role: "Label", kpiLabel: 0, kpiQA1: 0, kpiQA2: 0, recordsLB: 0, recordsQA1: 0, recordsQA2: 0, isHidden });
        const u = userMap.get(key)!;
        if (!isHidden) {
          u.kpiLabel += rec.kpi;
          u.recordsLB += 1;
        }
      }
    });

    // Tính KPI QA: lấy từ qaList (đã được tính sẵn ở trên)
    qaList.forEach(qa => {
      const key = qa.username;
      if (!userMap.has(key)) userMap.set(key, { username: key, role: "QA", kpiLabel: 0, kpiQA1: 0, kpiQA2: 0, recordsLB: 0, recordsQA1: 0, recordsQA2: 0, isHidden: qa.isHidden });
      const u = userMap.get(key)!;
      if (!u.isHidden) {
        u.kpiQA1 = qa.kpiQA1;
        u.kpiQA2 = qa.kpiQA2;
        u.recordsQA1 = qa.recordsCountQA1;
        u.recordsQA2 = qa.recordsCountQA2;
      }
      if (u.role === "Label") u.role = "Label / QA";
      else if (u.role !== "Label / QA") u.role = "QA";
    });

    return Array.from(userMap.values()).sort((a, b) => (b.kpiLabel + b.kpiQA1 + b.kpiQA2) - (a.kpiLabel + a.kpiQA1 + a.kpiQA2));
  }, [job, qaList]);

  // Tính tổng KPI Label và KPI QA cho gói hàng này
  const jobTotals = useMemo(() => {
    let totalKpiLabel = 0;
    let totalKpiQA1 = 0;
    let totalKpiQA2 = 0;
    overviewList.forEach(u => {
      totalKpiLabel += u.kpiLabel;
      totalKpiQA1 += u.kpiQA1;
      totalKpiQA2 += u.kpiQA2;
    });
    return {
      totalRecords: job.records?.length || 0,
      totalKpiLabel,
      totalKpiQA1,
      totalKpiQA2,
      totalKpiQA: totalKpiQA1 + totalKpiQA2,
      totalUsers: overviewList.filter(u => !u.isHidden).length
    };
  }, [overviewList, job.records]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <Link
        to="/admin/kpi"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-8 flex flex-col items-start gap-6 md:flex-row md:items-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-primary-foreground shadow-lg shadow-accent/20">
          <Package className="h-8 w-8" />
        </div>
        <div>
          <div className="flex items-center gap-2 text-[12px] font-medium tracking-widest text-accent uppercase">
            <Layers className="h-4 w-4" /> {t("package_details")}
          </div>
          
          {isEditingHeader ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground w-20">Tên:</span>
                  <input 
                    type="text" 
                    value={editJobName}
                    onChange={(e) => setEditJobName(e.target.value)}
                    className="w-full max-w-[400px] rounded-md border border-border bg-background px-3 py-1.5 font-semibold tracking-tight outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                    placeholder="Tên dự án..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground w-20">ID:</span>
                  <input 
                    type="text" 
                    value={editJobId}
                    onChange={(e) => setEditJobId(e.target.value)}
                    className="w-[200px] rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                    placeholder="Mã gói hàng..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground w-20">Job ID QA1:</span>
                  <input 
                    type="text" 
                    value={editQa1JobId}
                    onChange={(e) => setEditQa1JobId(e.target.value)}
                    className="w-[200px] rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                    placeholder="Mã QA1..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground w-20">Job ID QA2:</span>
                  <input 
                    type="text" 
                    value={editQa2JobId}
                    onChange={(e) => setEditQa2JobId(e.target.value)}
                    className="w-[200px] rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                    placeholder="Mã QA2..."
                  />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button 
                    onClick={handleSaveHeader}
                    disabled={isSavingHeader}
                    className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-accent/90 disabled:opacity-50"
                  >
                    {isSavingHeader ? "Lưu..." : "Lưu thay đổi"}
                  </button>
                  <button 
                    onClick={() => setIsEditingHeader(false)}
                    disabled={isSavingHeader}
                    className="rounded-md border border-border bg-transparent px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div 
              onContextMenu={(e) => {
                e.preventDefault();
                setIsEditingHeader(true);
              }}
              className="cursor-context-menu"
              title="Click chuột phải để sửa"
            >
              <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl hover:text-accent transition-colors">
                {job.jobName}
              </h1>
              
              <div className="mt-2 flex flex-col items-start">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetails(!showDetails);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showDetails ? "Thu gọn chi tiết" : "Xem thêm chi tiết..."}
                  <ChevronDown className={`h-3 w-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showDetails && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden flex flex-col gap-1"
                    >
                      <p className="font-mono text-sm text-muted-foreground flex items-center flex-wrap gap-x-4 gap-y-1">
                        <span>Job ID: <span className="font-semibold text-foreground/80">{job.jobId}</span></span>
                        <span>— {job.records?.length || 0} {t("records")}</span>
                      </p>
                      <div className="font-mono text-[13px] text-muted-foreground flex flex-col gap-y-1 mt-1">
                        <span>Job ID QA1: <span className="font-semibold text-foreground/80">{job.qa1JobId || "Chưa có"}</span></span>
                        <span>Job ID QA2: <span className="font-semibold text-foreground/80">{job.qa2JobId || "Chưa có"}</span></span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tabs and Actions */}
      <div className="mt-12 flex items-center justify-between">
        <div className="flex rounded-full bg-muted/50 p-1 shadow-inner">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <BarChart3 className="h-4 w-4" /> Tổng quan
          </button>
          <button 
            onClick={() => setActiveTab('records')}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all ${activeTab === 'records' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <FileText className="h-4 w-4" /> {t("record_list")}
          </button>
          <button 
            onClick={() => setActiveTab('qa')}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all ${activeTab === 'qa' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Users className="h-4 w-4" /> {t("qa_list")}
          </button>
        </div>
        <div className="flex items-center gap-3 w-full max-w-sm justify-end ml-auto">
          {isSyncing ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex w-full items-center gap-3 rounded-full bg-blue-500/10 p-1.5 pl-4 border border-blue-500/20"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Đang đồng bộ dữ liệu...
                  </span>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                    {syncProgress}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-500/20">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${syncProgress}%` }}
                    transition={{ type: "spring", stiffness: 50, damping: 15 }}
                    className="h-full bg-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm">
                  <RefreshCw className={`h-4 w-4 ${syncProgress < 100 ? 'animate-spin' : ''}`} />
                </div>
                <button 
                  onClick={() => setIsSyncing(false)}
                  className="rounded-full p-1.5 text-blue-600 hover:bg-blue-500/20 transition-colors dark:text-blue-400"
                  title="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="relative">
                <button 
                  onClick={() => setShowSyncPopup(!showSyncPopup)}
                  disabled={isUploading}
                  className="group inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="h-4 w-4" />
                  Đồng bộ
                  <ChevronDown className={`h-4 w-4 opacity-70 transition-transform ${showSyncPopup ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showSyncPopup && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-3 bg-muted/30 border-b border-border text-sm font-semibold text-foreground">
                        Tùy chọn đồng bộ
                      </div>
                      <div className="p-2 flex flex-col">
                        <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                          <input type="checkbox" checked={syncOptions.kpi} onChange={e => setSyncOptions(s => ({...s, kpi: e.target.checked}))} className="rounded border-input text-blue-600 focus:ring-blue-500 h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="text-[13px] font-semibold">Cập nhật KPI chính</span>
                            <span className="text-[11px] text-muted-foreground">Luồng automation chính</span>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                          <input type="checkbox" checked={syncOptions.qa1} onChange={e => setSyncOptions(s => ({...s, qa1: e.target.checked}))} className="rounded border-input text-blue-600 focus:ring-blue-500 h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="text-[13px] font-semibold">Cập nhật QA1</span>
                            <span className="text-[11px] text-muted-foreground">{job.qa1JobId || "Chưa thiết lập"}</span>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                          <input type="checkbox" checked={syncOptions.qa2} onChange={e => setSyncOptions(s => ({...s, qa2: e.target.checked}))} className="rounded border-input text-blue-600 focus:ring-blue-500 h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="text-[13px] font-semibold">Cập nhật QA2</span>
                            <span className="text-[11px] text-muted-foreground">{job.qa2JobId || "Chưa thiết lập"}</span>
                          </div>
                        </label>
                      </div>
                      <div className="p-3 border-t border-border bg-muted/20">
                        <button
                          onClick={() => handleSync(false)}
                          disabled={!syncOptions.kpi && !syncOptions.qa1 && !syncOptions.qa2}
                          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                          Bắt đầu đồng bộ
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative group">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <button 
                  disabled={isUploading}
                  className={`group inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 hover:shadow-md shadow-sm dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <Download className={`h-4 w-4 ${isUploading ? 'animate-bounce' : ''}`} />
                  {isUploading ? t("importing") : "Import Dữ Liệu"}
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
                
                <div className="absolute right-0 top-full pt-2 hidden group-hover:block z-50">
                  <div className="flex w-44 flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
                    <button
                      onClick={() => handleImportTypeClick('record')}
                      className="px-4 py-2.5 text-left text-[13px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors font-medium border-b border-border/40"
                    >
                      Import Record
                    </button>
                    <button
                      onClick={() => handleImportTypeClick('kpi')}
                      className="px-4 py-2.5 text-left text-[13px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors font-medium border-b border-border/40"
                    >
                      Import KPI
                    </button>
                    <button
                      onClick={() => handleImportTypeClick('qa1')}
                      className="px-4 py-2.5 text-left text-[13px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors font-medium border-b border-border/40"
                    >
                      Import QA1
                    </button>
                    <button
                      onClick={() => handleImportTypeClick('qa2')}
                      className="px-4 py-2.5 text-left text-[13px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors font-medium"
                    >
                      Import QA2
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sync Logs Panels */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {/* KPI Logs */}
            <div className="flex flex-col rounded-xl overflow-hidden border border-border bg-black">
              <div className="bg-zinc-900 px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-emerald-400">KPI Sync (Luồng chính)</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <div className="log-container h-48 overflow-y-auto p-3 font-mono text-[11px] text-zinc-300 space-y-1">
                {syncLogs.kpi?.length === 0 ? (
                  <div className="text-zinc-600 italic">Đang chờ khởi chạy...</div>
                ) : (
                  syncLogs.kpi?.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))
                )}
              </div>
            </div>

            {/* QA1 Logs */}
            <div className="flex flex-col rounded-xl overflow-hidden border border-border bg-black">
              <div className="bg-zinc-900 px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-violet-400">QA1 Sync ({job.qa1JobId || "N/A"})</span>
                {job.qa1JobId && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                  </span>
                )}
              </div>
              <div className="log-container h-48 overflow-y-auto p-3 font-mono text-[11px] text-zinc-300 space-y-1">
                {!job.qa1JobId ? (
                  <div className="text-zinc-600 italic">Không có Job ID QA1</div>
                ) : syncLogs.qa1?.length === 0 ? (
                  <div className="text-zinc-600 italic">Đang chờ khởi chạy...</div>
                ) : (
                  syncLogs.qa1?.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))
                )}
              </div>
            </div>

            {/* QA2 Logs */}
            <div className="flex flex-col rounded-xl overflow-hidden border border-border bg-black">
              <div className="bg-zinc-900 px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-amber-400">QA2 Sync ({job.qa2JobId || "N/A"})</span>
                {job.qa2JobId && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                )}
              </div>
              <div className="log-container h-48 overflow-y-auto p-3 font-mono text-[11px] text-zinc-300 space-y-1">
                {!job.qa2JobId ? (
                  <div className="text-zinc-600 italic">Không có Job ID QA2</div>
                ) : syncLogs.qa2?.length === 0 ? (
                  <div className="text-zinc-600 italic">Đang chờ khởi chạy...</div>
                ) : (
                  syncLogs.qa2?.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4"
      >
        <div 
          onClick={() => setShowUserPopup(true)}
          className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400">
            <Users className="h-5 w-5" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{jobTotals.totalUsers}</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">Tổng số người làm</p>
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-blue-500/15 to-blue-500/5 opacity-20 blur-2xl" />
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400">
            <Tag className="h-5 w-5" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">{jobTotals.totalKpiLabel}</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">Tổng KPI Label</p>
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 opacity-20 blur-2xl" />
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">{jobTotals.totalKpiQA}</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">Tổng KPI QA</p>
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-amber-500/15 to-amber-500/5 opacity-20 blur-2xl" />
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-violet-600 dark:text-violet-400">{jobTotals.totalKpiLabel + jobTotals.totalKpiQA}</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">Tổng KPI</p>
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-violet-500/15 to-violet-500/5 opacity-20 blur-2xl" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-6 overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-lg"
      >
        <div className="overflow-x-auto p-6 md:p-8">
          <table className="w-full text-left text-sm">
            {activeTab === 'overview' ? (
              <>
                <thead className="border-b border-border bg-muted/40 text-[13px] font-medium text-muted-foreground">
                  <tr>
                    <th className="px-5 py-4 w-16 text-center">STT</th>
                    <th className="px-5 py-4">Username</th>
                    <th className="px-5 py-4 text-center">Vai trò</th>
                    <th className="px-5 py-4 text-center">Số records LB</th>
                    <th className="px-5 py-4 text-center">Số records QA1</th>
                    <th className="px-5 py-4 text-center">Số records QA2</th>
                    <th className="px-5 py-4 text-right">KPI Label</th>
                    <th className="px-5 py-4 text-right">KPI QA1</th>
                    <th className="px-5 py-4 text-right">KPI QA2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {overviewList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        Chưa có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    overviewList.map((u, idx) => (
                      <tr key={u.username} className="group transition-colors hover:bg-muted/30">
                        <td className="px-5 py-4 text-center font-mono text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-5 py-4 font-semibold text-accent">
                          <div className="flex items-center gap-2">
                            {u.username}
                            {u.isHidden && (
                              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-500">
                                Đã ẩn
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center font-medium text-foreground/80">
                          {u.role}
                        </td>
                        <td className="px-5 py-4 text-center font-medium text-foreground/90">
                          {u.recordsLB || "—"}
                        </td>
                        <td className="px-5 py-4 text-center font-medium text-foreground/90">
                          {u.recordsQA1 || "—"}
                        </td>
                        <td className="px-5 py-4 text-center font-medium text-foreground/90">
                          {u.recordsQA2 || "—"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-semibold tabular-nums ${u.isHidden ? 'text-muted-foreground line-through opacity-50' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {u.kpiLabel || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-semibold tabular-nums ${u.isHidden ? 'text-muted-foreground line-through opacity-50' : 'text-amber-600 dark:text-amber-400'}`}>
                            {u.kpiQA1 || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-semibold tabular-nums ${u.isHidden ? 'text-muted-foreground line-through opacity-50' : 'text-amber-600 dark:text-amber-400'}`}>
                            {u.kpiQA2 || "—"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            ) : activeTab === 'records' ? (
              <>
                <thead className="border-b border-border bg-muted/40 text-[13px] font-medium text-muted-foreground">
                  <tr>
                    <th className="px-5 py-4">Record ID</th>
                    <th className="px-5 py-4">{t("worker")}</th>
                    <th className="px-5 py-4 text-center">{t("rework")}</th>
                    <th className="px-5 py-4">Ngày hoàn thành</th>
                    <th className="px-5 py-4">QA1</th>
                    <th className="px-5 py-4">QA2</th>
                    <th className="px-5 py-4 text-right">{t("kpi")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {job.records.map((rec) => (
                    <tr key={rec.recordId} className="group transition-colors hover:bg-muted/30">
                      <td className="px-5 py-4">
                        <span className="font-mono font-medium text-foreground/90">{rec.recordId}</span>
                      </td>
                      <td className="px-5 py-4 font-medium">
                        {rec.worker}
                      </td>
                      <td className="px-5 py-4 text-center font-medium">
                        {rec.reworkCount}
                      </td>
                      <td className="px-5 py-4 text-foreground/80 text-xs">
                        {rec.completedAt ? new Date(rec.completedAt).toLocaleString('vi-VN') : "—"}
                      </td>
                      <td className="px-5 py-4 text-foreground/80">
                        {rec.qa1 || "—"}
                      </td>
                      <td className="px-5 py-4 text-foreground/80">
                        {rec.qa2 || "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-semibold tabular-nums text-foreground/90">
                          {rec.kpi}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <>
                <thead className="border-b border-border bg-muted/40 text-[13px] font-medium text-muted-foreground">
                  <tr>
                    <th className="px-5 py-4">{t("qa_username")}</th>
                    <th className="px-5 py-4 text-center">Records QA1</th>
                    <th className="px-5 py-4 text-center">KPI QA1</th>
                    <th className="px-5 py-4 text-center">Records QA2</th>
                    <th className="px-5 py-4 text-center">KPI QA2</th>
                    <th className="px-5 py-4 text-right">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {qaList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        {t("empty_qa")}
                      </td>
                    </tr>
                  ) : (
                    qaList.map((qa) => (
                      <tr 
                        key={qa.username} 
                        className="group cursor-pointer transition-colors hover:bg-muted/30"
                        onClick={() => setSelectedQA(qa)}
                      >
                        <td className="px-5 py-4 font-semibold text-accent">
                          {qa.username}
                        </td>
                        <td className="px-5 py-4 text-center font-medium text-foreground/80">
                          {qa.recordsCountQA1}
                        </td>
                        <td className="px-5 py-4 text-center font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                          {qa.kpiQA1}
                        </td>
                        <td className="px-5 py-4 text-center font-medium text-foreground/80">
                          {qa.recordsCountQA2}
                        </td>
                        <td className="px-5 py-4 text-center font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                          {qa.kpiQA2}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button className="inline-flex h-8 items-center justify-center rounded-full bg-accent/10 px-4 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-primary-foreground group-hover:bg-accent group-hover:text-primary-foreground">
                            {t("view_details")} <ChevronRight className="ml-1 h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            )}
          </table>
        </div>
      </motion.div>

      {/* QA Detail Popup */}
      <AnimatePresence>
        {selectedQA && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedQA(null)}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 p-4 md:p-6"
            >
              <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-2xl">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-border/50 bg-muted/10 p-6 md:p-8">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-accent uppercase">
                      <Users className="h-4 w-4" /> {t("qa_details_title")}
                    </div>
                        <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl text-accent">
                          {selectedQA.username}
                        </h2>
                        <p className="mt-1 font-mono text-sm text-muted-foreground">
                          {t("qa_details_desc", { records: selectedQA.recordsCountQA1 + selectedQA.recordsCountQA2, workers: Math.max(selectedQA.workersCountQA1, selectedQA.workersCountQA2) })}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedQA(null)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Modal Body / Table */}
                    <div className="overflow-y-auto p-6 md:p-8">
                      <div className="overflow-hidden rounded-2xl border border-border bg-background">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b border-border bg-muted/40 text-[13px] font-medium text-muted-foreground">
                            <tr>
                              <th className="px-5 py-4">{t("worker")}</th>
                              <th className="px-5 py-4">Record ID</th>
                              <th className="px-5 py-4 text-right">{t("kpi")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {selectedQA.recordsQA1.map((rec: any, idx: number) => (
                              <tr key={`qa1-${rec.recordId}-${idx}`} className="transition-colors hover:bg-muted/30">
                                <td className="px-5 py-4 font-medium text-foreground/90">
                                  {rec.worker}
                                </td>
                                <td className="px-5 py-4 font-mono text-muted-foreground">
                                  {rec.recordId} <span className="text-xs text-violet-500">(QA1)</span>
                                </td>
                                <td className="px-5 py-4 text-right font-semibold tabular-nums text-foreground/90">
                                  {rec.kpi}
                                </td>
                              </tr>
                            ))}
                            {selectedQA.recordsQA2.map((rec: any, idx: number) => (
                              <tr key={`qa2-${rec.recordId}-${idx}`} className="transition-colors hover:bg-muted/30">
                                <td className="px-5 py-4 font-medium text-foreground/90">
                                  {rec.worker}
                                </td>
                                <td className="px-5 py-4 font-mono text-muted-foreground">
                                  {rec.recordId} <span className="text-xs text-amber-500">(QA2)</span>
                                </td>
                                <td className="px-5 py-4 text-right font-semibold tabular-nums text-foreground/90">
                                  {rec.kpi}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Total Users Popup */}
      <AnimatePresence>
        {showUserPopup && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUserPopup(false)}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 p-4 md:p-6"
            >
              <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-border/50 bg-muted/10 p-6 md:p-8">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-blue-600 uppercase">
                      <Users className="h-4 w-4" /> Danh sách nhân sự
                    </div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl text-foreground">
                      Tổng số người làm: {jobTotals.totalUsers}
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowUserPopup(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="overflow-y-auto p-6 md:p-8">
                  <div className="overflow-hidden rounded-2xl border border-border bg-background">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-muted/40 text-[13px] font-medium text-muted-foreground">
                        <tr>
                          <th className="px-5 py-4 w-16 text-center">STT</th>
                          <th className="px-5 py-4">Username</th>
                          <th className="px-5 py-4 text-center">Job Type</th>
                          <th className="px-5 py-4 text-center">Trạng thái</th>
                          <th className="px-5 py-4 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {overviewList.map((u, idx) => (
                          <tr key={u.username} className={`transition-colors ${u.isHidden ? 'bg-muted/10 opacity-75' : 'hover:bg-muted/30'}`}>
                            <td className="px-5 py-4 text-center font-mono text-muted-foreground">
                              {idx + 1}
                            </td>
                            <td className={`px-5 py-4 font-semibold ${u.isHidden ? 'text-muted-foreground' : 'text-foreground/90'}`}>
                              {u.username}
                            </td>
                            <td className="px-5 py-4 text-center font-medium text-foreground/80">
                              {u.role}
                            </td>
                            <td className="px-5 py-4 text-center">
                              {u.isHidden ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                                  <EyeOff className="h-3 w-3" /> Đã ẩn
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  <Eye className="h-3 w-3" /> Hiển thị
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                disabled={isTogglingHide}
                                onClick={() => toggleHiddenUser(u.username)}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                                  u.isHidden 
                                    ? 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400'
                                    : 'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400'
                                }`}
                              >
                                {u.isHidden ? 'Hiện KPI' : 'Ẩn KPI'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedQA && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedQA(null)}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 p-4 md:p-6"
            >
              <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-2xl">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-border/50 bg-muted/10 p-6 md:p-8">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-accent uppercase">
                      <Users className="h-4 w-4" /> {t("qa_details_title")}
                    </div>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl text-accent">
                      {selectedQA.username}
                    </h2>
                    <p className="mt-1 font-mono text-sm text-muted-foreground">
                      {t("qa_details_desc", { records: selectedQA.recordsCount, workers: selectedQA.workersCount })}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedQA(null)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Modal Body / Table */}
                <div className="overflow-y-auto p-6 md:p-8">
                  <div className="overflow-hidden rounded-2xl border border-border bg-background">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-muted/40 text-[13px] font-medium text-muted-foreground">
                        <tr>
                          <th className="px-5 py-4">{t("worker")}</th>
                          <th className="px-5 py-4">Record ID</th>
                          <th className="px-5 py-4 text-right">{t("kpi")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {selectedQA.records.map((rec: any, idx: number) => (
                          <tr key={`${rec.recordId}-${idx}`} className="transition-colors hover:bg-muted/30">
                            <td className="px-5 py-4 font-medium text-foreground/90">
                              {rec.worker}
                            </td>
                            <td className="px-5 py-4 font-mono text-muted-foreground">
                              {rec.recordId}
                            </td>
                            <td className="px-5 py-4 text-right font-semibold tabular-nums text-foreground/90">
                              {rec.kpi}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
