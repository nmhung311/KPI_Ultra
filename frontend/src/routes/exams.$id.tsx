import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getExamById, getLeaderboard, getMyAttempts, formatDuration, formatDate } from "@/lib/mock-data";
import { ArrowRight, Clock, Hash, Trophy } from "lucide-react";

export const Route = createFileRoute("/exams/$id")({
  loader: ({ params }) => {
    const exam = getExamById(params.id);
    if (!exam) throw notFound();
    return { exam };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.exam.title ?? "Bộ đề"} — Lumen` }],
  }),
  component: ExamDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-32 text-center">
      <h1 className="text-3xl font-semibold">Không tìm thấy bộ đề</h1>
      <Link to="/exams" className="mt-6 inline-block text-accent hover:underline">← Về kho đề</Link>
    </div>
  ),
});

function ExamDetail() {
  const { exam } = Route.useLoaderData();
  const leaderboard = getLeaderboard(exam.id, 10);
  const myAttempts = getMyAttempts(exam.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 md:py-20">
      <Link to="/exams" className="mb-8 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Kho đề
      </Link>

      {/* Hero */}
      <div className="mb-16 rounded-3xl border border-border bg-card p-10 md:p-14">
        <div className="text-5xl">{exam.cover_emoji}</div>
        <div className="mt-6 text-[12px] font-medium tracking-wider text-muted-foreground uppercase">
          {exam.topic} · {exam.difficulty}
        </div>
        <h1 className="mt-2 text-balance text-4xl font-semibold tracking-tight md:text-5xl">{exam.title}</h1>
        <p className="text-pretty mt-4 max-w-2xl text-lg text-muted-foreground">{exam.description}</p>

        <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Hash className="h-4 w-4" />{exam.questions.length} câu hỏi</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{exam.duration_minutes} phút</span>
          <span>{exam.attempts_count.toLocaleString("vi-VN")} lượt làm</span>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/attempt/$examId"
            params={{ examId: exam.id }}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-transform hover:scale-[1.02]"
          >
            Bắt đầu làm bài <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Leaderboard + history */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight inline-flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" /> Bảng xếp hạng
            </h2>
            <Link
              to="/leaderboard"
              search={{ exam: exam.id }}
              className="text-xs text-accent hover:underline"
            >
              Tất cả →
            </Link>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            {leaderboard.map(({ rank, user, attempt }) => (
              <div
                key={user.id}
                className="flex items-center gap-4 border-b border-border/60 px-5 py-3.5 last:border-b-0"
              >
                <div className={`w-6 text-center text-sm font-semibold tabular-nums ${rank <= 3 ? "text-accent" : "text-muted-foreground"}`}>
                  {rank}
                </div>
                <div className="text-2xl">{user.avatar}</div>
                <div className="flex-1 text-sm font-medium">{user.display_name}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{formatDuration(attempt.duration_seconds)}</div>
                <div className="w-12 text-right text-sm font-semibold tabular-nums">{attempt.score}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-5 text-xl font-semibold tracking-tight">Lịch sử của bạn</h2>
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            {myAttempts.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">Chưa có lần làm nào.</div>
            ) : (
              myAttempts.map((a) => (
                <Link
                  key={a.id}
                  to="/attempts/$id"
                  params={{ id: a.id }}
                  className="flex items-center justify-between border-b border-border/60 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-muted/50"
                >
                  <div>
                    <div className="text-sm font-semibold tabular-nums">{a.score}/100</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(a.submitted_at)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">{formatDuration(a.duration_seconds)}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}