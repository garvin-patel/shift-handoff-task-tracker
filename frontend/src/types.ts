// Shapes returned by the FastAPI backend (see backend/app/schemas.py).

export type Role = "employee" | "supervisor";
export type Priority = "low" | "medium" | "high";
export type Status = "open" | "in_progress" | "completed";
export type ShiftName = "Morning" | "Evening" | "Night";

export interface UserBrief {
  id: number;
  name: string;
  department: string | null;
}

export interface User extends UserBrief {
  email: string;
  role: Role;
  usual_shift: ShiftName | null;
  created_at: string;
}

export interface NewUser {
  name: string;
  email: string;
  password: string;
  role: Role;
  department: string | null;
  usual_shift: ShiftName | null;
}

export interface Shift {
  id: number;
  name: string;
  started_at: string;
  ended_at: string | null;
  started_by: number | null;
  started_by_user: UserBrief | null;
  is_active: boolean;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  status: Status;
  assigned_user_id: number | null;
  assigned_department: string | null;
  created_by: number;
  created_in_shift: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  assignee: UserBrief | null;
  creator: UserBrief;
}

export interface TaskEvent {
  id: number;
  task_id: number;
  user_id: number | null;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user: UserBrief | null;
}

export interface TaskDetail extends Task {
  events: TaskEvent[];
  handoff_ids: number[];
}

export interface HandoffSummary {
  id: number;
  from_shift: Shift;
  to_shift: Shift | null;
  created_at: string;
  acknowledged_by: number | null;
  acknowledged_by_user: UserBrief | null;
  acknowledged_at: string | null;
  task_count: number;
}

export interface Handoff extends HandoffSummary {
  // The handed-over tasks, with their current state.
  tasks: Task[];
}

export interface NewTask {
  title: string;
  description: string | null;
  priority: Priority;
  assigned_department: string | null;
  assigned_user_id?: number;
}
