import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { EXAMS } from "@/lib/mock-data";
import { ArrowRight, Clock, Hash } from "lucide-react";
import { useEffect } from "react";
import { ROLE_HOME, useActiveRole } from "@/lib/role";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumen — Học là cảm hứng." },
      { name: "description", content: "Một cách tinh tế để học và kiểm tra kiến thức của bạn." },
    ],
  }),
  component: Index,
});

function Index() {
  const role = useActiveRole();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to role-specific dashboard
    navigate({ to: ROLE_HOME[role], replace: true });
  }, [role, navigate]);

  const featured = EXAMS.slice(0, 3);

  return (
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-32 text-center md:pt-36 md:pb-44">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-5 text-[13px] font-medium tracking-widest text-accent uppercase"
          >
            Giới thiệu Lumen
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="text-balance mx-auto max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl"
          >
            Học là cảm hứng.
            <br />
            <span className="text-muted-foreground">Kiểm tra là sự rõ ràng.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="text-pretty mx-auto mt-7 max-w-2xl text-lg text-muted-foreground md:text-xl"
          >
            Kho bộ đề tinh chọn, trải nghiệm làm bài mượt mà, xếp hạng minh bạch — tất cả trong một giao diện gọn gàng.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to="/exams"
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-transform hover:scale-[1.02]"
            >
              Bắt đầu làm bài <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/leaderboard"
              search={{ exam: "" }}
              className="rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              Xem xếp hạng
            </Link>
          </motion.div>
        </div>

        {/* Subtle gradient accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-32 h-64 opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(60% 100% at 50% 50%, color-mix(in oklab, var(--accent) 35%, transparent), transparent)",
          }}
        />
      </section>

      {/* FEATURED EXAMS */}
      <section className="mx-auto max-w-6xl px-6 pb-32">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Bộ đề nổi bật</h2>
            <p className="mt-2 text-muted-foreground">Được tuyển chọn từ kho đề chất lượng.</p>
          </div>
          <Link to="/exams" className="hidden text-sm text-accent hover:underline md:block">
            Tất cả →
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {featured.map((exam, i) => (
            <motion.div
              key={exam.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <Link
                to="/exams/$id"
                params={{ id: exam.id }}
                className="group block h-full rounded-3xl border border-border bg-card p-7 transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)]"
              >
                <div className="text-4xl">{exam.cover_emoji}</div>
                <div className="mt-5 text-[12px] font-medium tracking-wider text-muted-foreground uppercase">
                  {exam.topic}
                </div>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{exam.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{exam.description}</p>
                <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />{exam.questions.length} câu</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{exam.duration_minutes} phút</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-muted-foreground">
          <span>© 2026 Lumen</span>
          <span>Thiết kế tối giản, tập trung vào học tập.</span>
        </div>
      </footer>
    </main>
  );
}
