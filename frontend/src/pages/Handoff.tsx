import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Handoff as H, Shift, Task } from "../types";
import { Badge, fmt } from "../components/Layout";

export default function Handoff() {
  const [shift, setShift] = useState<Shift | null>(null); const [handoffs, setH] = useState<H[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]); const [next, setNext] = useState("Morning Shift");
  const reload = () => Promise.all([api.getCurrentShift(), api.getHandoffs(), api.getTasks()]).then(([s, h, t]) => { setShift(s); setH(h); setTasks(t); });
  useEffect(() => { reload(); }, []);
  const unfinished = tasks.filter((t) => t.status !== "Completed");
  async function endShift() {
    if (!confirm(`End ${shift?.name}? ${unfinished.length} unfinished task(s) will carry forward to ${next}.`)) return;
    await api.endShift(next); reload();
  }
  const pending = handoffs.find((h) => !h.acknowledgedBy);
  return (
    <>
      <h2>Shift Handoff</h2>
      {pending && (
        <div className="card handoff-new">
          <h3>Incoming handoff: {pending.fromShiftName} → {pending.toShiftName}</h3>
          <p className="muted">{pending.taskIds.length} unfinished task(s) carried forward · {fmt(pending.createdAt)}</p>
          <ul className="plain">{pending.taskIds.map((id) => { const t = tasks.find((x) => x.id === id); return t && (
            <li key={id}><Link to={`/tasks/${id}`}>{t.title}</Link> <Badge v={t.priority} /> <Badge v={t.status} /> <span className="muted">→ {t.assignee}</span></li>); })}</ul>
          <button onClick={async () => { await api.acknowledge(pending.id); reload(); }}>✓ I have reviewed this handoff</button>
        </div>
      )}
      <div className="card">
        <h3>Current shift: {shift?.name ?? "none"}</h3>
        <p>{unfinished.length} unfinished task(s) will be carried to the next shift.</p>
        <div className="row">
          <label>Next shift<select value={next} onChange={(e) => setNext(e.target.value)}><option>Morning Shift</option><option>Day Shift</option><option>Evening Shift</option><option>Night Shift</option></select></label>
        </div>
        <button className="danger" onClick={endShift} disabled={!shift}>End Shift & Create Handoff</button>
      </div>
      <div className="card">
        <h3>Handoff History</h3>
        {handoffs.length === 0 ? <p className="muted">No handoffs yet.</p> : (
          <table><thead><tr><th>From → To</th><th>Tasks</th><th>Created</th><th>Acknowledged</th></tr></thead>
            <tbody>{handoffs.map((h) => <tr key={h.id}><td>{h.fromShiftName} → {h.toShiftName}</td><td>{h.taskIds.length}</td><td>{fmt(h.createdAt)}</td>
              <td>{h.acknowledgedBy ? `${h.acknowledgedBy}, ${fmt(h.acknowledgedAt!)}` : <Badge v="Pending" />}</td></tr>)}</tbody></table>
        )}
      </div>
      <button className="ghost" onClick={() => { if (!confirm("Delete ALL tasks and handoffs and start empty?")) return; api.clearAll(); reload(); }}>Clear all tasks</button>
    </>
  );
}
