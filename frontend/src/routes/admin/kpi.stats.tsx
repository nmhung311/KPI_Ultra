import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Users,
  Tag,
  ShieldCheck,
  TrendingUp,
  FileText,
  Download,
  Search,
  ChevronUp,
  ChevronDown,
  Layers,
  Package,
  X,
  GitCompareArrows,
} from "lucide-react";

interface UserStat {
  username: string;
  role: string;
  kpiLabel: number;
  kpiQA1: number;
  kpiQA1Customer?: number;
  kpiQA2: number;
  kpiQA: number;
  recordsLabel: number;
  recordsQA1: number;
  recordsQA2: number;
  recordsQA: number;
  jobCountLabel: number;
  jobCountQA1: number;
  jobCountQA2: number;
}

interface StatsData {
  month: string;
  users: UserStat[];
  totals: {
    totalKpiLabel: number;
    totalKpiQA1: number;
    totalKpiQA1Customer?: number;
    totalKpiQA2: number;
    totalKpiQA: number;
    totalKpiCustomer?: number;
    totalRecords: number;
    totalRecordsLabel: number;
    totalRecordsQA1: number;
    totalRecordsQA2: number;
    totalRecordsQA: number;
    totalUsers: number;
    totalJobs: number;
  };
  availableMonths: string[];
}

