import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Avatar, Icon, Logo } from "../components/ui";

// The seed users from database/02_seed.sql. Shown only on the dev server, for demos.
const DEMO_PASSWORD = "password123";
const DEMO_ACCOUNTS = [
  { name: "Maria Lopez", email: "maria.lopez@example.com", role: "Supervisor · Front Desk" },
  { name: "James Carter", email: "james.carter@example.com", role: "Employee · Front Desk" },
  { name: "Priya Shah", email: "priya.shah@example.com", role: "Employee · Housekeeping" },
  { name: "Marcus Reed", email: "marcus.reed@example.com", role: "Employee · Maintenance" },
];

const POINTS = [
  { title: "Visible", text: "Open work sits on one dashboard, not in five group chats." },
  { title: "Continuous", text: "Unfinished tasks carry into the next shift on their own." },
  { title: "Accountable", text: "Every task has an owner, a priority and a full history." },
  { title: "Acknowledged", text: "The incoming shift confirms what it has inherited." },
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
      <section className="login-hero">
        <div className="brand brand-light"><Logo /> <span>Shift Handoff</span></div>
        <h1>Unfinished work should follow the shift, not end with it.</h1>
        <ul className="hero-points">
          {POINTS.map((p) => (
            <li key={p.title}>
              <span className="hero-check"><Icon name="check" size={14} /></span>
              <div><strong>{p.title}</strong><span>{p.text}</span></div>
            </li>
          ))}
        </ul>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <div className="brand login-mobile-brand"><Logo /> <span>Shift Handoff</span></div>
          <h2>Sign in</h2>
          <p className="muted">Use your work email to see your shift's tasks.</p>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@hotel.com" required autoFocus />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="form-error" role="alert"><Icon name="alert" size={16} /> {error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>

        {import.meta.env.DEV && (
          <div className="demo-accounts">
            <p>Demo accounts <span className="muted">· password {DEMO_PASSWORD}</span></p>
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.email} type="button" className="demo-account" disabled={busy}
                onClick={() => signIn(a.email, DEMO_PASSWORD)}>
                <Avatar name={a.name} size="sm" />
                <span><strong>{a.name}</strong><small>{a.role}</small></span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
