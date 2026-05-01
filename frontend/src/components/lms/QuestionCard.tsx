import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Circle,
  GripVertical,
  Lightbulb,
  Pause,
  Play,
  Shuffle,
  Square,
  ToggleLeft,
  Type,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "@/lib/mock-data";

/**
 * Universal answer shape.
 * - selected: option IDs for single/multiple/true_false
 * - text: free text for fill_blank
 * - matches: { [leftId]: rightId } for "match" (drag-drop) questions
 */
export type QAnswer = {
  selected: string[];
  text: string;
  matches?: Record<string, string>;
};

const TYPE_META: Record<
  Question["type"],
  { label: string; icon: typeof Circle; hint: string }
> = {
  single: { label: "Một đáp án", icon: Circle, hint: "Chọn một phương án đúng" },
  multiple: { label: "Nhiều đáp án", icon: Square, hint: "Có thể chọn nhiều phương án" },
  true_false: { label: "Đúng / Sai", icon: ToggleLeft, hint: "Đánh giá nhận định" },
  fill_blank: { label: "Điền vào chỗ trống", icon: Type, hint: "Nhập câu trả lời ngắn" },
  match: { label: "Kéo thả ghép cặp", icon: Shuffle, hint: "Kéo các thẻ bên phải vào ô tương ứng bên trái" },
};

