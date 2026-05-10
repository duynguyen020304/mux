/**
 * Kanban board constants — default columns, storage keys, status mappings.
 */

import type { KanbanColumn, KanbanTaskStatus } from "@/common/types/kanban";

/** Default columns for new kanban boards. */
export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: "backlog", title: "Backlog", status: "backlog" },
  { id: "in_progress", title: "In Progress", status: "in_progress" },
  { id: "in_review", title: "In Review", status: "in_review" },
  { id: "done", title: "Done", status: "done" },
];

/** Statuses that are hidden by default (toggle to show). */
export const HIDDEN_KANBAN_STATUSES: ReadonlySet<KanbanTaskStatus> = new Set(["archived"]);

/** LocalStorage key helpers for kanban UI preferences. */
export const KANBAN_STORAGE_KEYS = {
  viewMode: (workspaceId: string) => `kanban:view-mode:${workspaceId}`,
  collapsedColumns: (workspaceId: string) => `kanban:collapsed-columns:${workspaceId}`,
  showArchived: (workspaceId: string) => `kanban:show-archived:${workspaceId}`,
} as const;

/** Directory name for kanban board data files under ~/.mux/ */
export const KANBAN_DATA_DIR = "kanban";

/** Board data file version for future migration support. */
export const KANBAN_DATA_VERSION = 1;
