import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Avatar, Icon, Logo } from "../components/ui";
import { SHIFT_HOURS } from "../format";
import type { ShiftName } from "../types";

// The seed users from database/02_seed.sql, grouped by their usual shift. Shown only on the dev server.
const DEMO_PASSWORD = "password123";
const DEMO_TEAM: { shift: ShiftName; people: [name: string, email: string, role: string][] }[] = [
  { shift: "Morning", people: [
    ["Maria Lopez", "maria.lopez", "Supervisor"], ["Aisha Khan", "aisha.khan", "Housekeeping"], ["Tom Nguyen", "tom.nguyen", "Maintenance"],
  ] },
  { shift: "Evening", people: [
    ["Daniel Brooks", "daniel.brooks", "Supervisor"], ["James Carter", "james.carter", "Front Desk"],
    ["Priya Shah", "priya.shah", "Housekeeping"], ["Marcus Reed", "marcus.reed", "Maintenance"],
  ] },
  { shift: "Night", people: [
    ["Sofia Rossi", "sofia.rossi", "Supervisor"], ["Leo Park", "leo.park", "Maintenance"],
  ] },
];

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function signIn(e: string, p: string) {
    setBusy(true);
    setError("");
    try {
      await login(e, p);
      nav(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signIn(email, password);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand"><Logo /><span>Shift Handoff</span></div>
        <h1>Sign in</h1>
        <p className="subtle">Unfinished work follows the shift, not the person who started it.</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Work email</span>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@hotel.com" required autoFocus />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="form-error" role="alert"><Icon name="alert" size={16} /> {error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="login-help">New here? Ask your supervisor to add you. They'll give you a temporary password.</p>
      </div>

      {import.meta.env.DEV && (
        <section className="demo-panel" aria-label="Demo accounts">
          <header>
            <strong>Demo accounts</strong>
            <span className="subtle">Click to sign in · password <code>{DEMO_PASSWORD}</code></span>
          </header>
          <div className="demo-shifts">
            {DEMO_TEAM.map((group) => (
              <div key={group.shift} className="demo-shift">
                <h3>{group.shift} <span>{SHIFT_HOURS[group.shift]}</span></h3>
                {group.people.map(([name, handle, role]) => (
                  <button key={handle} type="button" className="demo-account" disabled={busy}
                    onClick={() => signIn(`${handle}@example.com`, DEMO_PASSWORD)}>
                    <Avatar name={name} size="sm" />
                    <span className="demo-name">{name}</span>
                    <span className={`demo-role ${role === "Supervisor" ? "is-supervisor" : ""}`}>{role}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
