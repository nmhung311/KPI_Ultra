import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Đăng nhập — Lumen" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/exams" });
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-sm flex-col justify-center px-6 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Chào mừng trở lại.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Đăng nhập để tiếp tục học tập.</p>
      </div>

      <button
        type="button"
        onClick={() => navigate({ to: "/exams" })}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background text-sm font-medium transition-colors hover:bg-muted"
      >
        <GoogleIcon />
        Đăng nhập với Google
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        hoặc
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition-colors focus:border-accent"
        />
        <input
          type="password"
          required
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          className="h-11 w-full rounded-full bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Đăng nhập
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link to="/signup" className="text-foreground underline-offset-4 hover:underline">
          Đăng ký
        </Link>
      </p>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.97 6.97 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}