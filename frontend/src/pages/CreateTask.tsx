import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppData } from "../appData";
import { useAuth } from "../auth";
import { useToast } from "../components/Toast";
import { Icon } from "../components/ui";
import { PRIORITY_LABEL } from "../format";
import type { Priority } from "../types";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

export default function CreateTask() {
  const nav = useNavigate();
  const toast = useToast();
  const { isSupervisor } = useAuth();
  const { shift, users, departments } = useAppData();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [department, setDepartment] = useState("");
  const [assignee, setAssignee] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const people = users.filter((u) => !department || u.department === department);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the task a short title.");
    setBusy(true);
    setError("");
    try {
      const task = await api.createTask({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assigned_department: department || null,
        ...(assignee ? { assigned_user_id: Number(assignee) } : {}),
      });
      toast("Task created.");
      nav(`/tasks/${task.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <Link to="/" className="back-link"><Icon name="back" size={16} /> Tasks</Link>
      <form className="card form" onSubmit={submit}>
        <h1>New task</h1>
        <p className="muted">
          {shift ? `It will be logged in the ${shift.name} shift.` : "No shift is running, so it won't be linked to a shift."}
        </p>

        <label className="field">
          <span>What needs attention? <em>Required</em></span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Room 312 AC not working"
            maxLength={200} autoFocus />
        </label>

        <label className="field">
          <span>Details</span>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened, who reported it, what's been tried so far…" />
        </label>

        <fieldset className="field">
          <legend>Priority</legend>
          <div className="segmented" role="radiogroup">
            {PRIORITIES.map((p) => (
              <label key={p} className={`segment segment-${p} ${priority === p ? "is-on" : ""}`}>
                <input type="radio" name="priority" value={p} checked={priority === p} onChange={() => setPriority(p)} />
                {PRIORITY_LABEL[p]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field-row">
          <label className="field">
            <span>Department</span>
            <select value={department} onChange={(e) => { setDepartment(e.target.value); setAssignee(""); }}>
              <option value="">No department</option>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          {isSupervisor ? (
            <label className="field">
              <span>Assign to</span>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Nobody yet</option>
                {people.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}{u.department && !department ? ` · ${u.department}` : ""}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="field field-note">
              <span>Assign to</span>
              <p><Icon name="lock" size={14} /> A supervisor assigns tasks to a person.</p>
            </div>
          )}
        </div>

        {error && <div className="form-error" role="alert"><Icon name="alert" size={16} /> {error}</div>}
        <div className="form-actions">
          <Link to="/" className="btn btn-ghost">Cancel</Link>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create task"}</button>
        </div>
      </form>
    </div>
  );
}
