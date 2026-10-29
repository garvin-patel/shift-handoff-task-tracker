import type { Priority, Status } from "./types";

export const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
};

export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High" };
export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

// Shift names offered when a supervisor starts a shift, and which one usually comes next.
export const SHIFT_NAMES = ["Morning", "Day", "Evening", "Night"];
const NEXT_SHIFT: Record<string, string> = { Morning: "Evening", Day: "Evening", Evening: "Morning", Night: "Morning" };
export const nextShiftName = (current?: string) => (current && NEXT_SHIFT[current]) || "Morning";

export function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export const fullDate = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const clockTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export const firstName = (name: string) => name.split(" ")[0];

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
