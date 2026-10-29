import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppData } from "../appData";
import { useAuth } from "../auth";
import NewTaskDialog from "../components/NewTaskDialog";
import { useToast } from "../components/Toast";
import { Avatar, EmptyState, Icon, PriorityTag, Skeleton, StatusPill, type IconName } from "../components/ui";
import { PRIORITY_RANK, plural, timeAgo } from "../format";
import type { Status, Task } from "../types";

type View = "board" | "list";

const COLUMNS: { status: Status; title: string }[] = [
  { status: "open", title: "Open" },
  { status: "in_progress", title: "In progress" },
  { status: "completed", title: "Done" },
];
const DONE_PREVIEW = 4;
const VIEW_KEY = "tasks-view";

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "board";
  } catch {
    return "board";
  }
}

// Unfinished tasks: highest priority first, then oldest. Done tasks: most recently finished first.
function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if ((a.status === "completed") !== (b.status === "completed")) return a.status === "completed" ? 1 : -1;
    if (a.status === "completed") return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.created_at.localeCompare(b.created_at);
  });
}

export default function Tasks() {
  const { user, isSupervisor } = useAuth();
  const { shift, incoming, departments } = useAppData();
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>(savedView);
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(false);
  const [department, setDepartment] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.tasks().then(setTasks).catch((e) => setError(e.message));
  }, []);

  function changeView(next: View) {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* the choice just won't be remembered */ }
  }

  const handedOver = useMemo(() => new Set(incoming?.tasks.map((t) => t.id)), [incoming]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortTasks(
      (tasks ?? [])
        .filter((t) => !mine || t.assigned_user_id === user!.id)
        .filter((t) => !department || t.assigned_department === department)
        .filter((t) => !q || `${t.title} ${t.description ?? ""}`.toLowerCase().includes(q)),
    );
  }, [tasks, query, mine, department, user]);

  const count = (status: Status) => tasks?.filter((t) => t.status === status).length ?? 0;
  const filtered = !!(query || mine || department);

  async function changeStatus(task: Task, status: Status) {
    try {
      const updated = await api.setStatus(task.id, status);
      setTasks((all) => all!.map((t) => (t.id === updated.id ? updated : t)));
      toast(status === "completed" ? `"${task.title}" marked done.` : status === "in_progress" ? `Started "${task.title}".` : `Reopened "${task.title}".`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const cardProps = (t: Task) => ({
    task: t,
    handedOver: handedOver.has(t.id),
    canReopen: isSupervisor,
    onStatus: (s: Status) => changeStatus(t, s),
  });

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="subtle">
            {shift ? `${shift.name} shift` : "No shift running"}
            {tasks && ` · ${count("open")} open · ${count("in_progress")} in progress`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" /> New task</button>
      </header>

      {incoming && !incoming.acknowledged_at && (
        <Link to="/handoff" className="notice">
          <Icon name="handoff" />
          <span><strong>{incoming.from_shift.name} shift handed over {plural(incoming.task_count, "task")}.</strong> Review and confirm you've got it.</span>
          <span className="notice-cta">Review <Icon name="chevron" size={14} /></span>
        </Link>
      )}

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search tasks" />
        </label>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <button className={`chip ${mine ? "is-on" : ""}`} aria-pressed={mine} onClick={() => setMine(!mine)}>My tasks</button>
        <div className="view-toggle" role="group" aria-label="View">
          {(["board", "list"] as View[]).map((v) => (
            <button key={v} className={view === v ? "is-on" : ""} aria-pressed={view === v} onClick={() => changeView(v)}
              title={v === "board" ? "Board" : "List"}>
              <Icon name={v as IconName} size={16} /><span>{v === "board" ? "Board" : "List"}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="panel"><EmptyState icon="alert" title="Couldn't load tasks">{error}</EmptyState></div>
      ) : !tasks ? (
        <Skeleton rows={3} />
      ) : filtered && shown.length === 0 ? (
        <div className="panel"><EmptyState icon="search" title="No matching tasks">Try a different search or filter.</EmptyState></div>
      ) : view === "board" ? (
        <div className="board">
          {COLUMNS.map((c) => <Column key={c.status} column={c} tasks={shown.filter((t) => t.status === c.status)} cardProps={cardProps} />)}
        </div>
      ) : (
        <TaskTable tasks={shown} cardProps={cardProps} />
      )}

      <NewTaskDialog open={creating} onClose={() => setCreating(false)} onCreated={(t) => setTasks((all) => [t, ...(all ?? [])])} />
    </>
  );
}

type CardProps = { task: Task; handedOver: boolean; canReopen: boolean; onStatus: (s: Status) => void };

function Column({ column, tasks, cardProps }: { column: { status: Status; title: string }; tasks: Task[]; cardProps: (t: Task) => CardProps }) {
  const [expanded, setExpanded] = useState(false);
  const isDone = column.status === "completed";
  const visible = isDone && !expanded ? tasks.slice(0, DONE_PREVIEW) : tasks;
  return (
    <section className={`column column-${column.status}`} aria-label={column.title}>
      <header className="column-head">
        <span className="dot" />
        <h2>{column.title}</h2>
        <span className="count">{tasks.length}</span>
      </header>
      <div className="column-body">
        {tasks.length === 0 ? (
          <p className="column-empty">{isDone ? "Nothing finished yet" : "Nothing here"}</p>
        ) : (
          visible.map((t) => <TaskCard key={t.id} {...cardProps(t)} />)
        )}
        {isDone && tasks.length > DONE_PREVIEW && (
          <button className="link-btn" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show fewer" : `Show ${tasks.length - DONE_PREVIEW} more`}
          </button>
        )}
      </div>
    </section>
  );
}

function nextAction(t: Task, canReopen: boolean): { label: string; icon: IconName; to: Status } | null {
  if (t.status === "open") return { label: "Start", icon: "play", to: "in_progress" };
  if (t.status === "in_progress") return { label: "Mark done", icon: "check", to: "completed" };
  return canReopen ? { label: "Reopen", icon: "undo", to: "open" } : null;
}

function TaskCard({ task: t, handedOver, canReopen, onStatus }: CardProps) {
  const nav = useNavigate();
  const action = nextAction(t, canReopen);
  return (
    <article className={`task-card prio-edge-${t.priority} ${t.status === "completed" ? "is-done" : ""}`} onClick={() => nav(`/tasks/${t.id}`)}>
      <div className="card-tags">
        <PriorityTag priority={t.priority} />
        {handedOver && <span className="tag tag-handover">Handed over</span>}
      </div>
      <Link to={`/tasks/${t.id}`} className="card-title" onClick={(e) => e.stopPropagation()}>{t.title}</Link>
      <div className="card-foot">
        <span className="card-meta" title={new Date(t.created_at).toLocaleString()}>
          {t.assigned_department && <span>{t.assigned_department}</span>}
          <span>{t.status === "completed" && t.completed_at ? `Done ${timeAgo(t.completed_at)}` : timeAgo(t.created_at)}</span>
        </span>
        {t.assignee ? <Avatar name={t.assignee.name} size="sm" /> : <span className="avatar avatar-sm avatar-empty" title="Unassigned">?</span>}
      </div>
      {action && (
        <button className="card-action" onClick={(e) => { e.stopPropagation(); onStatus(action.to); }}>
          <Icon name={action.icon} size={14} /> {action.label}
        </button>
      )}
    </article>
  );
}

function TaskTable({ tasks, cardProps }: { tasks: Task[]; cardProps: (t: Task) => CardProps }) {
  const nav = useNavigate();
  if (tasks.length === 0) return <div className="panel"><EmptyState icon="check" title="No tasks yet">New problems can be logged with New task.</EmptyState></div>;
  return (
    <div className="panel table-wrap">
      <table className="table">
        <thead>
          <tr><th>Task</th><th>Priority</th><th>Owner</th><th>Status</th><th>Reported</th><th aria-label="Actions" /></tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const { handedOver, canReopen, onStatus } = cardProps(t);
            const action = nextAction(t, canReopen);
            return (
              <tr key={t.id} onClick={() => nav(`/tasks/${t.id}`)} className={t.status === "completed" ? "is-done" : ""}>
                <td>
                  <Link to={`/tasks/${t.id}`} className="row-title" onClick={(e) => e.stopPropagation()}>{t.title}</Link>
                  <span className="row-sub">{t.assigned_department ?? "No department"}{handedOver && " · Handed over"}</span>
                </td>
                <td><PriorityTag priority={t.priority} /></td>
                <td>{t.assignee ? <span className="person"><Avatar name={t.assignee.name} size="sm" /> {t.assignee.name}</span> : <span className="subtle">Unassigned</span>}</td>
                <td><StatusPill status={t.status} /></td>
                <td className="subtle">{timeAgo(t.created_at)}</td>
                <td className="row-action">
                  {action && <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); onStatus(action.to); }}>{action.label}</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
