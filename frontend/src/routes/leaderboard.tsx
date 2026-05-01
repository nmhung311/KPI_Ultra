import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { EXAMS, getLeaderboard, formatDuration, CURRENT_USER } from "@/lib/mock-data";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  validateSearch: (search: Record<string, unknown>) => ({
    exam: typeof search.exam === "string" ? search.exam : EXAMS[0].id,
  }),
  head: () => ({ meta: [{ title: "Bảng xếp hạng — Lumen" }] }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { exam: examId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [tab, setTab] = useState<"all" | "mine">("all");

  const exam = EXAMS.find((e) => e.id === examId) ?? EXAMS[0];
  const lb = getLeaderboard(exam.id, 50);

  const examsToShow =
    tab === "mine"
      ? EXAMS.filter((e) =>
          getLeaderboard(e.id, 50).some((row) => row.user.id === CURRENT_USER.id),
        )
      : EXAMS;

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-20">
      <div className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Bảng xếp hạng.</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Cạnh tranh sòng phẳng. Mỗi người, một điểm cao nhất.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-full border border-border bg-card p-1">
        {(["all", "mine"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "all" ? "Tất cả bộ đề" : "Bộ đề của tôi"}
          </button>
        ))}
      </div>

      {/* Exam selector */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Chọn bộ đề
        </label>
        <select
          value={exam.id}
          onChange={(e) => navigate({ search: { exam: e.target.value }, replace: true })}
          className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:border-accent"
        >
          {examsToShow.map((e) => (
            <option key={e.id} value={e.id}>
              {e.cover_emoji}  {e.title}
            </option>
          ))}
        </select>
      </div>

      {/* Leaderboard table */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="grid grid-cols-[3rem_2.5rem_1fr_5rem_4rem] items-center gap-4 border-b border-border/60 bg-muted/40 px-5 py-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          <div>#</div>
          <div></div>
          <div>Học viên</div>
          <div className="text-right">Thời gian</div>
          <div className="text-right">Điểm</div>
        </div>
        {lb.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">Chưa có dữ liệu.</div>
        ) : (
          lb.map(({ rank, user, attempt }) => {
            const isMe = user.id === CURRENT_USER.id;
            return (
              <div
                key={user.id}
                className={`grid grid-cols-[3rem_2.5rem_1fr_5rem_4rem] items-center gap-4 border-b border-border/60 px-5 py-3.5 last:border-b-0 ${
                  isMe ? "bg-accent/5" : ""
                }`}
              >
                <div
                  className={`text-sm font-semibold tabular-nums ${
                    rank === 1 ? "text-accent" : rank <= 3 ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {rank === 1 ? <Trophy className="h-4 w-4 inline text-accent" /> : rank}
                </div>
                <div className="text-2xl">{user.avatar}</div>
                <div className="truncate text-sm font-medium">
                  {user.display_name}
                  {isMe && <span className="ml-2 text-[11px] text-accent">Bạn</span>}
                </div>
                <div className="text-right text-xs text-muted-foreground tabular-nums">
                  {formatDuration(attempt.duration_seconds)}
                </div>
                <div className="text-right text-sm font-semibold tabular-nums">{attempt.score}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-8 text-center">
        <Link
          to="/exams/$id"
          params={{ id: exam.id }}
          className="text-sm text-accent hover:underline"
        >
          Xem chi tiết bộ đề →
        </Link>
      </div>
    </main>
  );
}