import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Đăng ký — Lumen" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/exams" });
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-sm flex-col justify-center px-6 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Tạo tài khoản.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bắt đầu hành trình học tập của bạn.</p>
      </div>

      <button
        type="button"
        onClick={() => navigate({ to: "/exams" })}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background text-sm font-medium transition-colors hover:bg-muted"
      >
        Đăng ký với Google
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        hoặc
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          required
          placeholder="Họ và tên"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-accent"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-accent"
        />
        <input
          type="password"
          required
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="h-11 w-full rounded-full bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Tạo tài khoản
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link to="/login" className="text-foreground underline-offset-4 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </main>
  );
}