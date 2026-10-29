import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { PRIORITY_LABEL, STATUS_LABEL, initials } from "../format";
import type { Priority, Status } from "../types";

const ICONS = {
  plus: "M12 5v14M5 12h14",
  search: "m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z",
  check: "m5 12.5 4.5 4.5L19 7",
  alert: "M12 8v5m0 3.5v.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  back: "M19 12H5m6-6-6 6 6 6",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11",
  board: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  handoff: "M4 8h13m0 0-4-4m4 4-4 4M20 16H7m0 0 4-4m-4 4 4 4",
  team: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3 3 0 0 1 0 5.8",
  userPlus: "M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 8v6M16 11h6",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  play: "M8 5.5v13l10-6.5-10-6.5Z",
  undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  edit: "M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4",
  chevron: "m9 6 6 6-6 6",
  chevronDown: "m6 9 6 6 6-6",
  note: "M5 5h14v10H9l-4 4V5Z",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6v-9Z",
  key: "M15 7a3 3 0 1 1-2.8 4H4v3h2v2h3v-2h2.2A3 3 0 0 1 15 7Z",
  x: "M6 6l12 12M18 6 6 18",
  copy: "M9 9h10v11H9zM5 15V4h10",
  refresh: "M20 11a8 8 0 0 0-14.9-3.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.9 3.9L20 16M20 20v-4h-4",
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="26" height="26">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path d="M9 11h9m0 0-3-3m3 3-3 3M23 21h-9m0 0 3-3m-3 3 3 3" fill="none" stroke="#fff"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export const StatusPill = ({ status }: { status: Status }) => (
  <span className={`pill status-${status}`}>
    <span className="dot" />
    {STATUS_LABEL[status]}
  </span>
);

export const PriorityTag = ({ priority }: { priority: Priority }) => (
  <span className={`prio prio-${priority}`}>
    <span className="prio-bars" aria-hidden="true"><i /><i /><i /></span>
    {PRIORITY_LABEL[priority]}
  </span>
);

export const Avatar = ({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) => (
  <span className={`avatar avatar-${size}`} title={name} aria-hidden="true" style={{ "--hue": hue(name) } as CSSProperties}>
    {initials(name)}
  </span>
);

// A stable color per person, so the same name always gets the same avatar color.
function hue(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={20} /></span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export const Skeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="skeleton-list" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" />)}
  </div>
);

// A modal built on the native <dialog>, which handles focus and the Esc key.
// The content only renders while open, so forms start fresh each time.
export function Modal({ open, title, onClose, children, footer, wide }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) {
      dialog?.showModal();
      // showModal() focuses the first button (the close ×); start in the first text field instead.
      dialog?.querySelector<HTMLElement>("input:not([type=checkbox]):not([type=radio]), textarea, select")?.focus();
    }
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`dialog ${wide ? "dialog-wide" : ""}`} onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <div className="dialog-inner">
          <div className="dialog-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          </div>
          <div className="dialog-body">{children}</div>
          {footer && <div className="dialog-actions">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, title, children, confirmLabel, danger, busy, onConfirm, onClose }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} footer={
      <>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </>
    }>
      {children}
    </Modal>
  );
}
