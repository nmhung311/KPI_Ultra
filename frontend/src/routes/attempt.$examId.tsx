import { createFileRoute, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, Bookmark, Clock, Flag, X } from "lucide-react";
import {
  CURRENT_USER,
  getExamById,
  shuffle,
  type Question,
  type Attempt,
  ATTEMPTS,
  formatDuration,
} from "@/lib/mock-data";
import {
  QuestionRenderer,
  QuestionTypeBadge,
  QuestionHint,
  QuestionMedia,
  QuestionHintButton,
  type QAnswer,
} from "@/components/lms/QuestionCard";

export const Route = createFileRoute("/attempt/$examId")({
  loader: ({ params }) => {
    const exam = getExamById(params.examId);
    if (!exam) throw notFound();
    return { exam };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `Đang làm bài — ${loaderData?.exam.title ?? ""}` }],
  }),
  component: AttemptPage,
});

type Answer = QAnswer;

function AttemptPage() {
  const { exam } = Route.useLoaderData();
  const navigate = useNavigate();

  // Avoid SSR/CSR mismatch — shuffle and Date.now run on client only
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Shuffle once per mount
  const questions = useMemo<Question[]>(() => {
    const shuffled = shuffle<Question>(exam.questions);
    return shuffled.map((q) => ({
      ...q,
      options: q.type === "true_false" ? q.options : shuffle(q.options),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id]);

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState(exam.duration_minutes * 60);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warned, setWarned] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const startedAt = useRef(Date.now());

  // Countdown
  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          submit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = questions[idx];
  const ans = answers[current.id] ?? { selected: [], text: "" };
  const isFlagged = !!flagged[current.id];

  function setAnswer(next: Answer) {
    setAnswers((prev) => ({ ...prev, [current.id]: next }));
  }

  function toggleFlag() {
    setFlagged((prev) => ({ ...prev, [current.id]: !prev[current.id] }));
  }

  function gradeQuestion(q: Question, a: Answer): { correct: boolean; points: number } {
    if (q.type === "fill_blank") {
      const ok = (q.accepted_answers ?? []).some(
        (acc) => acc.trim().toLowerCase() === a.text.trim().toLowerCase(),
      );
      return { correct: ok, points: ok ? q.points : 0 };
    }
    if (q.type === "match") {
      const pairs = q.pairs ?? [];
      if (pairs.length === 0) return { correct: false, points: 0 };
      const matches = a.matches ?? {};
      // Each pair: leftId must map to rightId of the SAME pair (since we use pair.id for both sides).
      const correctCount = pairs.filter((p) => matches[p.id] === p.id).length;
      const allCorrect = correctCount === pairs.length;
      // Partial credit: proportional points, full only if all pairs correct
      const earned = allCorrect ? q.points : Math.round((correctCount / pairs.length) * q.points);
      return { correct: allCorrect, points: earned };
    }
    const correctIds = q.options.filter((o) => o.is_correct).map((o) => o.id).sort();
    const selected = [...a.selected].sort();
    const ok = correctIds.length === selected.length && correctIds.every((id, i) => id === selected[i]);
    return { correct: ok, points: ok ? q.points : 0 };
  }

  function submit(auto = false) {
    const max = questions.reduce((s, q) => s + q.points, 0);
    let earned = 0;
    const detailed = questions.map((q) => {
      const a = answers[q.id] ?? { selected: [], text: "" };
      const { correct, points } = gradeQuestion(q, a);
      earned += points;
      return {
        question_id: q.id,
        selected_option_ids: a.selected,
        text_answer: a.text,
        is_correct: correct,
        earned_points: points,
      };
    });

    const attempt: Attempt = {
      id: `att-${exam.id}-${CURRENT_USER.id}-${Date.now()}`,
      user_id: CURRENT_USER.id,
      exam_id: exam.id,
      earned_score: earned,
      max_score: max,
      score: Math.round((earned / max) * 100),
      duration_seconds: Math.floor((Date.now() - startedAt.current) / 1000),
      submitted_at: new Date().toISOString(),
      answers: detailed,
    };
    ATTEMPTS.push(attempt);
    if (auto) {
      // small delay to allow toast-style feel
    }
    navigate({ to: "/attempts/$id", params: { id: attempt.id } });
  }

  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    if (!a) return false;
    if (q.type === "fill_blank") return a.text.trim().length > 0;
    if (q.type === "match") {
      const total = q.pairs?.length ?? 0;
      return total > 0 && Object.keys(a.matches ?? {}).length === total;
    }
    return a.selected.length > 0;
  }).length;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;
  const unanswered = questions.length - answeredCount;

  const lowTime = secondsLeft < 60;
  const veryLow = secondsLeft < 30;

  // One-time banner when crossing the 60s threshold
  useEffect(() => {
    if (lowTime && !warned) {
      setWarned(true);
      setShowWarning(true);
      const t = setTimeout(() => setShowWarning(false), 6000);
      return () => clearTimeout(t);
    }
  }, [lowTime, warned]);

  if (!mounted) {
    return <main className="min-h-screen bg-background" />;
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="glass sticky top-0 z-40 border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-sm font-medium tracking-tight">
              {exam.title}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              · Câu {idx + 1}/{questions.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFlag}
              aria-label="Đánh dấu để xem lại"
              className={`hidden h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all sm:inline-flex ${
                isFlagged
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/40"
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${isFlagged ? "fill-current" : ""}`} />
              {isFlagged ? "Đã đánh dấu" : "Đánh dấu"}
            </button>
            <motion.div
              animate={veryLow ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={veryLow ? { repeat: Infinity, duration: 1 } : { duration: 0.2 }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors ${
                lowTime
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-foreground"
              }`}
            >
              <Clock className="h-4 w-4" />
              {formatDuration(secondsLeft)}
            </motion.div>
          </div>
        </div>
        {/* Progress */}
        <div className="h-0.5 w-full bg-border">
          <motion.div
            className="h-full bg-foreground"
            animate={{ width: `${((idx + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          />
        </div>
      </div>

      {/* Low-time warning banner */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="sticky top-[52px] z-30 mx-auto flex max-w-4xl items-center justify-between gap-4 px-6"
          >
            <div className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1 font-medium">
                Còn dưới 1 phút! Hệ thống sẽ tự động nộp bài khi hết giờ.
              </span>
              <button
                onClick={() => setShowWarning(false)}
                className="rounded-full p-1 text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-3xl px-6 py-10 md:py-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Meta */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold tabular-nums tracking-wider text-foreground">
                  CÂU {idx + 1}
                </span>
                <QuestionTypeBadge type={current.type} />
                <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {current.points} điểm
                </span>
              </div>
              <div className="flex items-center gap-2">
                <QuestionHintButton hint={current.hint} />
                <button
                  onClick={toggleFlag}
                  aria-label="Đánh dấu để xem lại"
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all sm:hidden ${
                    isFlagged
                      ? "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <Bookmark className={`h-3 w-3 ${isFlagged ? "fill-current" : ""}`} />
                  {isFlagged ? "Đã đánh dấu" : "Đánh dấu"}
                </button>
              </div>
            </div>

            {/* Media (image / video) — appears above the question stem */}
            {current.media && (
              <div className="mb-6">
                <QuestionMedia question={current} />
              </div>
            )}

            {/* Question */}
            <h2 className="text-balance text-3xl font-semibold leading-[1.15] tracking-tight md:text-[40px] md:leading-[1.1]">
              {current.content}
            </h2>
            <div className="mt-2">
              <QuestionHint type={current.type} />
            </div>

            {/* Options */}
            <div className="mt-10">
              <QuestionRenderer
                question={current}
                answer={ans}
                onChange={setAnswer}
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-14 flex items-center justify-between gap-4">
          <button
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition-all hover:bg-muted disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> Trước
          </button>
          <div className="hidden text-xs tabular-nums text-muted-foreground sm:block">
            Đã trả lời {answeredCount}/{questions.length}
          </div>
          {idx < questions.length - 1 ? (
            <button
              onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Tiếp <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              <Flag className="h-4 w-4" /> Nộp bài
            </button>
          )}
        </div>

        {/* Question palette */}
        <div className="mt-14 border-t border-border pt-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Tổng quan
            </span>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-foreground" />
                Đã trả lời {answeredCount}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm border border-border bg-card" />
                Chưa làm {unanswered}
              </span>
              {flaggedCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                  Đánh dấu {flaggedCount}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {questions.map((q, i) => {
              const a = answers[q.id];
              const answered =
                a &&
                (q.type === "fill_blank"
                  ? a.text.trim().length > 0
                  : q.type === "match"
                  ? (q.pairs?.length ?? 0) > 0 &&
                    Object.keys(a.matches ?? {}).length === (q.pairs?.length ?? 0)
                  : a.selected.length > 0);
              const active = i === idx;
              const flag = !!flagged[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => setIdx(i)}
                  aria-label={`Câu ${i + 1}`}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold tabular-nums transition-all ${
                    active
                      ? "bg-foreground text-background shadow-sm"
                      : answered
                      ? "bg-foreground/10 text-foreground hover:bg-foreground/15"
                      : "border border-border bg-card text-muted-foreground hover:border-foreground/40"
                  }`}
                >
                  {i + 1}
                  {flag && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Submit confirmation modal */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setConfirmOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border border-border bg-background p-7 shadow-2xl"
            >
              <h3 className="text-2xl font-semibold tracking-tight">Nộp bài?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Bạn không thể thay đổi câu trả lời sau khi nộp.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-muted p-3">
                  <div className="text-lg font-semibold tabular-nums">{answeredCount}</div>
                  <div className="text-[11px] text-muted-foreground">Đã trả lời</div>
                </div>
                <div className="rounded-2xl bg-muted p-3">
                  <div className="text-lg font-semibold tabular-nums">{unanswered}</div>
                  <div className="text-[11px] text-muted-foreground">Chưa làm</div>
                </div>
                <div className="rounded-2xl bg-muted p-3">
                  <div className="text-lg font-semibold tabular-nums">{flaggedCount}</div>
                  <div className="text-[11px] text-muted-foreground">Đánh dấu</div>
                </div>
              </div>
              {unanswered > 0 && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Bạn còn {unanswered} câu chưa trả lời.</span>
                </div>
              )}
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition-all hover:bg-muted"
                >
                  Tiếp tục làm
                </button>
                <button
                  onClick={() => {
                    setConfirmOpen(false);
                    submit(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  <Flag className="h-4 w-4" /> Nộp bài
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}