import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useAppData } from "../appData";
import { useAuth } from "../auth";
import { PRIORITY_LABEL } from "../format";
import type { Priority, Task } from "../types";
import { useToast } from "./Toast";
import { Icon, Modal } from "./ui";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

export default function NewTaskDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (task: Task) => void;
}) {
  return (
    <Modal open={open} title="New task" onClose={onClose} wide>
      <NewTaskForm onCancel={onClose} onCreated={(task) => { onCreated(task); onClose(); }} />
    </Modal>
  );
}

function NewTaskForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (task: Task) => void }) {
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
      toast(`"${task.title}" added to Open.`);
      onCreated(task);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Room 312 AC not working"
          maxLength={200} autoFocus />
      </label>

      <label className="field">
        <span>Details <em>optional</em></span>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened, who reported it, what's been tried so far" />
      </label>

      <fieldset className="field">
        <legend>Priority</legend>
        <div className="segmented" role="radiogroup">
          {PRIORITIES.map((p) => (
            <label key={p} className={`segment ${priority === p ? "is-on" : ""}`}>
              <input type="radio" name="priority" value={p} checked={priority === p} onChange={() => setPriority(p)} />
              <span className={`prio prio-${p}`}><span className="prio-bars" aria-hidden="true"><i /><i /><i /></span>{PRIORITY_LABEL[p]}</span>
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
                <option key={u.id} value={u.id}>{u.name}{u.usual_shift ? ` · ${u.usual_shift}` : ""}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="field">
            <span>Assign to</span>
            <p className="locked"><Icon name="lock" size={14} /> A supervisor assigns people</p>
          </div>
        )}
      </div>

      <p className="form-note">{shift ? `Logged in the ${shift.name} shift.` : "No shift is running, so it won't be linked to a shift."}</p>
      {error && <div className="form-error" role="alert"><Icon name="alert" size={16} /> {error}</div>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create task"}</button>
      </div>
    </form>
  );
}
