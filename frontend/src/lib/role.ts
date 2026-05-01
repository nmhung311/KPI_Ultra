import { useEffect, useState } from "react";
import { CURRENT_USER, type User } from "./mock-data";

export type Role = User["role"];

const KEY = "lumen-active-role";

/** Get the active demo role (defaults to CURRENT_USER.role). Mock-only. */
export function getActiveRole(): Role {
  if (typeof window === "undefined") return CURRENT_USER.role;
  const r = localStorage.getItem(KEY) as Role | null;
  return r ?? CURRENT_USER.role;
}

export function setActiveRole(role: Role) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, role);
  window.dispatchEvent(new CustomEvent("lumen:role-change", { detail: role }));
}

/** Reactive hook — re-renders when role changes (cross-tab + same-tab). */
export function useActiveRole(): Role {
  const [role, setRole] = useState<Role>(() => getActiveRole());

  useEffect(() => {
    const onChange = () => setRole(getActiveRole());
    window.addEventListener("storage", onChange);
    window.addEventListener("lumen:role-change", onChange as EventListener);
    // sync once after mount in case SSR returned a different default
    setRole(getActiveRole());
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("lumen:role-change", onChange as EventListener);
    };
  }, []);

  return role;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Quản trị viên",
  teacher: "Giáo viên",
  student: "Học viên",
};

export const ROLE_HOME: Record<Role, "/admin" | "/teacher" | "/student"> = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};