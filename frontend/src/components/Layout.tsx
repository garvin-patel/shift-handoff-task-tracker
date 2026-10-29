import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppDataProvider, useAppData } from "../appData";
import { useAuth } from "../auth";
import { timeAgo } from "../format";
import { Avatar, Icon, Logo } from "./ui";

export default function Layout() {
  return (
    <AppDataProvider>
      <Shell />
    </AppDataProvider>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const { shift, incoming, refresh } = useAppData();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const handoffWaiting = !!incoming && !incoming.acknowledged_at;

  // Re-check the shift and handoff on every page change, since teammates change them too.
  useEffect(() => {
    refresh().catch(() => {});
  }, [pathname, refresh]);

  const links = (
    <>
      <NavLink to="/" end className="nav-link">
        <Icon name="tasks" /> Tasks
      </NavLink>
      <NavLink to="/handoff" className="nav-link">
        <Icon name="handoff" /> Handoff
        {handoffWaiting && <span className="nav-dot" aria-label="New handoff to review" />}
      </NavLink>
    </>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <Logo /> <span>Shift Handoff</span>
          </NavLink>
          <nav className="nav-desktop" aria-label="Main">{links}</nav>
          <div className="topbar-right">
            {shift ? (
              <span className="shift-chip" title={`Started ${timeAgo(shift.started_at)}`}>
                <span className="live-dot" /> {shift.name} shift
              </span>
            ) : (
              <span className="shift-chip shift-chip-off">No active shift</span>
            )}
            <div className="user-chip">
              <Avatar name={user!.name} size="sm" />
              <span className="user-text">
                <strong>{user!.name}</strong>
                <small>{user!.role === "supervisor" ? "Supervisor" : user!.department ?? "Employee"}</small>
              </span>
            </div>
            <button className="icon-btn" title="Log out" aria-label="Log out" onClick={() => { logout(); nav("/login"); }}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <nav className="nav-mobile" aria-label="Main">{links}</nav>
    </div>
  );
}
