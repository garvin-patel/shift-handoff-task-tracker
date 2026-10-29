import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import type { Task, Status, Priority } from "../types";
import { Badge, fmt } from "../components/Layout";

export default function TaskDetail() {
  const id = Number(useParams().id); const [t, setT] = useState<Task | null>(null); const [err, setErr] = useState("");
  useEffect(() => { api.getTask(id).then(setT).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p className="error">{err}</p>;
  if (!t) return <p>Loading…</p>;
  const upd = async (p: Partial<Task>) => setT(await api.updateTask(t.id, p));
  return (
    <div className="detail">
      <Link to="/" className="muted">← Back to dashboard</Link>
      <div className="card">
        <h2>{t.title}</h2>
        <div className="meta"><Badge v={t.priority} /><Badge v={t.status} /><span>Created by {t.createdBy} · {fmt(t.createdAt)}</span></div>
        <p>{t.description || <i className="muted">No description</i>}</p>
        <div className="row">
          <label>Status<select value={t.status} onChange={(e) => upd({ status: e.target.value as Status })}><option>Open</option><option>In Progress</option><option>Completed</option></select></label>
          <label>Priority<select value={t.priority} onChange={(e) => upd({ priority: e.target.value as Priority })}><option>Low</option><option>Medium</option><option>High</option></select></label>
          <label>Assigned to<input defaultValue={t.assignee} onBlur={(e) => e.target.value !== t.assignee && upd({ assignee: e.target.value })} /></label>
        </div>
        {t.status !== "Completed" && <button onClick={() => upd({ status: "Completed" })}>✓ Mark Completed</button>}
      </div>
      <div className="card">
        <h3>Task History</h3>
        <ul className="timeline">{t.history.map((h, i) => <li key={i}><b>{h.action}</b><span className="muted"> — {h.by}, {fmt(h.at)}</span></li>)}</ul>
      </div>
    </div>
  );
}
