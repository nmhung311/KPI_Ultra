import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Moon, Shield, Sun, GraduationCap, BookOpen, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ROLE_LABEL,
  setActiveRole,
  useActiveRole,
  type Role,
} from "@/lib/role";

type NavItem = { to: string; label: string; exact?: boolean };

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  student: [
    { to: "/student", label: "Bảng điều khiển", exact: true },
    { to: "/exams", label: "Kho đề" },
    { to: "/leaderboard", label: "Xếp hạng" },
    { to: "/history", label: "Lịch sử" },
  ],
  teacher: [
    { to: "/teacher", label: "Bảng điều khiển", exact: true },
    { to: "/teacher/exams", label: "Đề của tôi" },
    { to: "/teacher/students", label: "Học viên" },
    { to: "/leaderboard", label: "Xếp hạng" },
  ],
  admin: [
    { to: "/admin", label: "Tổng quan", exact: true },
    { to: "/admin/exams", label: "Đề thi" },
    { to: "/admin/users", label: "Người dùng" },
    { to: "/admin/kpi", label: "KPI" },
    { to: "/admin/kpi/reconciliation", label: "Đối soát" },
    { to: "/leaderboard", label: "Xếp hạng" },
  ],
};

const ROLE_ICON: Record<Role, typeof Shield> = {
  admin: Shield,
  teacher: GraduationCap,
  student: BookOpen,
};

export function Header() {
  const { location } = useRouterState();
  const role = useActiveRole();
  const { i18n } = useTranslation();
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefers;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  // Hide header on attempt page (full-focus mode)
  if (location.pathname.includes("/attempt")) return null;

  const nav = NAV_BY_ROLE[role];
  const RoleIcon = ROLE_ICON[role];

  return (
    <header className="glass sticky top-0 z-50 border-b border-border/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="text-lg">◐</span>
          <span>Lumen</span>
          <span
            className={`ml-2 hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase sm:inline-flex ${
              role === "admin"
                ? "bg-foreground text-background"
                : role === "teacher"
                ? "bg-accent/15 text-accent"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <RoleIcon className="h-2.5 w-2.5" />
            {ROLE_LABEL[role]}
          </span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((n) => {
            const active = n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to as "/"}
                className={`text-[13px] transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          {/* Role switcher (demo only) */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <RoleIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{ROLE_LABEL[role]}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="animate-fade-in absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-xl"
              >
                <div className="px-3 py-2 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                  Chuyển vai trò (demo)
                </div>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => {
                  const Icon = ROLE_ICON[r];
                  const isActive = r === role;
                  return (
                    <button
                      key={r}
                      onClick={() => {
                        setActiveRole(r);
                        setMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-colors ${
                        isActive ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/60"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1">{ROLE_LABEL[r]}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-accent" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Chuyển chế độ sáng/tối"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          
          {/* Language Switcher */}
          <div className="relative group">
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Globe className="h-4 w-4" />
            </button>
            <div className="absolute right-0 top-full mt-2 hidden w-40 flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-xl group-hover:flex">
              <button
                onClick={() => i18n.changeLanguage("vi")}
                className={`px-4 py-2.5 text-left text-[13px] transition-colors ${i18n.language === "vi" ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
              >
                Tiếng Việt
              </button>
              <button
                onClick={() => i18n.changeLanguage("zh")}
                className={`px-4 py-2.5 text-left text-[13px] transition-colors ${i18n.language === "zh" ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
              >
                中文 (Giản thể)
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}