/** Gọi API Flask: trình duyệt dùng localhost; SSR (Node) dùng 127.0.0.1 vì stack Docker chạy host network. */
export function apiBase(): string {
  return typeof window === "undefined"
    ? "http://127.0.0.1:5000"
    : "http://localhost:5000";
}
