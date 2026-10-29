import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppData } from "../appData";
import { useAuth } from "../auth";
import { useToast } from "../components/Toast";
import { Avatar, EmptyState, Icon, PriorityTag, Skeleton, StatusPill } from "../components/ui";
import { PRIORITY_RANK, firstName, greeting, plural, timeAgo } from "../format";
import type { Status, Task } from "../types";

type View = "active" | Status;

const TILES: { view: View; label: string }[] = [
  { view: "open", label: "Open" },
  { view: "in_progress", label: "In progress" },
  { view: "completed", label: "Completed" },
];

export default function Dashboard() {
  const { user, isSupervisor } = useAuth();
  const { shift, incoming, departments } = useAppData();
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("active");
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(false);
  const [department, setDepartment] = useState("");

  useEffect(() => {
    api.tasks().then(setTasks).catch((e) => setError(e.message));
  }, []);

  const handedOver = useMemo(() => new Set(incoming?.tasks.map((t) => t.id)), [incoming]);
  const count = (status: Status) => tasks?.filter((t) => t.status === status).length ?? 0;
  const urgent = tasks?.filter((t) => t.priority === "high" && t.status !== "completed").length ?? 0;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tasks ?? [])
      .filter((t) => (view === "active" ? t.status !== "completed" : t.status === view))
      .filter((t) => !mine || t.assigned_user_id === user!.id)
      .filter((t) => !department || t.assigned_department === department)
      .filter((t) => !q || `${t.title} ${t.description ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) =>
        view === "completed"
          ? (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
          : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.created_at.localeCompare(b.created_at),
      );
  }, [tasks, view, query, mine, department, user]);

  async function changeStatus(task: Task, status: Status) {
    try {
      const updated = await api.setStatus(task.id, status);
      setTasks((all) => all!.map((t) => (t.id === updated.id ? updated : t)));
      toast(`"${task.title}" is now ${status === "in_progress" ? "in progress" : status}.`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const filtered = mine || department || query;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting()}, {firstName(user!.name)}</h1>
          <p className="muted">
            {shift
              ? `${shift.name} shift · started ${timeAgo(shift.started_at)}${shift.started_by_user ? ` by ${shift.started_by_user.name}` : ""}`
              : "No shift is running right now."}
          </p>
        </div>
        <Link className="btn btn-primary" to="/tasks/new"><Icon name="plus" /> New task</Link>
      </div>

      {incoming && !incoming.acknowledged_at && (
        <Link to="/handoff" className="banner">
          <span className="banner-icon"><Icon name="handoff" /></span>
          <span>
            <strong>{incoming.from_shift.name} shift handed over {plural(incoming.task_count, "unfinished task")}.</strong>
            <span> Review them and confirm you've got it.</span>
          </span>
          <span className="banner-cta">Review <Icon name="chevron" size={16} /></span>
        </Link>
      )}

      <div className="tiles">
        {TILES.map(({ view: v, label }) => (
          <button key={v} className={`tile tile-${v} ${view === v ? "is-on" : ""}`} aria-pressed={view === v}
            onClick={() => setView(view === v ? "active" : v)}>
            <span className="tile-value">{tasks ? count(v as Status) : "–"}</span>
            <span className="tile-label">{label}</span>
          </button>
        ))}
        <div className="tile tile-urgent" aria-live="polite">
          <span className="tile-value">{tasks ? urgent : "–"}</span>
          <span className="tile-label">High priority, not done</span>
        </div>
      </div>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" />
          <input type="search" placeholder="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tasks" />
        </label>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <button className={`chip ${mine ? "is-on" : ""}`} aria-pressed={mine} onClick={() => setMine(!mine)}>
          Assigned to me
        </button>
      </div>

      <div className="list-head">
        <span>{view === "active" ? "Active tasks" : TILES.find((t) => t.view === view)!.label}</span>
        {tasks && <span className="muted">{plural(shown.length, "task")}</span>}
      </div>

      {error ? (
        <EmptyState icon="alert" title="Couldn't load tasks">{error}</EmptyState>
      ) : !tasks ? (
        <Skeleton rows={4} />
      ) : shown.length === 0 ? (
        filtered ? (
          <EmptyState icon="search" title="No matching tasks">Try a different search or filter.</EmptyState>
        ) : view === "active" ? (
          <EmptyState icon="check" title="All clear">Every task is done. New problems can be logged with New task.</EmptyState>
        ) : (
          <EmptyState icon="tasks" title="Nothing here yet" />
        )
      ) : (
        <ul className="task-list">
          {shown.map((t) => (
            <TaskRow key={t.id} task={t} handedOver={handedOver.has(t.id)} canReopen={isSupervisor}
              onStatus={(s) => changeStatus(t, s)} />
          ))}
        </ul>
      )}
    </>
  );
}

function TaskRow({ task: t, handedOver, canReopen, onStatus }: {
  task: Task; handedOver: boolean; canReopen: boolean; onStatus: (s: Status) => void;
}) {
  const nav = useNavigate();
  const action =
    t.status === "open" ? { label: "Start", icon: "play" as const, to: "in_progress" as const }
    : t.status === "in_progress" ? { label: "Complete", icon: "check" as const, to: "completed" as const }
    : canReopen ? { label: "Reopen", icon: "undo" as const, to: "open" as const }
    : null;

  return (
    <li className={`task-row priority-bar-${t.priority} ${t.status === "completed" ? "is-done" : ""}`}
      onClick={() => nav(`/tasks/${t.id}`)}>
      <div className="task-main">
        <div className="task-title-line">
          <Link to={`/tasks/${t.id}`} className="task-title" onClick={(e) => e.stopPropagation()}>{t.title}</Link>
          {handedOver && <span className="tag tag-handover">Handed over</span>}
        </div>
        <div className="task-meta">
          <PriorityTag priority={t.priority} />
          {t.assigned_department && <span>{t.assigned_department}</span>}
          <span className="assignee">
            {t.assignee ? <><Avatar name={t.assignee.name} size="sm" /> {t.assignee.name}</> : <span className="muted">Unassigned</span>}
          </span>
          <span className="muted" title={new Date(t.created_at).toLocaleString()}>
            <Icon name="clock" size={14} /> {t.status === "completed" && t.completed_at ? `Done ${timeAgo(t.completed_at)}` : `Reported ${timeAgo(t.created_at)}`}
          </span>
        </div>
      </div>
      <div className="task-side">
        <StatusPill status={t.status} />
        {action && (
          <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); onStatus(action.to); }}>
            <Icon name={action.icon} size={15} /> {action.label}
          </button>
        )}
      </div>
    </li>
  );
}