export const Route = createFileRoute("/admin/kpi/stats")({
  head: () => ({ meta: [{ title: "Thống kê KPI nhân sự" }] }),
  loader: async () => {
    try {
      const isServer = typeof window === "undefined";
      const API_BASE = isServer ? "http://backend:5000" : "http://localhost:5000";
      const res = await fetch(`${API_BASE}/api/kpi/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      const stats: StatsData = await res.json();
      return { stats };
    } catch (e) {
      console.error(e);
      return {
        stats: {
          month: "all",
          users: [],
          totals: { totalKpiLabel: 0, totalKpiQA1: 0, totalKpiQA1Customer: 0, totalKpiQA2: 0, totalKpiQA: 0, totalKpiCustomer: 0, totalRecords: 0, totalRecordsLabel: 0, totalRecordsQA1: 0, totalRecordsQA2: 0, totalRecordsQA: 0, totalUsers: 0, totalJobs: 0 },
          availableMonths: [],
        } as StatsData,
      };
    }
  },
  component: KpiStatsPage,
});

type SortKey = "username" | "kpiLabel" | "kpiQA" | "recordsLabel" | "recordsQA" | "total";
type SortDir = "asc" | "desc";

function KpiStatsPage() {
  const { stats: initialStats } = Route.useLoaderData();
  const [stats, setStats] = useState<StatsData>(initialStats);
  const [selectedMonth, setSelectedMonth] = useState<string>(initialStats.month === "all" ? "all" : initialStats.month);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [qaModalType, setQaModalType] = useState<"qa1" | "qa1_customer" | "qa2" | null>(null);

  // Filter users who have QA records, sorted by kpi descending
  const qaUsers1 = useMemo(() => {
    return stats.users
      .filter((u) => u.recordsQA1 > 0)
      .sort((a, b) => b.kpiQA1 - a.kpiQA1);
  }, [stats.users]);

  const qaUsers1Customer = useMemo(() => {
    return stats.users
      .filter((u) => u.recordsQA1 > 0)
      .sort((a, b) => (b.kpiQA1Customer || 0) - (a.kpiQA1Customer || 0));
  }, [stats.users]);

  const qaUsers2 = useMemo(() => {
    return stats.users
      .filter((u) => u.recordsQA2 > 0)
      .sort((a, b) => b.kpiQA2 - a.kpiQA2);
  }, [stats.users]);

  const fetchStats = async (month: string) => {
    setIsLoading(true);
    try {
      const API_BASE = typeof window === "undefined" ? "http://backend:5000" : "http://localhost:5000";
      const url = month === "all" ? `${API_BASE}/api/kpi/stats` : `${API_BASE}/api/kpi/stats?month=${encodeURIComponent(month)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data: StatsData = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    fetchStats(month);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let users = stats.users;

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      users = users.filter((u) => u.username.toLowerCase().includes(q));
    }

    // Sort
    const sorted = [...users].sort((a, b) => {
      let valA: number | string;
      let valB: number | string;

      switch (sortKey) {
        case "username":
          valA = a.username.toLowerCase();
          valB = b.username.toLowerCase();
          return sortDir === "asc" ? (valA < valB ? -1 : 1) : valA > valB ? -1 : 1;
        case "kpiLabel":
          valA = a.kpiLabel;
          valB = b.kpiLabel;
          break;
        case "kpiQA":
          valA = a.kpiQA;
          valB = b.kpiQA;
          break;
        case "recordsLabel":
          valA = a.recordsLabel;
          valB = b.recordsLabel;
          break;
        case "recordsQA":
          valA = a.recordsQA;
          valB = b.recordsQA;
          break;
        case "total":
        default:
          valA = a.kpiLabel + a.kpiQA;
          valB = b.kpiLabel + b.kpiQA;
          break;
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      return 0;
    });

    return sorted;
  }, [stats.users, searchQuery, sortKey, sortDir]);

  const handleExportCSV = () => {
    const headers = ["STT", "Username", "Vai trò", "Records Label", "Records QA", "KPI Label", "KPI QA", "Tổng KPI"];
    const rows = filteredAndSorted.map((u, i) => [
      i + 1,
      u.username,
      u.role,
      u.recordsLabel,
      u.recordsQA,
      u.kpiLabel,
      u.kpiQA,
      u.kpiLabel + u.kpiQA,
    ]);

    // Add totals row
    rows.push([
      "",
      "TỔNG",
      "",
      stats.totals.totalRecordsLabel,
      stats.totals.totalRecordsQA,
      stats.totals.totalKpiLabel,
      stats.totals.totalKpiQA,
      stats.totals.totalKpiLabel + stats.totals.totalKpiQA,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kpi_stats_${selectedMonth === "all" ? "all" : selectedMonth.replace("/", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-accent" /> : <ChevronDown className="h-3 w-3 text-accent" />;
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:py-16">
      <Link
        to="/admin/kpi"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại danh sách gói hàng
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mt-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[12px] font-medium tracking-widest text-accent uppercase backdrop-blur-md">
          <BarChart3 className="h-3.5 w-3.5" /> <span>Thống kê KPI</span>
        </div>
        <h1 className="mt-4 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
          Thống kê nhân sự.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Tổng hợp KPI Label và KPI QA của toàn bộ nhân sự theo tháng, gộp từ tất cả các gói hàng.
        </p>
        
        {stats.totals.totalKpiCustomer !== undefined && (
          <div className={`mt-4 inline-flex items-center gap-2 rounded-xl border p-3 ${stats.totals.totalKpiLabel === stats.totals.totalKpiCustomer ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'}`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background shadow-sm">
              <GitCompareArrows className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Đối soát hệ thống & Khách hàng</span>
              <span className="text-xs opacity-90">
                {stats.totals.totalKpiLabel === stats.totals.totalKpiCustomer 
                  ? "Khớp hoàn toàn (Không có chênh lệch)" 
                  : `Lệch ${Math.abs(stats.totals.totalKpiLabel - stats.totals.totalKpiCustomer).toLocaleString()} KPI`}
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Month Selector + Actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-1.5 pl-3 pr-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-transparent py-1.5 pr-2 text-sm font-medium text-foreground outline-none cursor-pointer"
              >
                <option value="all">Tất cả tháng</option>
                {(stats.availableMonths || initialStats.availableMonths).map((m) => (
                  <option key={m} value={m}>
                    Tháng {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm transition-all hover:shadow-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent py-0.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/60 w-36"
            />
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          className="group inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 hover:shadow-md shadow-sm dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <Download className="h-4 w-4" /> Xuất CSV
        </button>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6"
      >
        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          label="Nhân sự"
          value={stats.totals.totalUsers}
          color="blue"
          delay={0}
        />
        <SummaryCard
          icon={<Package className="h-5 w-5" />}
          label="Gói hàng"
          value={stats.totals.totalJobs}
          color="violet"
          delay={0.05}
        />
        <SummaryCard
          icon={<FileText className="h-5 w-5" />}
          label="Tổng Records"
          value={stats.totals.totalRecords}
          color="rose"
          delay={0.1}
        />
        <SummaryCard
          icon={<Tag className="h-5 w-5" />}
          label="Tổng KPI Label"
          value={stats.totals.totalKpiLabel}
          color="emerald"
          delay={0.15}
        />
        <SummaryCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Tổng KPI QA1"
          value={stats.totals.totalKpiQA1}
          color="amber"
          delay={0.2}
          onClick={() => setQaModalType("qa1")}
          clickable
        />
        <SummaryCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Tổng KPI QA1 (KH)"
          value={stats.totals.totalKpiQA1Customer || 0}
          color="amber"
          delay={0.22}
          onClick={() => setQaModalType("qa1_customer")}
          clickable
        />
        <SummaryCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Tổng KPI QA2"
          value={stats.totals.totalKpiQA2}
          color="amber"
          delay={0.24}
          onClick={() => setQaModalType("qa2")}
          clickable
        />
        <SummaryCard
          icon={<Package className="h-5 w-5" />}
          label="Tổng KPI Khách hàng"
          value={stats.totals.totalKpiCustomer || 0}
          color="cyan"
          delay={0.26}
        />
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-8 overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-lg"
      >
        {isLoading && (
          <div className="flex items-center justify-center py-4 border-b border-border/40">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Đang tải dữ liệu...
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-[13px] font-medium text-muted-foreground">
              <tr>
                <th className="px-5 py-4 w-16 text-center">STT</th>
                <th className="px-5 py-4 cursor-pointer select-none" onClick={() => toggleSort("username")}>
                  <div className="flex items-center gap-1.5">
                    Username <SortIcon col="username" />
                  </div>
                </th>
                <th className="px-5 py-4 text-center">Vai trò</th>
                <th className="px-5 py-4 text-center cursor-pointer select-none" onClick={() => toggleSort("recordsLabel")}>
                  <div className="flex items-center justify-center gap-1.5">
                    Records LB <SortIcon col="recordsLabel" />
                  </div>
                </th>
                <th className="px-5 py-4 text-center cursor-pointer select-none" onClick={() => toggleSort("recordsQA")}>
                  <div className="flex items-center justify-center gap-1.5">
                    Records QA <SortIcon col="recordsQA" />
                  </div>
                </th>
                <th className="px-5 py-4 text-right cursor-pointer select-none" onClick={() => toggleSort("kpiLabel")}>
                  <div className="flex items-center justify-end gap-1.5">
                    KPI Label <SortIcon col="kpiLabel" />
                  </div>
                </th>
                <th className="px-5 py-4 text-right cursor-pointer select-none" onClick={() => toggleSort("kpiQA")}>
                  <div className="flex items-center justify-end gap-1.5">
                    KPI QA <SortIcon col="kpiQA" />
                  </div>
                </th>
                <th className="px-5 py-4 text-right cursor-pointer select-none" onClick={() => toggleSort("total")}>
                  <div className="flex items-center justify-end gap-1.5">
                    Tổng KPI <SortIcon col="total" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <BarChart3 className="h-7 w-7 opacity-50" />
                      </div>
                      <span className="text-base font-medium">Chưa có dữ liệu thống kê</span>
                      <span className="text-sm text-muted-foreground/70">
                        Hãy chọn tháng hoặc import dữ liệu gói hàng trước.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {filteredAndSorted.map((u, idx) => (
                    <motion.tr
                      key={u.username}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.02 }}
                      className="group transition-colors hover:bg-muted/30"
                    >
                      <td className="px-5 py-4 text-center font-mono text-muted-foreground text-xs">{idx + 1}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 text-accent text-xs font-bold uppercase">
                            {u.username.charAt(0)}
                          </div>
                          <span className="font-semibold text-foreground">{u.username}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-5 py-4 text-center font-medium tabular-nums text-foreground/80">
                        {u.recordsLabel || "—"}
                      </td>
                      <td className="px-5 py-4 text-center font-medium tabular-nums text-foreground/80">
                        {u.recordsQA || "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {u.kpiLabel || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                          {u.kpiQA || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-sm font-bold tabular-nums text-accent">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {(u.kpiLabel + u.kpiQA) || "—"}
                        </span>
                      </td>
                    </motion.tr>
                  ))}

                  {/* Totals Row */}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-5 py-4 text-center"></td>
                    <td className="px-5 py-4 text-foreground">TỔNG CỘNG</td>
                    <td className="px-5 py-4 text-center text-muted-foreground text-xs">{stats.totals.totalUsers} người</td>
                    <td className="px-5 py-4 text-center tabular-nums text-foreground">{stats.totals.totalRecordsLabel}</td>
                    <td className="px-5 py-4 text-center tabular-nums text-foreground">{stats.totals.totalRecordsQA}</td>

                    <td className="px-5 py-4 text-right">
                      <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
                        {stats.totals.totalKpiLabel}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="tabular-nums text-amber-600 dark:text-amber-400 font-bold">
                        {stats.totals.totalKpiQA}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-sm font-bold tabular-nums text-accent">
                        {stats.totals.totalKpiLabel + stats.totals.totalKpiQA}
                      </span>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* QA Detail Modal */}
      <AnimatePresence>
        {qaModalType === "qa1" && (
          <QADetailModal
            type="QA1"
            users={qaUsers1}
            totalKpiQA={stats.totals.totalKpiQA1}
            totalRecordsQA={stats.totals.totalRecordsQA1}
            month={selectedMonth}
            onClose={() => setQaModalType(null)}
          />
        )}
        {qaModalType === "qa1_customer" && (
          <QADetailModal
            type="QA1 Khách hàng"
            users={qaUsers1Customer}
            totalKpiQA={stats.totals.totalKpiQA1Customer || 0}
            totalRecordsQA={stats.totals.totalRecordsQA1}
            month={selectedMonth}
            onClose={() => setQaModalType(null)}
          />
        )}
        {qaModalType === "qa2" && (
          <QADetailModal
            type="QA2"
            users={qaUsers2}
            totalKpiQA={stats.totals.totalKpiQA2}
            totalRecordsQA={stats.totals.totalRecordsQA2}
            month={selectedMonth}
            onClose={() => setQaModalType(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

/* ────── Components ────── */

function SummaryCard({
  icon,
  label,
  value,
  color,
  delay,
  onClick,
  clickable,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  delay: number;
  onClick?: () => void;
  clickable?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }
    const duration = 800;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  const colorMap: Record<string, string> = {
    blue: "from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400",
    cyan: "from-cyan-500/15 to-cyan-500/5 text-cyan-600 dark:text-cyan-400",
  };

  const bgColor = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${clickable ? "cursor-pointer ring-0 hover:ring-2 hover:ring-amber-500/40" : ""}`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${bgColor}`}>{icon}</div>
      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{displayValue.toLocaleString()}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {clickable && (
          <span className="text-[10px] font-medium text-amber-500 dark:text-amber-400 opacity-0 transition-opacity group-hover:opacity-100" style={{ opacity: 0.7 }}>Chi tiết →</span>
        )}
      </div>
      {/* Subtle glow */}
      <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br ${bgColor} opacity-20 blur-2xl`} />
    </motion.div>
  );
}

/* ────── QA Detail Modal ────── */

function QADetailModal({
  type,
  users,
  totalKpiQA,
  totalRecordsQA,
  month,
  onClose,
}: {
  type: string;
  users: UserStat[];
  totalKpiQA: number;
  totalRecordsQA: number;
  month: string;
  onClose: () => void;
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Chi tiết KPI {type}</h2>
                <p className="text-xs text-muted-foreground">
                  {month === "all" ? "Tất cả tháng" : `Tháng ${month}`} · {users.length} {type} · {totalRecordsQA} records
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-border bg-muted/40 text-[13px] font-medium text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 w-14 text-center">STT</th>
                  <th className="px-5 py-3">Username</th>
                  <th className="px-5 py-3 text-center">Số gói {type}</th>
                  <th className="px-5 py-3 text-center">Records {type}</th>
                  <th className="px-5 py-3 text-right">KPI {type}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.map((u, idx) => {
                  const jobCount = type.includes("QA1") ? u.jobCountQA1 : u.jobCountQA2;
                  const records = type.includes("QA1") ? u.recordsQA1 : u.recordsQA2;
                  const kpi = type === "QA1 Khách hàng" ? u.kpiQA1Customer : (type === "QA1" ? u.kpiQA1 : u.kpiQA2);
                  
                  return (
                  <motion.tr
                    key={u.username}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.03 }}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-5 py-3 text-center font-mono text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase">
                          {u.username.charAt(0)}
                        </div>
                        <span className="font-semibold text-foreground">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center font-medium tabular-nums text-foreground/80">{jobCount}</td>
                    <td className="px-5 py-3 text-center font-medium tabular-nums text-foreground/80">{records}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
                        {kpi}
                      </span>
                    </td>
                  </motion.tr>
                )})}

                {/* Total row */}
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-5 py-3 text-center"></td>
                  <td className="px-5 py-3 text-foreground">TỔNG CỘNG</td>
                  <td className="px-5 py-3 text-center text-muted-foreground text-xs">{users.length} QA</td>
                  <td className="px-5 py-3 text-center tabular-nums text-foreground">{totalRecordsQA}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {totalKpiQA}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "Label / QA") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-violet-600 dark:text-violet-400">
        <Tag className="h-3 w-3" />
        <ShieldCheck className="h-3 w-3" />
        Label / QA
      </span>
    );
  }
  if (role === "QA") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-600 dark:text-amber-400">
        <ShieldCheck className="h-3 w-3" /> QA
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-600 dark:text-emerald-400">
      <Tag className="h-3 w-3" /> Label
    </span>
  );
}
