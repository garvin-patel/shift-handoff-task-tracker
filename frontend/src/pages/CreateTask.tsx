import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Priority } from "../types";

export default function CreateTask() {
  const nav = useNavigate();
  const [f, setF] = useState({ title: "", description: "", priority: "Medium" as Priority, assignee: "" });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.title.trim().length < 3) return setError("Title must be at least 3 characters.");
    const t = await api.createTask(f); nav(`/tasks/${t.id}`);
  }
  return (
    <form className="card form" onSubmit={submit}>
      <h2>Create Task</h2>
      <label>Title *<input value={f.title} onChange={set("title")} placeholder="e.g. Room 312 AC not working" required /></label>
      <label>Description<textarea rows={4} value={f.description} onChange={set("description")} placeholder="What happened, what was tried…" /></label>
      <div className="row">
        <label>Priority<select value={f.priority} onChange={set("priority")}><option>Low</option><option>Medium</option><option>High</option></select></label>
        <label>Assign to (person or department)<input value={f.assignee} onChange={set("assignee")} placeholder="e.g. Maintenance" required /></label>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="actions"><button type="button" className="ghost" onClick={() => nav(-1)}>Cancel</button><button>Create Task</button></div>
    </form>
  );
}
