// API layer. Until the FastAPI backend (Sadbhab) is ready, a mock stored in
// localStorage stands in. Set VITE_API_URL to switch every call to the real REST API.
import type { Task, Shift, Handoff, User, Status, Priority } from "../types";
const API_URL = import.meta.env.VITE_API_URL as string | undefined;

async function http<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(API_URL + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
}

// ---------- mock backend ----------
interface DB { tasks: Task[]; shifts: Shift[]; handoffs: Handoff[]; nextId: number; }
const USERS: (User & { password: string })[] = [
  { id: 1, name: "Arjun Lekhak", username: "arjun", password: "1234", role: "employee" },
  { id: 2, name: "Sadbhab Ghimire", username: "sadbhab", password: "1234", role: "employee" },
  { id: 3, name: "Garvin Patel", username: "garvin", password: "1234", role: "supervisor" },
];
const now = () => new Date().toISOString();
function seed(): DB {
  const t = (id: number, title: string, description: string, priority: Priority, status: Status, assignee: string): Task => ({
    id, title, description, priority, status, assignee, createdBy: "Sadbhab Ghimire",
    createdAt: now(), shiftId: 1, history: [{ at: now(), by: "Sadbhab Ghimire", action: "Created task" }],
  });
  return {
    nextId: 10,
    shifts: [{ id: 1, name: "Evening Shift", startedAt: now(), startedBy: "Sadbhab Ghimire" }],
    handoffs: [],
    tasks: [
      t(1, "Room 312 AC not working", "Guest reported AC failure at 8:00 PM. Maintenance contacted at 8:10 PM.", "High", "In Progress", "Maintenance"),
      t(2, "Restock towels on floor 2", "Housekeeping cart is empty.", "Medium", "Open", "Housekeeping"),
      t(3, "Late checkout for Room 108", "Approved until 1 PM.", "Low", "Completed", "Front Desk"),
    ],
  };
}
const load = (): DB => JSON.parse(localStorage.getItem("mockdb") || "null") ?? seed();
const save = (db: DB) => localStorage.setItem("mockdb", JSON.stringify(db));
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 150));
const me = () => JSON.parse(localStorage.getItem("user") || "null") as User | null;

export const api = {
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    if (API_URL) return http("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
    const u = USERS.find((x) => x.username === username && x.password === password);
    if (!u) throw new Error("Invalid username or password");
    const { password: _, ...user } = u;
    return delay({ token: "mock-token", user });
  },
  async getTasks(): Promise<Task[]> {
    if (API_URL) return http("/tasks");
    return delay(load().tasks);
  },
  async getTask(id: number): Promise<Task> {
    if (API_URL) return http(`/tasks/${id}`);
    const t = load().tasks.find((x) => x.id === id);
    if (!t) throw new Error("Task not found");
    return delay(t);
  },
  async createTask(data: Pick<Task, "title" | "description" | "priority" | "assignee">): Promise<Task> {
    if (API_URL) return http("/tasks", { method: "POST", body: JSON.stringify(data) });
    const db = load(); const by = me()?.name ?? "Unknown";
    const shift = db.shifts.find((s) => !s.endedAt);
    const task: Task = { ...data, id: db.nextId++, status: "Open", createdBy: by, createdAt: now(),
      shiftId: shift?.id ?? 0, history: [{ at: now(), by, action: "Created task" }] };
    db.tasks.unshift(task); save(db); return delay(task);
  },
  async updateTask(id: number, patch: Partial<Pick<Task, "status" | "priority" | "assignee">>): Promise<Task> {
    if (API_URL) return http(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    const db = load(); const t = db.tasks.find((x) => x.id === id)!; const by = me()?.name ?? "Unknown";
    for (const [k, v] of Object.entries(patch)) {
      const old = (t as any)[k];
      if (old !== v) { (t as any)[k] = v; t.history.push({ at: now(), by, action: `Changed ${k}: ${old} → ${v}` }); }
    }
    save(db); return delay(t);
  },
  async getCurrentShift(): Promise<Shift | null> {
    if (API_URL) return http("/shifts/current");
    return delay(load().shifts.find((s) => !s.endedAt) ?? null);
  },
  // Ends the current shift: backend collects every unfinished task into a handoff.
  async endShift(nextShiftName: string): Promise<Handoff> {
    if (API_URL) return http("/shifts/end", { method: "POST", body: JSON.stringify({ next_shift_name: nextShiftName }) });
    const db = load(); const by = me()?.name ?? "Unknown";
    const cur = db.shifts.find((s) => !s.endedAt);
    if (!cur) throw new Error("No active shift");
    cur.endedAt = now();
    const open = db.tasks.filter((t) => t.status !== "Completed");
    const next: Shift = { id: db.nextId++, name: nextShiftName, startedAt: now(), startedBy: by };
    db.shifts.push(next);
    const h: Handoff = { id: db.nextId++, fromShiftId: cur.id, fromShiftName: cur.name, toShiftName: next.name,
      createdAt: now(), taskIds: open.map((t) => t.id) };
    open.forEach((t) => { t.shiftId = next.id; t.history.push({ at: now(), by: "System", action: `Carried forward: ${cur.name} → ${next.name}` }); });
    db.handoffs.unshift(h); save(db); return delay(h);
  },
  async getHandoffs(): Promise<Handoff[]> {
    if (API_URL) return http("/handoffs");
    return delay(load().handoffs);
  },
  async acknowledge(id: number): Promise<Handoff> {
    if (API_URL) return http(`/handoffs/${id}/acknowledge`, { method: "POST" });
    const db = load(); const h = db.handoffs.find((x) => x.id === id)!;
    h.acknowledgedBy = me()?.name; h.acknowledgedAt = now(); save(db); return delay(h);
  },
  // Clears every task, shift and handoff, and starts a fresh Evening Shift. Saved, so a refresh keeps it empty.
  clearAll() {
    const db = seed(); db.tasks = []; db.handoffs = []; save(db);
  },
  // Puts the sample hotel tasks (Room 312 etc.) back.
  loadSamples() { save(seed()); },
};
