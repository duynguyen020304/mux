/**
 * Kanban board types — task management board for organizing work across lifecycle stages.
 *
 * Separate from the existing TaskService (agent sub-workspace orchestration).
 * Kanban tasks are user-managed work items on a visual board.
 */

/** Statuses that map 1:1 to board columns. */
export type KanbanTaskStatus = "backlog" | "in_progress" | "in_review" | "done" | "archived";

export const KANBAN_TASK_STATUSES: readonly KanbanTaskStatus[] = [
  "backlog",
  "in_progress",
  "in_review",
  "done",
  "archived",
] as const;

/** Priority levels for kanban cards. */
export type KanbanTaskPriority = "urgent" | "high" | "medium" | "low";

/** A single task on the kanban board. */
export interface KanbanTask {
  id: string;
  /** Workspace that created/owns this task — null for backlog tasks not yet assigned to a workspace. */
  workspaceId: string | null;
  projectPath: string;
  title: string;
  description?: string;
  status: KanbanTaskStatus;
  priority?: KanbanTaskPriority;
  labels?: string[];
  assignee?: string;
  /** Extensible metadata for future use (e.g., linked PR, branch, etc.) */
  metadata?: Record<string, unknown>;
  /** Whether this task is queued awaiting execution capacity. */
  queued?: boolean;
  queuedAt?: number;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
}

/** A column on the kanban board. Each column maps to a status. */
export interface KanbanColumn {
  id: string;
  title: string;
  status: KanbanTaskStatus;
  wipLimit?: number;
  collapsed?: boolean;
}

/** The full board state persisted per project (shared across all workspaces in a project). */
export interface KanbanBoardData {
  version: 1;
  projectPath: string;
  columns: KanbanColumn[];
  tasks: Record<string, KanbanTask>;
  /** columnId -> ordered task IDs */
  taskOrder: Record<string, string[]>;
}

/** Allowed status transitions — each entry is { from -> [to] }. */
export const KANBAN_TRANSITIONS: Record<KanbanTaskStatus, KanbanTaskStatus[]> = {
  backlog: ["in_progress", "archived"],
  in_progress: ["in_review", "backlog", "archived"],
  in_review: ["done", "in_progress", "archived"],
  done: ["backlog", "archived"],
  archived: ["backlog"],
};

/** Returns true if the transition from -> to is allowed. */
export function isValidKanbanTransition(from: KanbanTaskStatus, to: KanbanTaskStatus): boolean {
  return KANBAN_TRANSITIONS[from]?.includes(to) ?? false;
}
