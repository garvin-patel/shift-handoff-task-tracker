import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useAppData } from "../appData";
import { useAuth } from "../auth";
import { useToast } from "../components/Toast";
import { Avatar, EmptyState, Icon, Modal } from "../components/ui";
import { SHIFT_HOURS, SHIFT_NAMES, firstName, plural } from "../format";
import type { Role, ShiftName, User } from "../types";

const byRoleThenName = (a: User, b: User) =>
  Number(b.role === "supervisor") - Number(a.role === "supervisor") || a.name.localeCompare(b.name);

export default function Team() {
  const { user, isSupervisor } = useAuth();
  const { users, shift, refresh } = useAppData();
  const [adding, setAdding] = useState(false);

  const groups = [
    ...SHIFT_NAMES.map((name) => ({ name, hours: SHIFT_HOURS[name], people: users.filter((u) => u.usual_shift === name) })),
    { name: "No regular shift", hours: "", people: users.filter((u) => !u.usual_shift) },
  ].filter((g) => g.people.length > 0);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Team</h1>
          <p className="subtle">{plural(users.length, "person")} across {plural(groups.length, "shift")}</p>
        </div>
        {isSupervisor && (
          <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="userPlus" /> Add staff member</button>
        )}
      </header>

      {groups.length === 0 ? (
        <div className="panel"><EmptyState icon="team" title="No staff yet" /></div>
      ) : (
        <div className="team-grid">
          {groups.map((g) => (
            <section key={g.name} className="panel team-group">
              <header className="team-group-head">
                <div>
                  <h2>{g.name}</h2>
                  {g.hours && <span className="subtle">{g.hours}</span>}
                </div>
                {shift?.name === g.name && <span className="pill pill-live"><span className="dot" />On shift now</span>}
              </header>
              <ul className="people">
                {[...g.people].sort(byRoleThenName).map((p) => (
                  <li key={p.id} className="person-row" title={p.email}>
                    <Avatar name={p.name} size="md" />
                    <div className="person-info">
                      <strong>{p.name}{p.id === user!.id && <span className="you">You</span>}</strong>
                      <span>{p.department ?? "No department"}</span>
                    </div>
                    {p.role === "supervisor" && <span className="tag tag-supervisor">Supervisor</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {isSupervisor && <AddStaffDialog open={adding} onClose={() => setAdding(false)} onAdded={refresh} />}
    </>
  );
}

// Easy-to-read temporary password: no 0/O or 1/l/I to mix up when reading it out.
function temporaryPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function AddStaffDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => Promise<void> }) {
  const [created, setCreated] = useState<{ user: User; password: string } | null>(null);
  const close = () => { setCreated(null); onClose(); };
  return (
    <Modal open={open} title={created ? "Staff member added" : "Add staff member"} onClose={close} wide>
      {created ? (
        <Created user={created.user} password={created.password} onAnother={() => setCreated(null)} onDone={close} />
      ) : (
        <AddStaffForm onCancel={close} onCreated={async (user, password) => { setCreated({ user, password }); await onAdded(); }} />
      )}
    </Modal>
  );
}

function AddStaffForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (user: User, password: string) => void }) {
  const { departments, shift } = useAppData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [department, setDepartment] = useState(departments[0] ?? "");
  const [newDepartment, setNewDepartment] = useState("");
  const [usualShift, setUsualShift] = useState<ShiftName>((shift?.name as ShiftName) ?? "Morning");
  const [password, setPassword] = useState(temporaryPassword);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const dept = department === "__new" ? newDepartment.trim() : department;
    if (password.length < 8) return setError("The temporary password needs at least 8 characters.");
    setBusy(true);
    setError("");
    try {
      const user = await api.createUser({
        name: name.trim(), email: email.trim(), password, role, department: dept || null, usual_shift: usualShift,
      });
      onCreated(user, password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field-row">
        <label className="field"><span>Full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nora Diaz" required autoFocus maxLength={100} />
        </label>
        <label className="field"><span>Work email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nora.diaz@hotel.com" required />
          <small className="field-help">They sign in with this.</small>
        </label>
      </div>

      <div className="field-row">
        <fieldset className="field">
          <legend>Role</legend>
          <div className="segmented">
            {(["employee", "supervisor"] as Role[]).map((r) => (
              <label key={r} className={`segment ${role === r ? "is-on" : ""}`}>
                <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} />
                {r === "employee" ? "Employee" : "Supervisor"}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Usual shift</legend>
          <div className="segmented">
            {SHIFT_NAMES.map((s) => (
              <label key={s} className={`segment ${usualShift === s ? "is-on" : ""}`}>
                <input type="radio" name="shift" checked={usualShift === s} onChange={() => setUsualShift(s)} />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="field-row">
        <label className="field"><span>Department</span>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            {departments.map((d) => <option key={d}>{d}</option>)}
            <option value="">No department</option>
            <option value="__new">New department…</option>
          </select>
        </label>
        {department === "__new" && (
          <label className="field"><span>New department name</span>
            <input value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} placeholder="e.g. Kitchen" required maxLength={100} />
          </label>
        )}
      </div>

      <label className="field"><span>Temporary password</span>
        <div className="input-with-button">
          <input value={password} onChange={(e) => setPassword(e.target.value)} className="mono" required minLength={8} />
          <button type="button" className="btn btn-ghost" onClick={() => setPassword(temporaryPassword())} title="Generate a new one">
            <Icon name="refresh" size={16} /> New
          </button>
        </div>
        <small className="field-help">Give this to them in person. They can change it from their profile menu.</small>
      </label>

      {error && <div className="form-error" role="alert"><Icon name="alert" size={16} /> {error}</div>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Adding…" : "Add staff member"}</button>
      </div>
    </form>
  );
}

function Created({ user, password, onAnother, onDone }: { user: User; password: string; onAnother: () => void; onDone: () => void }) {
  const toast = useToast();
  const details = `Email: ${user.email}\nTemporary password: ${password}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(details);
      toast("Sign-in details copied.");
    } catch {
      toast("Couldn't copy. Select the text instead.", "error");
    }
  }
  return (
    <div className="created">
      <div className="created-head">
        <Avatar name={user.name} size="lg" />
        <div>
          <strong>{user.name}</strong>
          <span className="subtle">{[user.role === "supervisor" ? "Supervisor" : "Employee", user.department, user.usual_shift && `${user.usual_shift} shift`].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
      <p>Share these sign-in details with {firstName(user.name)}:</p>
      <dl className="credentials">
        <div><dt>Email</dt><dd>{user.email}</dd></div>
        <div><dt>Temporary password</dt><dd className="mono">{password}</dd></div>
      </dl>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={copy}><Icon name="copy" size={16} /> Copy details</button>
        <button type="button" className="btn btn-ghost" onClick={onAnother}>Add another</button>
        <button type="button" className="btn btn-primary" onClick={onDone}>Done</button>
      </div>
    </div>
  );
}
