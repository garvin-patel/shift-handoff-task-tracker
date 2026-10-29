import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAppData } from "../appData";
import { useAuth } from "../auth";
import { useToast } from "../components/Toast";
import { Avatar, ConfirmDialog, EmptyState, Icon, PriorityTag, Skeleton, StatusPill } from "../components/ui";
import { PRIORITY_RANK, SHIFT_NAMES, clockTime, fullDate, nextShiftName, plural, timeAgo } from "../format";
import type { Handoff as HandoffT, HandoffSummary, ShiftName, Task } from "../types";

export default function Handoff() {
  const { isSupervisor } = useAuth();
  const { shift, incoming, loaded, refresh } = useAppData();
  const toast = useToast();
  const [history, setHistory] = useState<HandoffSummary[] | null>(null);
  const [unfinished, setUnfinished] = useState<Task[]>([]);
  const [ending, setEnding] = useState(false);
  const [nextName, setNextName] = useState(nextShiftName(shift?.name));
  const [startNext, setStartNext] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadPage = () =>
    Promise.all([api.handoffs(), api.tasks()]).then(([h, t]) => {
      setHistory(h);
      setUnfinished(t.filter((x) => x.status !== "completed").sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]));
    });

  useEffect(() => { loadPage().catch((e) => toast(e.message, "error")); }, [toast]);
  useEffect(() => setNextName(nextShiftName(shift?.name)), [shift?.name]);

  async function act(change: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await change();
      await Promise.all([refresh(), loadPage()]);
      toast(success);
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function endShift() {
    const ended = shift!;
    const ok = await act(async () => {
      await api.endShift(ended.id);
      if (startNext) await api.startShift(nextName);
    }, startNext
      ? `${ended.name} shift ended. ${plural(unfinished.length, "task")} handed to ${nextName}.`
      : `${ended.name} shift ended. ${plural(unfinished.length, "task")} will go to the next shift.`);
    if (ok) setEnding(false);
  }

  if (!loaded) return <Skeleton rows={3} />;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Handoff</h1>
          <p className="subtle">Unfinished tasks move to the next shift when a supervisor ends the current one.</p>
        </div>
      </header>

      <section className="handoff-layout">
        <div className="stack">
          <h2 className="section-title">Handed to this shift</h2>
          {!shift ? (
            <div className="card"><EmptyState icon="clock" title="No shift is running">The next shift sees its handoff here once a supervisor starts it.</EmptyState></div>
          ) : !incoming ? (
            <div className="card"><EmptyState icon="handoff" title="Nothing was handed over">The {shift.name} shift started without a handoff.</EmptyState></div>
          ) : (
            <IncomingCard handoff={incoming} busy={busy}
              onAcknowledge={() => act(() => api.acknowledge(incoming.id), "Handoff acknowledged. The previous shift can see you've got it.")} />
          )}
        </div>

        <div className="stack">
          <h2 className="section-title">This shift</h2>
          <div className="card shift-card">
            {shift ? (
              <>
                <div className="shift-card-head">
                  <span className="live-dot" />
                  <div>
                    <strong>{shift.name} shift</strong>
                    <p className="muted">Started {clockTime(shift.started_at)} · {timeAgo(shift.started_at)}{shift.started_by_user && ` by ${shift.started_by_user.name}`}</p>
                  </div>
                </div>
                <p className="carry-count"><strong>{unfinished.length}</strong> unfinished {unfinished.length === 1 ? "task" : "tasks"} will carry over when it ends.</p>
                {isSupervisor ? (
                  <button className="btn btn-primary btn-block" onClick={() => setEnding(true)}><Icon name="handoff" /> End shift and hand off</button>
                ) : (
                  <p className="hint"><Icon name="lock" size={13} /> A supervisor ends the shift and creates the handoff.</p>
                )}
              </>
            ) : isSupervisor ? (
              <StartShift busy={busy} defaultName={nextName} onStart={(name) => act(() => api.startShift(name), `${name} shift started.`)} />
            ) : (
              <EmptyState icon="clock" title="Waiting for the next shift">A supervisor needs to start it.</EmptyState>
            )}
          </div>
        </div>
      </section>

      <h2 className="section-title">Handoff history</h2>
      {!history ? <Skeleton rows={2} /> : history.length === 0 ? (
        <div className="card"><EmptyState icon="handoff" title="No handoffs yet" /></div>
      ) : (
        <ul className="history">{history.map((h) => <HistoryRow key={h.id} summary={h} />)}</ul>
      )}

      {shift && (
        <ConfirmDialog open={ending} title={`End the ${shift.name} shift?`} confirmLabel="End shift and hand off" busy={busy}
          onConfirm={endShift} onClose={() => setEnding(false)}>
          {unfinished.length === 0 ? (
            <p>Every task is completed, so the handoff will be empty.</p>
          ) : (
            <>
              <p>These {plural(unfinished.length, "unfinished task")} will be handed to the next shift:</p>
              <ul className="mini-list">
                {unfinished.map((t) => <li key={t.id}><PriorityTag priority={t.priority} /> {t.title}</li>)}
              </ul>
            </>
          )}
          <label className="check">
            <input type="checkbox" checked={startNext} onChange={(e) => setStartNext(e.target.checked)} />
            Start the next shift right away
          </label>
          {startNext && (
            <label className="field">
              <span>Next shift</span>
              <select value={nextName} onChange={(e) => setNextName(e.target.value as ShiftName)}>
                {SHIFT_NAMES.map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

function IncomingCard({ handoff: h, busy, onAcknowledge }: { handoff: HandoffT; busy: boolean; onAcknowledge: () => void }) {
  const done = h.tasks.filter((t) => t.status === "completed").length;
  return (
    <div className={`card incoming ${h.acknowledged_at ? "is-acked" : "is-waiting"}`}>
      <div className="incoming-head">
        <div>
          <span className="eyebrow">{h.from_shift.name} → {h.to_shift?.name ?? "next shift"}</span>
          <h3>{plural(h.task_count, "task")} handed over</h3>
          <p className="muted">Ended {clockTime(h.created_at)} · {timeAgo(h.created_at)}{done > 0 && ` · ${done} done since`}</p>
        </div>
      </div>
      {h.tasks.length === 0 ? (
        <p className="muted">The previous shift finished everything.</p>
      ) : (
        <ul className="handoff-tasks">
          {h.tasks.map((t) => (
            <li key={t.id}>
              <Link to={`/tasks/${t.id}`} className={`handoff-task priority-bar-${t.priority}`}>
                <span className="handoff-task-title">{t.title}</span>
                <span className="handoff-task-meta">
                  <PriorityTag priority={t.priority} />
                  <StatusPill status={t.status} />
                  {t.assignee ? <span className="person"><Avatar name={t.assignee.name} size="sm" /> {t.assignee.name}</span> : t.assigned_department && <span className="muted">{t.assigned_department}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {h.acknowledged_at ? (
        <div className="acked">
          <Icon name="check" size={16} />
          <span>Acknowledged by <strong>{h.acknowledged_by_user?.name}</strong> at {clockTime(h.acknowledged_at)}</span>
        </div>
      ) : (
        <button className="btn btn-success btn-block" onClick={onAcknowledge} disabled={busy}>
          <Icon name="check" /> I've reviewed this handoff
        </button>
      )}
    </div>
  );
}

function StartShift({ busy, defaultName, onStart }: { busy: boolean; defaultName: string; onStart: (name: string) => void }) {
  const [name, setName] = useState(defaultName);
  return (
    <div className="start-shift">
      <strong>No shift is running</strong>
      <p className="muted">Starting one links it to the last handoff, so the team can review what was left.</p>
      <div className="inline-form">
        <select value={name} onChange={(e) => setName(e.target.value)} aria-label="Shift name">
          {SHIFT_NAMES.map((n) => <option key={n}>{n}</option>)}
        </select>
        <button className="btn btn-primary" disabled={busy} onClick={() => onStart(name)}><Icon name="play" size={16} /> Start shift</button>
      </div>
    </div>
  );
}

function HistoryRow({ summary: h }: { summary: HandoffSummary }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<HandoffT | null>(null);
  function toggle() {
    setOpen(!open);
    if (!detail) api.handoff(h.id).then(setDetail);
  }
  return (
    <li className={`card history-row ${open ? "is-open" : ""}`}>
      <button className="history-summary" onClick={toggle} aria-expanded={open}>
        <span className="history-shifts"><strong>{h.from_shift.name}</strong> → {h.to_shift?.name ?? <span className="muted">not started</span>}</span>
        <span className="muted" title={fullDate(h.created_at)}>{fullDate(h.created_at)}</span>
        <span>{plural(h.task_count, "task")}</span>
        {h.acknowledged_at ? (
          <span className="pill status-completed"><span className="dot" />Acknowledged by {h.acknowledged_by_user?.name}</span>
        ) : (
          <span className="pill status-open"><span className="dot" />Waiting</span>
        )}
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div className="history-detail">
          {!detail ? <Skeleton rows={1} /> : detail.tasks.length === 0 ? <p className="muted">No tasks were handed over.</p> : (
            <ul className="mini-list">
              {detail.tasks.map((t) => (
                <li key={t.id}><Link to={`/tasks/${t.id}`}>{t.title}</Link> <StatusPill status={t.status} /></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
