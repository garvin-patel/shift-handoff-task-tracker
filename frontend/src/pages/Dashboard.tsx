import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Task, Shift, Status } from "../types";
import { Badge } from "../components/Layout";

const ORDER = { High: 0, Medium: 1, Low: 2 };
export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]); const [shift, setShift] = useState<Shift | null>(null);
  const [filter, setFilter] = useState<Status | "Active">("Active"); const [q, setQ] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([api.getTasks(), api.getCurrentShift()]).then(([t, s]) => { setTasks(t); setShift(s); setLoading(false); }); }, []);
  const refresh = async () => { setTasks(await api.getTasks()); setShift(await api.getCurrentShift()); setFilter("Active"); };
  const count = (s: Status) => tasks.filter((t) => t.status === s).length;
  const shown = tasks
    .filter((t) => (filter === "Active" ? t.status !== "Completed" : t.status === filter) && t.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
  async function quickStatus(t: Task, status: Status) {
    const u = await api.updateTask(t.id, { status }); setTasks((all) => all.map((x) => (x.id === u.id ? u : x)));
  }
  return (
    <>
      <div className="page-head">
        <div><h2>Task Dashboard</h2><p className="muted">Current shift: <b>{shift?.name ?? "—"}</b></p></div>
        <Link className="btn" to="/tasks/new">+ New Task</Link>
      </div>
      <div className="stats">
        {(["Open", "In Progress", "Completed"] as Status[]).map((s) => (
          <button key={s} className={`stat ${filter === s ? "on" : ""}`} onClick={() => setFilter(filter === s ? "Active" : s)}>
            <span>{count(s)}</span>{s}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <span className="muted">{filter === "Active" ? "Showing active tasks (completed tasks are hidden)" : `Showing: ${filter}`}</span>
        <span>
          {filter !== "Active" && <button className="ghost small" onClick={() => setFilter("Active")}>Show active</button>}
          {filter !== "Completed" && <button className="ghost small" onClick={() => setFilter("Completed")}>Show completed ({count("Completed")})</button>}
          <button className="ghost small" onClick={async () => { if (!confirm("Delete ALL tasks and handoffs and start empty?")) return; api.clearAll(); await refresh(); }}>Clear all tasks</button>
          <button className="ghost small" onClick={async () => { api.loadSamples(); await refresh(); }}>Load sample tasks</button>
        </span>
      </div>
      <input className="search" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading ? <p>Loading…</p> : shown.length === 0 ? <p className="muted">{filter === "Active" ? tasks.length === 0 ? "No tasks yet. Click + New Task to add one." : "All tasks are completed. Nice work." : "No tasks here."}</p> : (
        <div className="list">
          {shown.map((t) => (
            <div key={t.id} className={`card task p-${t.priority.toLowerCase()}`}>
              <div className="task-main">
                <Link to={`/tasks/${t.id}`} className="task-title">{t.title}</Link>
                <div className="meta"><Badge v={t.priority} /><Badge v={t.status} /><span>→ {t.assignee}</span></div>
              </div>
              <select value={t.status} onChange={(e) => quickStatus(t, e.target.value as Status)}>
                <option>Open</option><option>In Progress</option><option>Completed</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
