import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import type { QuestionType } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/exams/new")({
  head: () => ({ meta: [{ title: "Tạo đề mới — Lumen" }] }),
  component: NewExamPage,
});

type DraftOption = { content: string; is_correct: boolean };
type DraftQuestion = {
  id: string;
  type: QuestionType;
  content: string;
  points: number;
  explanation: string;
  options: DraftOption[];
  accepted_answer: string;
};

const TYPE_LABELS: Record<QuestionType, string> = {
  single: "Một đáp án",
  multiple: "Nhiều đáp án",
  true_false: "Đúng/Sai",
  fill_blank: "Điền vào chỗ trống",
  match: "Kéo thả ghép cặp",
};

function blankQuestion(type: QuestionType = "single"): DraftQuestion {
  return {
    id: `q-${Math.random().toString(36).slice(2, 9)}`,
    type,
    content: "",
    points: 10,
    explanation: "",
    accepted_answer: "",
    options:
      type === "true_false"
        ? [
            { content: "Đúng", is_correct: true },
            { content: "Sai", is_correct: false },
          ]
        : type === "fill_blank"
          ? []
          : [
              { content: "", is_correct: true },
              { content: "", is_correct: false },
            ],
  };
}

function NewExamPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(15);
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankQuestion()]);

  function updateQuestion(id: string, patch: Partial<DraftQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function changeType(id: string, type: QuestionType) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...blankQuestion(type), id: q.id, content: q.content, points: q.points } : q)));
  }

  function addOption(qid: string) {
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === qid ? { ...q, options: [...q.options, { content: "", is_correct: false }] } : q,
      ),
    );
  }

  function updateOption(qid: string, oi: number, patch: Partial<DraftOption>) {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.id !== qid) return q;
        const options = q.options.map((o, i) => (i === oi ? { ...o, ...patch } : o));
        // Single choice / true_false → only one correct
        if (patch.is_correct && (q.type === "single" || q.type === "true_false")) {
          options.forEach((o, i) => (o.is_correct = i === oi));
        }
        return { ...q, options };
      }),
    );
  }

  function removeOption(qid: string, oi: number) {
    setQuestions((qs) =>
      qs.map((q) => (q.id === qid ? { ...q, options: q.options.filter((_, i) => i !== oi) } : q)),
    );
  }

  function removeQuestion(qid: string) {
    setQuestions((qs) => (qs.length === 1 ? qs : qs.filter((q) => q.id !== qid)));
  }

  function onSubmit() {
    // demo only — quay lại danh sách
    navigate({ to: "/admin/exams" });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-20">
      <div className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight">Tạo bộ đề mới.</h1>
        <p className="mt-3 text-muted-foreground">Điền thông tin chung, sau đó thêm câu hỏi.</p>
      </div>

      {/* Exam info */}
      <section className="mb-10 space-y-4 rounded-3xl border border-border bg-card p-7">
        <Field label="Tên bộ đề">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: JavaScript căn bản"
            className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-accent"
          />
        </Field>
        <Field label="Mô tả">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Mô tả ngắn về nội dung bài kiểm tra"
            className="w-full rounded-xl border border-input bg-background p-4 text-sm outline-none focus:border-accent"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Chủ đề">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="VD: Lập trình"
              className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="Thời gian (phút)">
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min={1}
              className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-accent"
            />
          </Field>
        </div>
      </section>

      {/* Question builder */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Câu hỏi ({questions.length})</h2>
        </div>

        {questions.map((q, qi) => (
          <div key={q.id} className="rounded-3xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Câu {qi + 1}
              </span>
              {questions.length > 1 && (
                <button
                  onClick={() => removeQuestion(q.id)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Xóa câu"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Type tabs */}
            <div className="mb-4 inline-flex flex-wrap gap-1 rounded-full border border-border bg-background p-1">
              {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => changeType(q.id, t)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                    q.type === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            <textarea
              value={q.content}
              onChange={(e) => updateQuestion(q.id, { content: e.target.value })}
              rows={2}
              placeholder="Nội dung câu hỏi…"
              className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-accent"
            />

            {/* Options or fill blank */}
            <div className="mt-4 space-y-2">
              {q.type === "fill_blank" ? (
                <Field label="Đáp án đúng (cách nhau bằng dấu phẩy nếu nhiều)">
                  <input
                    value={q.accepted_answer}
                    onChange={(e) => updateQuestion(q.id, { accepted_answer: e.target.value })}
                    placeholder="VD: parse, JSON.parse"
                    className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-accent"
                  />
                </Field>
              ) : (
                <>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateOption(q.id, oi, { is_correct: !opt.is_correct })}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                          opt.is_correct
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:border-foreground"
                        }`}
                        aria-label="Đánh dấu đáp án đúng"
                      >
                        {opt.is_correct && <Check className="h-4 w-4" />}
                      </button>
                      <input
                        value={opt.content}
                        disabled={q.type === "true_false"}
                        onChange={(e) => updateOption(q.id, oi, { content: e.target.value })}
                        placeholder={`Phương án ${oi + 1}`}
                        className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent disabled:opacity-60"
                      />
                      {q.type !== "true_false" && q.options.length > 2 && (
                        <button
                          onClick={() => removeOption(q.id, oi)}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Xóa phương án"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {q.type !== "true_false" && (
                    <button
                      onClick={() => addOption(q.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" /> Thêm phương án
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Explanation + points */}
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={q.explanation}
                onChange={(e) => updateQuestion(q.id, { explanation: e.target.value })}
                placeholder="Giải thích (tùy chọn)"
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Điểm</span>
                <input
                  type="number"
                  value={q.points}
                  onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) })}
                  className="h-10 w-20 rounded-lg border border-input bg-background px-3 text-sm tabular-nums outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}
          className="flex w-full items-center justify-center gap-1.5 rounded-3xl border border-dashed border-border py-5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Thêm câu hỏi
        </button>
      </section>

      {/* Submit */}
      <div className="sticky bottom-6 mt-12 flex justify-end">
        <button
          onClick={onSubmit}
          className="rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background shadow-lg transition-transform hover:scale-[1.02]"
        >
          Lưu bộ đề
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}