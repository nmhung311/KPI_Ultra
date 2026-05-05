import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Tag,
  ShieldCheck,
} from "lucide-react";
import { apiBase } from "@/lib/apiBase";

interface UserData {
  username: string;
  role: string;
  id_telegram?: number | null;
}

/** Chuẩn hóa từng dòng API (hỗ trợ BSON/JSON, key snake_case). */
function normalizeApiUser(raw: Record<string, unknown>): UserData {
  const username = String(raw.username ?? "").trim();
  const role = String(raw.role ?? "").trim();
  const rawId = raw.id_telegram ?? raw.idTelegram;
  let id_telegram: number | null = null;
  if (rawId != null && rawId !== "") {
    const n = typeof rawId === "number" ? rawId : Number(String(rawId).replace(/\s/g, ""));
    if (Number.isFinite(n)) id_telegram = n;
  }
  return { username, role, id_telegram };
}

async function fetchUsersList(): Promise<UserData[]> {
  const API_BASE = apiBase();
  const res = await fetch(`${API_BASE}/api/users`);
  if (!res.ok) throw new Error("Failed to fetch users");
  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => normalizeApiUser(row as Record<string, unknown>));
}

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Nhân sự — KPI Ultra" }] }),
  loader: async () => {
    try {
      const users = await fetchUsersList();
      return { users };
    } catch (e) {
      console.error(e);
      return { users: [] as UserData[] };
    }
  },
  component: AdminUsers,
});

