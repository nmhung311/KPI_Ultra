import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Clock, Hash, Trophy, Flame } from "lucide-react";
import {
  ATTEMPTS,
  CURRENT_USER,
  EXAMS,
  formatDuration,
  formatDate,
  getExamById,
  getMyAttempts,
} from "@/lib/mock-data";

export const Route = createFileRoute("/student")({
  head: () => ({ meta: [{ title: "Học viên — Lumen" }] }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const myAttempts = getMyAttempts();
  const total = myAttempts.length;
  const avg = total ? Math.round(myAttempts.reduce((s, a) => s + a.score, 0) / total) : 0;
  const best = myAttempts.reduce((m, a) => Math.max(m, a.score), 0);
  const examIds = new Set(myAttempts.map((a) => a.exam_id));
  const recommended = EXAMS.filter((e) => !examIds.has(e.id)).slice(0, 3);
  const inProgress = EXAMS.filter((e) => examIds.has(e.id)).slice(0, 3);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-[12px] font-medium tracking-widest text-accent uppercase">
          Xin chào, {CURRENT_USER.display_name}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
          Tiếp tục hành trình học tập.
        </h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          {total > 0
            ? `Bạn đã hoàn thành ${total} lần làm bài. Tiếp tục giữ phong độ nhé!`
            : "Hãy bắt đầu với một bộ đề được gợi ý bên dưới."}
        </p>
      </motion.div>

      {/* Stats */}
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <StatCard icon={Trophy} label="Điểm cao nhất" value={`${best}/100`} />
        <StatCard icon={Flame} label="Điểm trung bình" value={`${avg}/100`} />
        <StatCard icon={BookOpen} label="Đề đã làm" value={`${examIds.size}`} />
      </div>

      {/* In progress */}
      {inProgress.length > 0 && (
        <section className="mt-16">
          <SectionHeader title="Tiếp tục làm" hint="Cải thiện điểm số những đề đã làm" />
          <div className="grid gap-5 md:grid-cols-3">
            {inProgress.map((e) => (
              <ExamCard key={e.id} examId={e.id} variant="continue" />
            ))}
          </div>
        </section>
      )}

      {/* Recommended */}
      {recommended.length > 0 && (
        <section className="mt-16">
          <SectionHeader title="Gợi ý cho bạn" hint="Khám phá thêm chủ đề mới" />
          <div className="grid gap-5 md:grid-cols-3">
            {recommended.map((e) => (
              <ExamCard key={e.id} examId={e.id} variant="new" />
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      <section className="mt-16">
        <SectionHeader title="Hoạt động gần đây" />
        {myAttempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có hoạt động nào.</p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            {myAttempts.slice(0, 5).map((a) => {
              const exam = getExamById(a.exam_id);
              if (!exam) return null;
              return (
                <Link
                  key={a.id}
                  to="/attempts/$id"
                  params={{ id: a.id }}
                  className="flex items-center gap-4 border-b border-border/60 px-6 py-4 transition-colors last:border-b-0 hover:bg-muted/30"
                >
                  <div className="text-2xl">{exam.cover_emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{exam.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(a.submitted_at)} · {formatDuration(a.duration_seconds)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums">{a.score}</div>
                    <div className="text-[10px] text-muted-foreground">điểm</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
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

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function ExamCard({ examId, variant }: { examId: string; variant: "continue" | "new" }) {
  const exam = getExamById(examId);
  if (!exam) return null;
  const myBest = ATTEMPTS.filter(
    (a) => a.exam_id === examId && a.user_id === CURRENT_USER.id,
  ).reduce((m, a) => Math.max(m, a.score), 0);
  return (
    <Link
      to="/exams/$id"
      params={{ id: exam.id }}
      className="group block rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div className="text-3xl">{exam.cover_emoji}</div>
        {variant === "continue" && (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium tabular-nums">
            {myBest} điểm
          </span>
        )}
        {variant === "new" && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
            Mới
          </span>
        )}
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight">{exam.title}</h3>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Hash className="h-3 w-3" />
          {exam.questions.length}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {exam.duration_minutes}p
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {variant === "continue" ? "Làm lại" : "Bắt đầu"} <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}