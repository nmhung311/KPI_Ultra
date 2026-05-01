import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  BookOpen,
  Plus,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { ATTEMPTS, EXAMS, USERS, getExamStats } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Quản trị — Lumen" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const totalAttempts = ATTEMPTS.length;
  const avg = Math.round(ATTEMPTS.reduce((s, a) => s + a.score, 0) / Math.max(1, totalAttempts));
  const teachers = USERS.filter((u) => u.role === "teacher").length;
  const students = USERS.filter((u) => u.role === "student").length;
  const topExams = [...EXAMS]
    .map((e) => ({ exam: e, stats: getExamStats(e.id) }))
    .sort((a, b) => b.stats.total - a.stats.total)
    .slice(0, 5);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="text-[12px] font-medium tracking-widest text-accent uppercase">
            <Shield className="mr-1 inline h-3 w-3" /> Bảng điều khiển quản trị
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            Tổng quan hệ thống.
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Theo dõi hoạt động và quản lý toàn bộ Lumen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/users"
            className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Người dùng
          </Link>
          <Link
            to="/admin/exams/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Tạo đề mới
          </Link>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="mt-10 grid gap-4 md:grid-cols-4">
        <Kpi icon={BookOpen} label="Bộ đề" value={EXAMS.length} />
        <Kpi icon={Activity} label="Lượt làm bài" value={totalAttempts} />
        <Kpi icon={Users} label="Người dùng" value={USERS.length} hint={`${teachers} GV · ${students} HV`} />
        <Kpi icon={TrendingUp} label="Điểm TB" value={`${avg}/100`} />
      </div>

      {/* Top exams */}
      <section className="mt-16">
        <h2 className="mb-5 text-2xl font-semibold tracking-tight">Đề thi nhiều lượt nhất</h2>
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          {topExams.map(({ exam, stats }, i) => (
            <Link
              key={exam.id}
              to="/exams/$id"
              params={{ id: exam.id }}
              className="grid grid-cols-12 items-center gap-4 border-b border-border/60 px-6 py-4 transition-colors last:border-b-0 hover:bg-muted/30"
            >
              <div className="col-span-1 text-xs font-semibold tabular-nums text-muted-foreground">
                #{i + 1}
              </div>
              <div className="col-span-6 flex items-center gap-4">
                <div className="text-2xl">{exam.cover_emoji}</div>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{exam.title}</div>
                  <div className="text-xs text-muted-foreground">{exam.topic}</div>
                </div>
              </div>
              <Cell className="col-span-2" label="Lượt" value={stats.total} />
              <Cell className="col-span-1" label="HV" value={stats.uniqueUsers} />
              <Cell className="col-span-2" label="Đạt" value={`${stats.passRate}%`} />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Cell({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={`text-right ${className ?? ""}`}>
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}