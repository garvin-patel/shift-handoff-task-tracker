import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth(); const nav = useNavigate();
  const [username, setU] = useState(""); const [password, setP] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await login(username, password); nav("/"); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <h1>Shift Handoff</h1>
        <p className="muted">Unfinished work should follow the shift, not end with it.</p>
        <label>Username<input value={username} onChange={(e) => setU(e.target.value)} required autoFocus /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setP(e.target.value)} required /></label>
        {error && <div className="error">{error}</div>}
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="hint">Demo: arjun / 1234 · garvin / 1234 (supervisor)</p>
      </form>
    </div>
  );
}
