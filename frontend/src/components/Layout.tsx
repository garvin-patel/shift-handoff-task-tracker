import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Layout() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Shift Handoff</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/tasks/new">New Task</NavLink>
          <NavLink to="/handoff">Handoff</NavLink>
        </nav>
        <div className="user">
          <span>{user?.name} <small>({user?.role})</small></span>
          <button className="ghost" onClick={() => { logout(); nav("/login"); }}>Log out</button>
        </div>
      </header>
      <main><Outlet /></main>
    </div>
  );
}
export const Badge = ({ v }: { v: string }) => <span className={`badge b-${v.replace(" ", "").toLowerCase()}`}>{v}</span>;
export const fmt = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
