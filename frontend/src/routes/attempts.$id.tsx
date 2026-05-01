import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  getAttemptById,
  getExamById,
  getLeaderboard,
  formatDuration,
  CURRENT_USER,
  type AttemptAnswer,
  type Question,
} from "@/lib/mock-data";
import { Check, X, Trophy, Clock, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/attempts/$id")({
  loader: ({ params }) => {
    const attempt = getAttemptById(params.id);
    if (!attempt) throw notFound();
    const exam = getExamById(attempt.exam_id)!;
    return { attempt, exam };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `Kết quả — ${loaderData?.exam.title ?? ""}` }],
  }),
  component: AttemptResult,
});

function AttemptResult() {
  const { attempt, exam } = Route.useLoaderData();
  const lb = getLeaderboard(exam.id, 50);
  const myRank = lb.find((e) => e.user.id === CURRENT_USER.id)?.rank;

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-20">
      <Link
        to="/exams/$id"
        params={{ id: exam.id }}
        className="mb-8 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← {exam.title}
      </Link>

      {/* Score hero */}
      <div className="rounded-3xl border border-border bg-card p-10 text-center md:p-16">
        <div className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Kết quả của bạn
        </div>
        <div className="mt-4 text-7xl font-semibold tracking-tighter tabular-nums md:text-8xl">
          {attempt.score}
          <span className="text-3xl text-muted-foreground">/100</span>
        </div>
        <div className="mt-3 text-muted-foreground">
          {attempt.earned_score} / {attempt.max_score} điểm
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" /> {formatDuration(attempt.duration_seconds)}
          </span>
          {myRank && (
            <span className="inline-flex items-center gap-1.5 text-accent">
              <Trophy className="h-4 w-4" /> Hạng #{myRank}
            </span>
          )}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/attempt/$examId"
            params={{ examId: exam.id }}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" /> Làm lại
          </Link>
          <Link
            to="/leaderboard"
            search={{ exam: exam.id }}
            className="rounded-full border border-border px-6 py-3 text-sm font-medium hover:bg-muted"
          >
            Xem xếp hạng
          </Link>
        </div>
      </div>

      {/* Detailed answers */}
      {attempt.answers.length > 0 && (
        <div className="mt-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Chi tiết câu trả lời</h2>
          <div className="space-y-4">
            {attempt.answers.map((ans: AttemptAnswer, i: number) => {
              const q: Question | undefined = exam.questions.find(
                (qq: Question) => qq.id === ans.question_id,
              );
              if (!q) return null;
              return (
                <div key={ans.question_id} className="rounded-3xl border border-border bg-card p-7">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        ans.is_correct
                          ? "bg-green-500/15 text-green-600 dark:text-green-400"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {ans.is_correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">Câu {i + 1}</div>
                      <h3 className="mt-1 text-lg font-medium">{q.content}</h3>

                      <div className="mt-4 space-y-2">
                        {q.type === "fill_blank" ? (
                          <>
                            <Row label="Bạn trả lời">{ans.text_answer || <em>(trống)</em>}</Row>
                            <Row label="Đáp án đúng">{(q.accepted_answers ?? []).join(" / ")}</Row>
                          </>
                        ) : (
                          q.options.map((opt) => {
                            const selected = (ans.selected_option_ids ?? []).includes(opt.id);
                            return (
                              <div
                                key={opt.id}
                                className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
                                  opt.is_correct
                                    ? "border-green-500/40 bg-green-500/5"
                                    : selected
                                      ? "border-destructive/40 bg-destructive/5"
                                      : "border-border"
                                }`}
                              >
                                <span className="text-xs text-muted-foreground">
                                  {selected ? "Bạn chọn" : opt.is_correct ? "Đúng" : ""}
                                </span>
                                <span>{opt.content}</span>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {q.explanation && (
                        <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Giải thích: </span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {ans.earned_points}/{q.points}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 rounded-xl border border-border p-3 text-sm">
      <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}