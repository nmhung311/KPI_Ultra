import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Plus,
  TrendingUp,
  Users,
  GraduationCap,
} from "lucide-react";
import {
  CURRENT_USER,
  EXAMS,
  USERS,
  getExamStats,
  getStudentSummaries,
} from "@/lib/mock-data";

export const Route = createFileRoute("/teacher")({
  head: () => ({ meta: [{ title: "Giáo viên — Lumen" }] }),
  component: TeacherDashboard,
});

function TeacherDashboard() {
  // Mock: treat current user as creator of all exams created by 'u-5' for demo
  const myExams = EXAMS;
  const students = USERS.filter((u) => u.role === "student");
  const summaries = getStudentSummaries();
  const totalAttempts = myExams.reduce((s, e) => s + getExamStats(e.id).total, 0);
  const avgScore = Math.round(
    myExams.reduce((s, e) => s + getExamStats(e.id).avgScore, 0) / Math.max(1, myExams.length),
  );

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
            <GraduationCap className="mr-1 inline h-3 w-3" /> Phòng giáo viên
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            Chào, {CURRENT_USER.display_name}.
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Quản lý đề thi và theo dõi tiến độ học viên.
          </p>
        </div>
        <Link
          to="/admin/exams/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Tạo đề mới
        </Link>
      </motion.div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Stat icon={BookOpen} label="Đề của tôi" value={myExams.length} />
        <Stat icon={Users} label="Học viên hoạt động" value={students.length} />
        <Stat icon={TrendingUp} label={`Điểm TB · ${totalAttempts} lượt`} value={`${avgScore}/100`} />
      </div>

      {/* My exams */}
      <section className="mt-16">
        <SectionHeader title="Đề thi của tôi" />
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          {myExams.map((e) => {
            const s = getExamStats(e.id);
            return (
              <Link
                key={e.id}
                to="/exams/$id"
                params={{ id: e.id }}
                className="grid grid-cols-12 items-center gap-4 border-b border-border/60 px-6 py-4 transition-colors last:border-b-0 hover:bg-muted/30"
              >
                <div className="col-span-6 flex items-center gap-4">
                  <div className="text-2xl">{e.cover_emoji}</div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.topic} · {e.questions.length} câu · {e.duration_minutes} phút
                    </div>
                  </div>
                </div>
                <Metric className="col-span-2" label="Lượt làm" value={s.total} />
                <Metric className="col-span-2" label="Điểm TB" value={`${s.avgScore}`} />
                <Metric className="col-span-2" label="Đạt" value={`${s.passRate}%`} />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Top students */}
      <section className="mt-16">
        <SectionHeader
          title="Học viên nổi bật"
          action={
            <Link to="/teacher/students" className="text-sm text-accent hover:underline">
              Xem tất cả →
            </Link>
          }
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {summaries
            .sort((a, b) => b.avgScore - a.avgScore)
            .slice(0, 6)
            .map((s) => (
              <div
                key={s.user.id}
                className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-2xl">
                  {s.user.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{s.user.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.examsTaken} đề · {s.attempts} lượt
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold tabular-nums">{s.avgScore}</div>
                  <div className="text-[10px] text-muted-foreground">TB</div>
                </div>
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

function Metric({
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

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

// re-export so route file is single export module is happy
export { ArrowRight };