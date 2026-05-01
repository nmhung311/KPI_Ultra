import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Pencil, BarChart3 } from "lucide-react";
import { EXAMS, getExamStats } from "@/lib/mock-data";

export const Route = createFileRoute("/teacher/exams")({
  head: () => ({ meta: [{ title: "Đề của tôi — Lumen" }] }),
  component: TeacherExams,
});

function TeacherExams() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Đề của tôi.</h1>
          <p className="mt-3 text-muted-foreground">Quản lý nội dung đề thi do bạn tạo.</p>
        </div>
        <Link
          to="/admin/exams/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Tạo đề mới
        </Link>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {EXAMS.map((e) => {
          const s = getExamStats(e.id);
          return (
            <div
              key={e.id}
              className="grid grid-cols-12 items-center gap-4 border-b border-border/60 px-6 py-5 transition-colors last:border-b-0 hover:bg-muted/30"
            >
              <div className="col-span-6 flex items-center gap-4">
                <div className="text-3xl">{e.cover_emoji}</div>
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.topic} · {e.questions.length} câu · {e.duration_minutes} phút
                  </div>
                </div>
              </div>
              <div className="col-span-2 text-right">
                <div className="text-base font-semibold tabular-nums">{s.total}</div>
                <div className="text-[10px] text-muted-foreground">lượt</div>
              </div>
              <div className="col-span-2 text-right">
                <div className="text-base font-semibold tabular-nums">{s.avgScore}</div>
                <div className="text-[10px] text-muted-foreground">điểm TB</div>
              </div>
              <div className="col-span-2 flex items-center justify-end gap-1">
                <Link
                  to="/leaderboard"
                  search={{ exam: e.id }}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Thống kê"
                >
                  <BarChart3 className="h-4 w-4" />
                </Link>
                <button
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Sửa"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}