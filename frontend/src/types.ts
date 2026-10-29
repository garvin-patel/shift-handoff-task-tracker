export type Priority = "Low" | "Medium" | "High";
export type Status = "Open" | "In Progress" | "Completed";
export type Role = "employee" | "supervisor";
export interface User { id: number; name: string; username: string; role: Role; }
export interface HistoryEntry { at: string; by: string; action: string; }
export interface Task {
  id: number; title: string; description: string; priority: Priority; status: Status;
  assignee: string; createdBy: string; createdAt: string; shiftId: number; history: HistoryEntry[];
}
export interface Shift { id: number; name: string; startedAt: string; endedAt?: string; startedBy: string; }
export interface Handoff {
  id: number; fromShiftId: number; fromShiftName: string; toShiftName: string;
  createdAt: string; taskIds: number[]; acknowledgedBy?: string; acknowledgedAt?: string;
}
