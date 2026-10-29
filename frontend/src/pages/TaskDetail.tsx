import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api } from "../api/client";
import { useAppData } from "../appData";
import { useAuth } from "../auth";
import { useToast } from "../components/Toast";
import { Avatar, EmptyState, Icon, PriorityTag, Skeleton, StatusPill } from "../components/ui";
import { PRIORITY_LABEL, STATUS_LABEL, fullDate, plural, timeAgo } from "../format";
import type { Priority, Status, TaskDetail as Detail, TaskEvent, User } from "../types";

const STATUSES: Status[] = ["open", "in_progress", "completed"];

export default function TaskDetail() {
  const id = Number(useParams().id);
  const { user, isSupervisor } = useAuth();
  const { users } = useAppData();
  const toast = useToast();
  const [task, setTask] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(
    () => api.task(id).then(setTask).catch((e) => (e instanceof ApiError && e.status === 404 ? setMissing(true) : toast(e.message, "error"))),
    [id, toast],
  );
  useEffect(() => { load(); }, [load]);

  // Runs a change, shows a message, then reloads so the history is up to date. Returns whether it worked.
  async function run(change: () => Promise<unknown>, success: string) {
    try {
      await change();
      toast(success);
      await load();
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    }
  }

  if (missing) return <EmptyState icon="alert" title="Task not found"><Link to="/">Back to tasks</Link></EmptyState>;
  if (!task) return <Skeleton rows={3} />;

  const canEdit = isSupervisor || task.created_by === user!.id;
  const lockedReopen = task.status === "completed" && !isSupervisor;

  return (
    <div className="detail">
      <Link to="/" className="back-link"><Icon name="back" size={16} /> Tasks</Link>

      <div className="detail-grid">
        <article className={`card task-card priority-bar-${task.priority}`}>
          {editing ? (
            <EditForm task={task} onCancel={() => setEditing(false)}
              onSave={(title, description) => run(() => api.updateTask(task.id, { title, description }), "Task updated.").then((ok) => ok && setEditing(false))} />
          ) : (
            <>
              <div className="task-card-head">
                <h1>{task.title}</h1>
                {canEdit && <button className="icon-btn" onClick={() => setEditing(true)} title="Edit" aria-label="Edit title and details"><Icon name="edit" /></button>}
              </div>
              <div className="task-badges">
                <StatusPill status={task.status} />
                <PriorityTag priority={task.priority} />
                {task.handoff_ids.length > 0 && (
                  <span className="tag tag-handover">Carried over {plural(task.handoff_ids.length, "time")}</span>
                )}
              </div>
              {task.description ? <p className="task-description">{task.description}</p> : <p className="muted">No details added.</p>}
            </>
          )}

          <div className="status-control">
            <span className="control-label">Status</span>
            <div className="segmented">
              {STATUSES.map((s) => {
                const blocked = lockedReopen && s !== "completed";
                return (
                  <button key={s} type="button" className={`segment status-seg-${s} ${task.status === s ? "is-on" : ""}`}
                    disabled={blocked || task.status === s} aria-pressed={task.status === s}
                    title={blocked ? "Only a supervisor can reopen a completed task" : undefined}
                    onClick={() => run(() => api.setStatus(task.id, s), `Marked ${STATUS_LABEL[s].toLowerCase()}.`)}>
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
            {lockedReopen && <p className="hint"><Icon name="lock" size={13} /> Only a supervisor can reopen a completed task.</p>}
          </div>
        </article>

        <aside className="card facts">
          <Fact label="Assigned to">
            {isSupervisor ? (
              <select value={task.assigned_user_id ?? ""} aria-label="Assigned to"
                onChange={(e) => run(() => api.assignTask(task.id, e.target.value ? Number(e.target.value) : null), "Assignment updated.")}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.department ? ` · ${u.department}` : ""}</option>)}
              </select>
            ) : task.assignee ? (
              <span className="person"><Avatar name={task.assignee.name} size="sm" /> {task.assignee.name}</span>
            ) : (
              <span className="muted">Unassigned</span>
            )}
          </Fact>
          <Fact label="Department">{task.assigned_department ?? <span className="muted">None</span>}</Fact>
          <Fact label="Priority">
            {isSupervisor ? (
              <select value={task.priority} aria-label="Priority"
                onChange={(e) => run(() => api.updateTask(task.id, { priority: e.target.value as Priority }), "Priority updated.")}>
                {(["high", "medium", "low"] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            ) : (
              <PriorityTag priority={task.priority} />
            )}
          </Fact>
          <Fact label="Reported by">
            <span className="person"><Avatar name={task.creator.name} size="sm" /> {task.creator.name}</span>
          </Fact>
          <Fact label="Reported"><span title={fullDate(task.created_at)}>{timeAgo(task.created_at)}</span></Fact>
          {task.completed_at && <Fact label="Completed"><span title={fullDate(task.completed_at)}>{timeAgo(task.completed_at)}</span></Fact>}
        </aside>
      </div>

      <section className="card activity">
        <h2>Notes & history</h2>
        <NoteForm onAdd={(text) => run(() => api.addComment(task.id, text), "Note added.")} />
        <ol className="timeline">
          {[...task.events].reverse().map((e) => <EventItem key={e.id} event={e} users={users} />)}
        </ol>
      </section>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function EditForm({ task, onSave, onCancel }: { task: Detail; onSave: (title: string, description: string | null) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim()) onSave(title.trim(), description.trim() || null);
  };
  return (
    <form className="edit-form" onSubmit={submit}>
      <label className="field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus /></label>
      <label className="field"><span>Details</span><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!title.trim()}>Save</button>
      </div>
    </form>
  );
}

function NoteForm({ onAdd }: { onAdd: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    if (await onAdd(text.trim())) setText("");
    setBusy(false);
  }
  return (
    <form className="note-form" onSubmit={submit}>
      <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label="Add a note"
        placeholder="Add a note for the next shift: what you tried, who you called…" />
      <button className="btn btn-primary" disabled={busy || !text.trim()}><Icon name="note" size={16} /> Add note</button>
    </form>
  );
}

// Turns a task_events row into a readable sentence.
function describe(e: TaskEvent, users: User[]): string {
  const name = (id: string | null) => users.find((u) => String(u.id) === id)?.name ?? `user #${id}`;
  const status = (s: string | null) => STATUS_LABEL[s as Status] ?? s;
  const priority = (p: string | null) => PRIORITY_LABEL[p as Priority] ?? p;
  switch (e.action) {
    case "created": return "reported this task";
    case "assigned": return e.new_value ? `assigned it to ${name(e.new_value)}` : "unassigned it";
    case "department_changed": return e.new_value ? `moved it to ${e.new_value}` : "removed the department";
    case "status_changed":
      if (e.old_value === "completed") return `reopened it as ${status(e.new_value)}`;
      if (e.new_value === "completed") return "marked it completed";
      if (e.new_value === "in_progress") return "started working on it";
      return `changed the status to ${status(e.new_value)}`;
    case "priority_changed": return `changed the priority from ${priority(e.old_value)} to ${priority(e.new_value)}`;
    case "title_changed": return `renamed it to “${e.new_value}”`;
    case "description_changed": return "updated the details";
    case "comment": return "added a note";
    default: return e.action.replace(/_/g, " ");
  }
}

function EventItem({ event: e, users }: { event: TaskEvent; users: User[] }) {
  const who = e.user?.name ?? "Someone";
  return (
    <li className={`event event-${e.action}`}>
      <Avatar name={who} size="sm" />
      <div className="event-body">
        <p><strong>{who}</strong> {describe(e, users)} <time title={fullDate(e.created_at)}>{timeAgo(e.created_at)}</time></p>
        {e.action === "comment" && <blockquote>{e.new_value}</blockquote>}
      </div>
    </li>
  );
}