function AdminUsers() {
  const loaderData = Route.useLoaderData();
  const [users, setUsers] = useState<UserData[]>(loaderData.users);

  useEffect(() => {
    setUsers(loaderData.users);
  }, [loaderData.users]);

  useEffect(() => {
    let cancelled = false;
    fetchUsersList()
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"username" | "role" | "id_telegram">("username");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const toggleSort = (key: "username" | "role" | "id_telegram") => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = users;

    // Role filter
    if (roleFilter !== "all") {
      list = list.filter((u: UserData) => u.role === roleFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((u: UserData) => u.username.toLowerCase().includes(q));
    }

    // Sort
    const sorted = [...list].sort((a: UserData, b: UserData) => {
      if (sortKey === "id_telegram") {
        const na =
          a.id_telegram != null && a.id_telegram !== undefined ? Number(a.id_telegram) : -1;
        const nb =
          b.id_telegram != null && b.id_telegram !== undefined ? Number(b.id_telegram) : -1;
        return sortDir === "asc" ? na - nb : nb - na;
      }
      let valA: string;
      let valB: string;

      switch (sortKey) {
        case "username":
          valA = a.username.toLowerCase();
          valB = b.username.toLowerCase();
          break;
        case "role":
          valA = a.role.toLowerCase();
          valB = b.role.toLowerCase();
          break;
        default:
          valA = a.username.toLowerCase();
          valB = b.username.toLowerCase();
          break;
      }

      return sortDir === "asc" ? (valA < valB ? -1 : 1) : valA > valB ? -1 : 1;
    });

    return sorted;
  }, [users, searchQuery, sortKey, sortDir, roleFilter]);

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-accent" /> : <ChevronDown className="h-3 w-3 text-accent" />;
  };

  const handleAdd = () => {
    alert("Chức năng thêm nhân sự đang phát triển");
  };

  const handleEdit = (username: string) => {
    alert(`Chức năng sửa nhân sự ${username} đang phát triển`);
  };

  const handleDelete = async (username: string) => {
    const isConfirmed = window.confirm(
      `Khi xóa user ${username} khỏi hệ thống thì toàn bộ KPI và các data liên quan đến anh ấy đều sẽ biến mất. Bạn có chắc chắn muốn tiếp tục?`
    );
    if (!isConfirmed) return;

    try {
      const API_BASE = "http://localhost:5000";
      const res = await fetch(`${API_BASE}/api/users/${username}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      window.location.reload();
    } catch (err) {
      alert("Xóa nhân sự thất bại!");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;
    const isConfirmed = window.confirm(
      `Khi xóa ${selectedUsers.size} user khỏi hệ thống thì toàn bộ KPI và các data liên quan đến họ đều sẽ biến mất. Bạn có chắc chắn muốn tiếp tục?`
    );
    if (!isConfirmed) return;

    try {
      const API_BASE = "http://localhost:5000";
      const res = await fetch(`${API_BASE}/api/users/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: Array.from(selectedUsers) })
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      window.location.reload();
    } catch (err) {
      alert("Xóa nhiều nhân sự thất bại!");
    }
  };

  const toggleSelectUser = (username: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(username)) {
      newSelected.delete(username);
    } else {
      newSelected.add(username);
    }
    setSelectedUsers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredAndSorted.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredAndSorted.map(u => u.username)));
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[12px] font-medium tracking-widest text-accent uppercase backdrop-blur-md">
          <Users className="h-3.5 w-3.5" /> <span>Quản lý nhân sự</span>
        </div>
        <h1 className="mt-4 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
          Danh sách nhân sự.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Quản lý thông tin tài khoản nhân sự trong hệ thống.
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mt-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm transition-all hover:shadow-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent py-0.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/60 w-40"
            />
          </div>

          {/* Role filter */}
          <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-sm">
            {["all", "Label", "QA", "Label / QA", "Telegram"].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  roleFilter === r
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "all" ? "Tất cả" : r}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground font-medium hidden md:block">
            Hiển thị <span className="text-foreground font-bold">{filteredAndSorted.length}</span> / {users.length} người
          </div>
          
          {selectedUsers.size > 0 && (
            <button onClick={handleBulkDelete} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-100 transition-colors dark:border-red-900/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20">
              <Trash2 className="h-4 w-4" /> Xoá {selectedUsers.size} nhân sự
            </button>
          )}

          <button onClick={handleAdd} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-accent/90 transition-colors">
            <Plus className="h-4 w-4" /> Thêm nhân sự
          </button>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-6 overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-lg"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-[13px] font-medium text-muted-foreground">
              <tr>
                <th className="px-5 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                    checked={filteredAndSorted.length > 0 && selectedUsers.size === filteredAndSorted.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-5 py-4 w-16 text-center">STT</th>
                <th className="px-5 py-4 cursor-pointer select-none" onClick={() => toggleSort("username")}>
                  <div className="flex items-center gap-1.5">
                    Username <SortIcon col="username" />
                  </div>
                </th>
                <th
                  className="min-w-[11rem] px-5 py-4 cursor-pointer select-none text-left font-mono text-xs text-foreground"
                  onClick={() => toggleSort("id_telegram")}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    Telegram ID <SortIcon col="id_telegram" />
                  </div>
                </th>
                <th className="px-5 py-4 cursor-pointer select-none" onClick={() => toggleSort("role")}>
                  <div className="flex items-center gap-1.5">
                    Vai trò <SortIcon col="role" />
                  </div>
                </th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <Users className="h-7 w-7 opacity-50" />
                      </div>
                      <span className="text-base font-medium">Không tìm thấy nhân sự</span>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {filteredAndSorted.map((u, idx) => (
                    <motion.tr
                      key={u.username}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.015 }}
                      className={`group transition-colors hover:bg-muted/30 cursor-pointer ${selectedUsers.has(u.username) ? "bg-accent/5" : ""}`}
                      onClick={() => toggleSelectUser(u.username)}
                    >
                      <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                          checked={selectedUsers.has(u.username)}
                          onChange={() => toggleSelectUser(u.username)}
                        />
                      </td>
                      <td className="px-5 py-4 text-center font-mono text-muted-foreground text-xs">{idx + 1}</td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-foreground">{u.username}</span>
                      </td>
                      <td className="min-w-[11rem] whitespace-nowrap px-5 py-4 font-mono text-sm tabular-nums text-foreground">
                        {u.id_telegram != null && u.id_telegram !== undefined ? String(u.id_telegram) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEdit(u.username)} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(u.username)} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </main>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "Telegram") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-sky-600 dark:text-sky-400">
        Telegram
      </span>
    );
  }
  if (role === "Label / QA") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-violet-600 dark:text-violet-400">
        <Tag className="h-3 w-3" />
        <ShieldCheck className="h-3 w-3" />
        Label / QA
      </span>
    );
  }
  if (role === "QA") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-600 dark:text-amber-400">
        <ShieldCheck className="h-3 w-3" /> QA
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-600 dark:text-emerald-400">
      <Tag className="h-3 w-3" /> Label
    </span>
  );
}