import { useEffect, useRef, useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { AppDataProvider, useAppData } from "../appData";
import { useAuth } from "../auth";
import { clockTime } from "../format";
import { useToast } from "./Toast";
import { Avatar, Icon, Logo, Modal } from "./ui";

export default function Layout() {
  return (
    <AppDataProvider>
      <Shell />
    </AppDataProvider>
  );
}

function Shell() {
  const { shift, incoming, refresh } = useAppData();
  const { pathname } = useLocation();
  const [changingPassword, setChangingPassword] = useState(false);
  const handoffWaiting = !!incoming && !incoming.acknowledged_at;

  // Re-check the shift and handoff on every page change, since teammates change them too.
  useEffect(() => {
    refresh().catch(() => {});
  }, [pathname, refresh]);

  const links = (
    <>
      <NavLink to="/" end className="nav-link"><Icon name="board" /><span>Tasks</span></NavLink>
      <NavLink to="/handoff" className="nav-link">
        <Icon name="handoff" /><span>Handoff</span>
        {handoffWaiting && <span className="nav-badge" aria-label="New handoff to review">New</span>}
      </NavLink>
      <NavLink to="/team" className="nav-link"><Icon name="team" /><span>Team</span></NavLink>
    </>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand"><Logo /><span>Shift Handoff</span></NavLink>
        <nav className="nav" aria-label="Main">{links}</nav>
        <div className="sidebar-foot">
          <div className={`shift-status ${shift ? "is-live" : ""}`}>
            <span className="live-dot" />
            <div>
              <strong>{shift ? `${shift.name} shift` : "No shift running"}</strong>
              <span>{shift ? `Since ${clockTime(shift.started_at)}` : "A supervisor starts the next one"}</span>
            </div>
          </div>
          <UserMenu onChangePassword={() => setChangingPassword(true)} />
        </div>
      </aside>

      <header className="mobile-bar">
        <NavLink to="/" className="brand"><Logo /><span>Shift Handoff</span></NavLink>
        <span className={`shift-chip ${shift ? "" : "is-off"}`}>{shift ? `${shift.name} shift` : "No shift"}</span>
        <UserMenu compact onChangePassword={() => setChangingPassword(true)} />
      </header>

      <main className="main">
        <div className="main-inner"><Outlet /></div>
      </main>
      <nav className="tabbar" aria-label="Main">{links}</nav>

      <ChangePasswordDialog open={changingPassword} onClose={() => setChangingPassword(false)} />
    </div>
  );
}

function UserMenu({ compact, onChangePassword }: { compact?: boolean; onChangePassword: () => void }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current?.contains(e.target as Node) || setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const detail = [user!.role === "supervisor" ? "Supervisor" : user!.department, user!.usual_shift].filter(Boolean).join(" · ");

  return (
    <div className={`user-menu ${compact ? "is-compact" : ""}`} ref={ref}>
      <button className="user-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <Avatar name={user!.name} size={compact ? "sm" : "md"} />
        {!compact && (
          <span className="user-text"><strong>{user!.name}</strong><small>{detail}</small></span>
        )}
        {!compact && <Icon name="chevronDown" size={16} />}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head"><strong>{user!.name}</strong><span>{user!.email}</span></div>
          <button role="menuitem" onClick={() => { setOpen(false); onChangePassword(); }}><Icon name="key" size={16} /> Change password</button>
          <button role="menuitem" onClick={() => { logout(); nav("/login"); }}><Icon name="logout" size={16} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setCurrent(""); setNext(""); setConfirm(""); setError(""); }
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setError("Use at least 8 characters for the new password.");
    if (next !== confirm) return setError("The new passwords don't match.");
    setBusy(true);
    setError("");
    try {
      await api.changePassword(current, next);
      toast("Password changed.");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Change password" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field"><span>Current password</span>
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
        </label>
        <label className="field"><span>New password</span>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          <small className="field-help">At least 8 characters.</small>
        </label>
        <label className="field"><span>Confirm new password</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        {error && <div className="form-error" role="alert"><Icon name="alert" size={16} /> {error}</div>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
        </div>
      </form>
    </Modal>
  );
}
