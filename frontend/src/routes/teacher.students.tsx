import { createFileRoute } from "@tanstack/react-router";
import { getStudentSummaries, formatDate } from "@/lib/mock-data";

export const Route = createFileRoute("/teacher/students")({
  head: () => ({ meta: [{ title: "Học viên — Lumen" }] }),
  component: TeacherStudents,
});

function TeacherStudents() {
  const summaries = getStudentSummaries().sort((a, b) => b.avgScore - a.avgScore);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      <div className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Học viên.</h1>
        <p className="mt-3 text-muted-foreground">
          {summaries.length} học viên đang hoạt động trong hệ thống.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="grid grid-cols-12 gap-4 border-b border-border bg-muted/30 px-6 py-3 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
          <div className="col-span-5">Học viên</div>
          <div className="col-span-2 text-right">Đề đã làm</div>
          <div className="col-span-2 text-right">Lượt làm</div>
          <div className="col-span-3 text-right">Điểm TB</div>
        </div>
        {summaries.map((s) => (
          <div
            key={s.user.id}
            className="grid grid-cols-12 items-center gap-4 border-b border-border/60 px-6 py-4 transition-colors last:border-b-0 hover:bg-muted/30"
          >
            <div className="col-span-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xl">
                {s.user.avatar}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium">{s.user.display_name}</div>
                {s.lastActive && (
                  <div className="text-xs text-muted-foreground">
                    Hoạt động {formatDate(s.lastActive)}
                  </div>
                )}
              </div>
            </div>
            <div className="col-span-2 text-right text-sm tabular-nums">{s.examsTaken}</div>
            <div className="col-span-2 text-right text-sm tabular-nums">{s.attempts}</div>
            <div className="col-span-3 text-right">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums ${
                  s.avgScore >= 80
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : s.avgScore >= 60
                    ? "bg-foreground/10 text-foreground"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {s.avgScore}/100
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}