import { createFileRoute, Link } from "@tanstack/react-router";
import { getMyAttempts, getExamById, formatDuration, formatDateTime } from "@/lib/mock-data";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Lịch sử làm bài — Lumen" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const attempts = getMyAttempts();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-20">
      <div className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Lịch sử làm bài.</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Tất cả {attempts.length} lần thử của bạn.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {attempts.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            Bạn chưa làm bài nào. <Link to="/exams" className="text-accent hover:underline">Khám phá kho đề →</Link>
          </div>
        ) : (
          attempts.map((a) => {
            const exam = getExamById(a.exam_id);
            if (!exam) return null;
            return (
              <Link
                key={a.id}
                to="/attempts/$id"
                params={{ id: a.id }}
                className="flex items-center gap-5 border-b border-border/60 px-6 py-5 transition-colors last:border-b-0 hover:bg-muted/50"
              >
                <div className="text-3xl">{exam.cover_emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[15px] font-medium">{exam.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(a.submitted_at)} · {formatDuration(a.duration_seconds)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold tabular-nums">{a.score}</div>
                  <div className="text-[11px] text-muted-foreground">/ 100</div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}