// The only file that talks to the backend. Every request sends the saved login token.
import type { Handoff, HandoffSummary, NewTask, NewUser, Priority, Shift, Status, Task, TaskDetail, TaskEvent, User } from "../types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";
const TOKEN_KEY = "token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Called when the server rejects the saved token (expired or invalid), so the app can log out.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  // FastAPI validation errors are a list like [{ msg: "Field required", ... }].
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the backend running?");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login") onUnauthorized();
    throw new ApiError(res.status, errorMessage(data, res.statusText || "Something went wrong"));
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>("POST", "/auth/login", { email, password }),
  me: () => request<User>("GET", "/users/me"),
  users: () => request<User[]>("GET", "/users"),
  createUser: (data: NewUser) => request<User>("POST", "/users", data),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<null>("POST", "/users/me/password", { current_password: currentPassword, new_password: newPassword }),

  tasks: () => request<Task[]>("GET", "/tasks?limit=200"),
  task: (id: number) => request<TaskDetail>("GET", `/tasks/${id}`),
  createTask: (data: NewTask) => request<Task>("POST", "/tasks", data),
  updateTask: (id: number, data: { title?: string; description?: string | null; priority?: Priority }) =>
    request<Task>("PATCH", `/tasks/${id}`, data),
  // Leaving out assigned_department lets the department follow the new assignee.
  assignTask: (id: number, assignedUserId: number | null) =>
    request<Task>("PUT", `/tasks/${id}/assignment`, { assigned_user_id: assignedUserId }),
  setStatus: (id: number, status: Status) => request<Task>("PUT", `/tasks/${id}/status`, { status }),
  addComment: (id: number, text: string) => request<TaskEvent>("POST", `/tasks/${id}/comments`, { text }),

  currentShift: () => request<Shift | null>("GET", "/shifts/current"),
  startShift: (name: string) => request<Shift>("POST", "/shifts", { name }),
  endShift: (id: number) => request<Handoff>("POST", `/shifts/${id}/end`),

  handoffs: () => request<HandoffSummary[]>("GET", "/handoffs"),
  handoff: (id: number) => request<Handoff>("GET", `/handoffs/${id}`),
  incomingHandoff: () => request<Handoff | null>("GET", "/handoffs/incoming"),
  acknowledge: (id: number) => request<Handoff>("POST", `/handoffs/${id}/acknowledge`),
};
