import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { EXAMS, TOPICS } from "@/lib/mock-data";
import { Clock, Hash, Search, Users } from "lucide-react";

export const Route = createFileRoute("/exams/")({
  head: () => ({ meta: [{ title: "Kho bộ đề — Lumen" }] }),
  component: ExamsPage,
});

function ExamsPage() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return EXAMS.filter((e) => {
      if (topic && e.topic !== topic) return false;
      if (query && !`${e.title} ${e.description}`.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
  }, [query, topic]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div className="mb-12 max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Kho bộ đề.</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {EXAMS.length} bộ đề được tuyển chọn, đa dạng chủ đề và độ khó.
        </p>
      </div>

      {/* Search + filter */}
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Tìm kiếm bộ đề…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-full border border-input bg-card pl-11 pr-4 text-sm outline-none transition-colors focus:border-accent"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={topic === null} onClick={() => setTopic(null)}>Tất cả</Chip>
          {TOPICS.map((t) => (
            <Chip key={t} active={topic === t} onClick={() => setTopic(t)}>{t}</Chip>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((exam, i) => (
          <motion.div
            key={exam.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
          >
            <Link
              to="/exams/$id"
              params={{ id: exam.id }}
              className="group block h-full rounded-3xl border border-border bg-card p-7 transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)]"
            >
              <div className="flex items-start justify-between">
                <div className="text-3xl">{exam.cover_emoji}</div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {exam.difficulty}
                </span>
              </div>
              <div className="mt-5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                {exam.topic}
              </div>
              <h3 className="mt-1.5 text-lg font-semibold tracking-tight">{exam.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{exam.description}</p>
              <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />{exam.questions.length}</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{exam.duration_minutes}'</span>
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{exam.attempts_count.toLocaleString("vi-VN")}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-16 text-center text-muted-foreground">
          Không tìm thấy bộ đề nào phù hợp.
        </div>
      )}
    </main>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-foreground text-background"
          : "border border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}