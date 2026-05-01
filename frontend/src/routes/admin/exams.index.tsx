import { createFileRoute, Link } from "@tanstack/react-router";
import { EXAMS } from "@/lib/mock-data";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/exams/")({
  head: () => ({ meta: [{ title: "Quản lý đề thi — Lumen" }] }),
  component: AdminExams,
});

function AdminExams() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 md:py-20">
      <div className="mb-12 flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Quản lý đề thi.</h1>
          <p className="mt-3 text-lg text-muted-foreground">{EXAMS.length} bộ đề trong hệ thống.</p>
        </div>
        <Link
          to="/admin/exams/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Tạo đề mới
        </Link>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {EXAMS.map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-5 border-b border-border/60 px-6 py-5 transition-colors last:border-b-0 hover:bg-muted/30"
          >
            <div className="text-3xl">{e.cover_emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-[15px] font-medium">{e.title}</div>
              <div className="text-xs text-muted-foreground">
                {e.topic} · {e.questions.length} câu · {e.duration_minutes} phút · {e.attempts_count.toLocaleString("vi-VN")} lượt làm
              </div>
            </div>
            <button className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Sửa">
              <Pencil className="h-4 w-4" />
            </button>
            <button className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="Xóa">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}