export function QuestionTypeBadge({ type }: { type: Question["type"] }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium tracking-tight text-muted-foreground">
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

export function QuestionHint({ type }: { type: Question["type"] }) {
  return (
    <p className="text-sm text-muted-foreground">{TYPE_META[type].hint}</p>
  );
}

/* ----------------------------- Question media ---------------------------- */

/**
 * Renders an attached image or video for a question stem.
 * Designed to feel like a "card" — generous rounding, subtle border, soft shadow.
 */
export function QuestionMedia({ question }: { question: Question }) {
  const media = question.media;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  if (!media) return null;

  if (media.type === "image") {
    return (
      <figure className="group relative overflow-hidden rounded-3xl border border-border bg-muted/30 shadow-[0_1px_0_0_rgba(0,0,0,0.02)]">
        <img
          src={media.src}
          alt={media.alt ?? "Hình minh hoạ câu hỏi"}
          loading="lazy"
          className="aspect-[16/9] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
        />
        {media.alt && (
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3 text-xs font-medium text-white/90">
            {media.alt}
          </figcaption>
        )}
      </figure>
    );
  }

  // Video
  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }
  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  return (
    <figure className="relative overflow-hidden rounded-3xl border border-border bg-black shadow-[0_1px_0_0_rgba(0,0,0,0.02)]">
      <video
        ref={videoRef}
        src={media.src}
        poster={media.poster}
        muted={muted}
        playsInline
        onEnded={() => setPlaying(false)}
        className="aspect-[16/9] w-full object-cover"
      />
      {/* Custom controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Tạm dừng" : "Phát"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-black shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
        </button>
        <div className="flex items-center gap-2">
          {media.alt && (
            <span className="hidden text-xs font-medium text-white/80 sm:inline">
              {media.alt}
            </span>
          )}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Bật âm" : "Tắt âm"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </figure>
  );
}

/* --------------------------- Hint (lightbulb) --------------------------- */

/**
 * A floating "lightbulb" pill that reveals a hint for the current question.
 * Stateless wrt. correctness — purely informational. The amber palette signals
 * "tip" without competing with the primary foreground actions.
 */
export function QuestionHintButton({
  hint,
  className,
}: {
  hint?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!hint) return null;

  return (
    <div className={`relative inline-block ${className ?? ""}`}>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.95 }}
        aria-expanded={open}
        aria-label="Xem gợi ý"
        className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
          open
            ? "border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : "border-border bg-card text-muted-foreground hover:border-amber-500/40 hover:bg-amber-500/[0.06] hover:text-amber-700 dark:hover:text-amber-300"
        }`}
      >
        <motion.span
          animate={open ? { rotate: [0, -10, 10, 0] } : { rotate: 0 }}
          transition={{ duration: 0.45 }}
          className="relative flex h-4 w-4 items-center justify-center"
        >
          <Lightbulb className={`h-4 w-4 ${open ? "fill-amber-400 text-amber-500" : ""}`} />
          {!open && (
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]" />
          )}
        </motion.span>
        Gợi ý
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="absolute right-0 top-[calc(100%+8px)] z-30 w-72 origin-top-right rounded-2xl border border-amber-500/30 bg-background p-4 shadow-xl"
            role="dialog"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-amber-600 uppercase dark:text-amber-400">
                <Lightbulb className="h-3 w-3 fill-amber-400 text-amber-500" />
                Gợi ý
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng gợi ý"
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{hint}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------- Single ------------------------------- */

export function SingleChoice({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: QAnswer;
  onChange: (a: QAnswer) => void;
}) {
  return (
    <div className="space-y-2.5">
      {question.options.map((opt, i) => {
        const checked = answer.selected[0] === opt.id;
        return (
          <motion.button
            key={opt.id}
            type="button"
            whileTap={{ scale: 0.995 }}
            onClick={() => onChange({ selected: [opt.id], text: "" })}
            className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
              checked
                ? "border-foreground bg-foreground/[0.04] shadow-[0_1px_0_0_rgba(0,0,0,0.02)]"
                : "border-border bg-card hover:border-foreground/40"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                checked
                  ? "bg-foreground text-background"
                  : "border border-border bg-background text-muted-foreground group-hover:border-foreground/40"
              }`}
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1 text-[15px] leading-relaxed">{opt.content}</span>
            {checked && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Multiple ------------------------------ */

export function MultipleChoice({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: QAnswer;
  onChange: (a: QAnswer) => void;
}) {
  return (
    <div className="space-y-2.5">
      {question.options.map((opt, i) => {
        const checked = answer.selected.includes(opt.id);
        return (
          <motion.button
            key={opt.id}
            type="button"
            whileTap={{ scale: 0.995 }}
            onClick={() =>
              onChange({
                selected: checked
                  ? answer.selected.filter((s) => s !== opt.id)
                  : [...answer.selected, opt.id],
                text: "",
              })
            }
            className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
              checked
                ? "border-foreground bg-foreground/[0.04]"
                : "border-border bg-card hover:border-foreground/40"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                checked
                  ? "bg-foreground text-background"
                  : "border border-border bg-background text-muted-foreground group-hover:border-foreground/40"
              }`}
            >
              {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1 text-[15px] leading-relaxed">{opt.content}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ------------------------------ True/False ----------------------------- */

export function TrueFalseChoice({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: QAnswer;
  onChange: (a: QAnswer) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {question.options.map((opt) => {
        const checked = answer.selected[0] === opt.id;
        const isTrue = opt.content.toLowerCase().includes("đúng") || opt.content.toLowerCase() === "true";
        return (
          <motion.button
            key={opt.id}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange({ selected: [opt.id], text: "" })}
            className={`relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border p-8 transition-all duration-200 ${
              checked
                ? isTrue
                  ? "border-emerald-500/60 bg-emerald-500/[0.06]"
                  : "border-rose-500/60 bg-rose-500/[0.06]"
                : "border-border bg-card hover:border-foreground/40"
            }`}
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl transition-all ${
                checked
                  ? isTrue
                    ? "bg-emerald-500 text-white"
                    : "bg-rose-500 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isTrue ? "✓" : "✕"}
            </span>
            <span className="text-base font-medium tracking-tight">{opt.content}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ----------------------------- Fill blank ----------------------------- */

export function FillBlank({
  answer,
  onChange,
}: {
  question: Question;
  answer: QAnswer;
  onChange: (a: QAnswer) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          autoFocus
          value={answer.text}
          onChange={(e) => onChange({ selected: [], text: e.target.value })}
          placeholder="Nhập câu trả lời của bạn…"
          className="h-16 w-full rounded-2xl border border-input bg-card px-6 text-lg font-medium tracking-tight outline-none transition-all duration-200 placeholder:font-normal placeholder:text-muted-foreground/60 focus:border-foreground focus:bg-background"
        />
        {answer.text.trim().length > 0 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute right-5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </motion.span>
        )}
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        Mẹo: trả lời ngắn gọn, không phân biệt hoa thường.
      </p>
    </div>
  );
}

/* ------------------------------- Match -------------------------------- */

/** Drag-drop pairing question. Right items are draggable, left items are drop zones. */
export function MatchPairs({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: QAnswer;
  onChange: (a: QAnswer) => void;
}) {
  const pairs = question.pairs ?? [];

  // Shuffle right items once per question (display order should differ from left)
  const rightItems = useMemo(() => {
    const arr = pairs.map((p) => ({ id: p.id, label: p.right }));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const matches = answer.matches ?? {};
  const [dragging, setDragging] = useState<string | null>(null);
  const [hoverLeft, setHoverLeft] = useState<string | null>(null);

  // Map of rightId -> leftId for "already used" detection
  const usedRight = useMemo(() => {
    const m: Record<string, string> = {};
    Object.entries(matches).forEach(([l, r]) => {
      m[r] = l;
    });
    return m;
  }, [matches]);

  function setMatch(leftId: string, rightId: string | null) {
    const next = { ...matches };
    // remove existing assignment of this rightId from any other left slot
    Object.keys(next).forEach((l) => {
      if (next[l] === rightId) delete next[l];
    });
    if (rightId) next[leftId] = rightId;
    else delete next[leftId];
    onChange({ selected: [], text: "", matches: next });
  }

  return (
    <div className="space-y-6">
      {/* Pairing grid: left = drop zones, right = draggable cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* LEFT: prompts with drop zones */}
        <div className="space-y-2.5">
          <div className="px-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            Mục cần ghép
          </div>
          {pairs.map((p, i) => {
            const matchedRightId = matches[p.id];
            const matchedLabel = pairs.find((x) => x.id === matchedRightId)?.right;
            const isHover = hoverLeft === p.id;
            return (
              <div
                key={p.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setHoverLeft(p.id);
                }}
                onDragLeave={() => setHoverLeft((cur) => (cur === p.id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  const rightId = e.dataTransfer.getData("text/plain");
                  if (rightId) setMatch(p.id, rightId);
                  setHoverLeft(null);
                  setDragging(null);
                }}
                className={`flex items-stretch gap-3 rounded-2xl border p-3 transition-all duration-200 ${
                  isHover
                    ? "border-foreground bg-foreground/[0.04]"
                    : matchedRightId
                    ? "border-foreground/30 bg-card"
                    : "border-dashed border-border bg-card"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                  {i + 1}
                </span>
                <div className="flex flex-1 items-center justify-between gap-3">
                  <span className="text-[15px] font-medium tracking-tight">{p.left}</span>
                  <span className="text-muted-foreground/40">→</span>
                  {matchedRightId && matchedLabel ? (
                    <motion.span
                      layout
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="group inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                    >
                      {matchedLabel}
                      <button
                        type="button"
                        onClick={() => setMatch(p.id, null)}
                        className="rounded-full p-0.5 transition-colors hover:bg-background/20"
                        aria-label="Bỏ ghép"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.span>
                  ) : (
                    <span className="rounded-xl border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground/70">
                      Thả vào đây
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT: draggable bank */}
        <div className="space-y-2.5">
          <div className="px-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            Kéo thẻ vào ô bên trái
          </div>
          {rightItems.map((item) => {
            const usedBy = usedRight[item.id];
            const isUsed = !!usedBy;
            const isDragging = dragging === item.id;
            return (
              <motion.div
                key={item.id}
                layout
                draggable={!isUsed}
                onDragStart={(e) => {
                  // framer-motion forwards event with dataTransfer
                  (e as unknown as React.DragEvent).dataTransfer?.setData("text/plain", item.id);
                  setDragging(item.id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setHoverLeft(null);
                }}
                whileHover={!isUsed ? { y: -1 } : undefined}
                whileTap={!isUsed ? { scale: 0.98 } : undefined}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                  isUsed
                    ? "cursor-not-allowed border-border bg-muted/40 opacity-50"
                    : isDragging
                    ? "cursor-grabbing border-foreground bg-foreground/[0.04] shadow-lg"
                    : "cursor-grab border-border bg-card hover:border-foreground/40"
                }`}
              >
                <GripVertical
                  className={`h-4 w-4 shrink-0 ${
                    isUsed ? "text-muted-foreground/40" : "text-muted-foreground"
                  }`}
                />
                <span className="flex-1 text-[15px] leading-relaxed">{item.label}</span>
                {isUsed && (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    đã ghép
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Kéo từng thẻ bên phải và thả vào ô tương ứng bên trái. Bấm <X className="inline h-3 w-3" /> để bỏ ghép.
      </p>
    </div>
  );
}

/* ------------------------------ Renderer ------------------------------ */

export function QuestionRenderer({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: QAnswer;
  onChange: (a: QAnswer) => void;
}) {
  const props = { question, answer, onChange };
  switch (question.type) {
    case "single":
      return <SingleChoice {...props} />;
    case "multiple":
      return <MultipleChoice {...props} />;
    case "true_false":
      return <TrueFalseChoice {...props} />;
    case "fill_blank":
      return <FillBlank {...props} />;
    case "match":
      return <MatchPairs {...props} />;
  }
}