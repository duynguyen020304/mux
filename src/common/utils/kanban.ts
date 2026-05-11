/**
 * Kanban utility helpers — status transition validation, grouping, defaults.
 */

import type {
  KanbanBoardData,
  KanbanColumn,
  KanbanTask,
  KanbanTaskStatus,
} from "@/common/types/kanban";
import { isValidKanbanTransition } from "@/common/types/kanban";
import { DEFAULT_KANBAN_COLUMNS, KANBAN_DATA_VERSION } from "@/common/constants/kanban";

/** Create an empty board with default columns. */
export function createEmptyBoard(projectPath: string): KanbanBoardData {
  const columns: KanbanColumn[] = DEFAULT_KANBAN_COLUMNS.map((col) => ({
    ...col,
  }));
  const taskOrder: Record<string, string[]> = {};
  for (const col of columns) {
    taskOrder[col.id] = [];
  }
  return {
    version: KANBAN_DATA_VERSION,
    projectPath,
    columns,
    tasks: {},
    taskOrder,
  };
}

/** Group tasks by their status column. Returns columnId -> tasks[]. */
export function groupTasksByColumn(board: KanbanBoardData): Record<string, KanbanTask[]> {
  const grouped: Record<string, KanbanTask[]> = {};
  for (const col of board.columns) {
    const ids = board.taskOrder[col.id] ?? [];
    grouped[col.id] = ids.map((id) => board.tasks[id]).filter((t): t is KanbanTask => t != null);
  }
  return grouped;
}

/** Find the column ID that corresponds to a given status. */
export function findColumnForStatus(
  board: KanbanBoardData,
  status: KanbanTaskStatus
): string | undefined {
  return board.columns.find((col) => col.status === status)?.id;
}

/** Validate and apply a status transition. Returns error message if invalid. */
export function validateTransition(task: KanbanTask, toStatus: KanbanTaskStatus): string | null {
  if (task.status === toStatus) return null;
  if (!isValidKanbanTransition(task.status, toStatus)) {
    return `Cannot transition task from "${task.status}" to "${toStatus}"`;
  }
  return null;
}

/** Count tasks in a given status (non-archived). */
export function countActiveTasks(
  tasks: Record<string, KanbanTask>,
  status?: KanbanTaskStatus
): number {
  return Object.values(tasks).filter(
    (t) => t.status !== "archived" && (status == null || t.status === status)
  ).length;
}

/** Human-readable labels for kanban task statuses. */
export const KANBAN_STATUS_LABELS: Record<KanbanTaskStatus, string> = {
  backlog: "Backlog",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  archived: "Archived",
};
