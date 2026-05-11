/**
 * KanbanService — backend service for kanban board CRUD, status transitions,
 * task ordering, and queue management.
 *
 * Persistence delegated to kanbanStorage.ts. In-memory cache for reads.
 */

import { randomUUID } from "crypto";

import type { Config } from "@/node/config";
import type { KanbanBoardData, KanbanTask, KanbanTaskStatus } from "@/common/types/kanban";
import { findColumnForStatus, validateTransition } from "@/common/utils/kanban";

import { readBoard, writeBoard } from "./kanbanStorage";

export class KanbanService {
  private readonly config: Config;
  /** In-memory cache: projectPath -> board data */
  private readonly cache = new Map<string, KanbanBoardData>();

  constructor(config: Config) {
    this.config = config;
  }

  private get muxHome(): string {
    return this.config.rootDir;
  }

  /** Load board for a project (cached after first read). */
  async getBoard(projectPath: string): Promise<KanbanBoardData> {
    const cached = this.cache.get(projectPath);
    if (cached) return cached;

    const board = await readBoard(this.muxHome, projectPath);
    this.cache.set(projectPath, board);
    return board;
  }

  /** Persist board and update cache. */
  private async saveBoard(board: KanbanBoardData): Promise<void> {
    await writeBoard(this.muxHome, board);
    this.cache.set(board.projectPath, board);
  }

  /** Invalidate cache entry (e.g., on external change). */
  invalidateCache(projectPath: string): void {
    this.cache.delete(projectPath);
  }

  // ── Task CRUD ──

  async createTask(params: {
    projectPath: string;
    title: string;
    description?: string;
    status?: KanbanTaskStatus;
    priority?: "urgent" | "high" | "medium" | "low";
    labels?: string[];
    assignee?: string;
    columnId?: string;
  }): Promise<{ success: true; data: KanbanTask } | { success: false; error: string }> {
    const board = await this.getBoard(params.projectPath);
    const status = params.status ?? "backlog";
    const columnId = params.columnId ?? findColumnForStatus(board, status) ?? board.columns[0]?.id;

    if (!columnId) {
      return { success: false, error: "No columns available on the board" };
    }

    const now = Date.now();
    const task: KanbanTask = {
      id: randomUUID(),
      workspaceId: null,
      projectPath: params.projectPath,
      title: params.title,
      description: params.description,
      status,
      priority: params.priority,
      labels: params.labels,
      assignee: params.assignee,
      createdAt: now,
      updatedAt: now,
    };

    board.tasks[task.id] = task;
    const order = board.taskOrder[columnId] ?? [];
    order.push(task.id);
    board.taskOrder[columnId] = order;

    await this.saveBoard(board);
    return { success: true, data: task };
  }

  async updateTask(
    projectPath: string,
    taskId: string,
    updates: Partial<
      Pick<KanbanTask, "title" | "description" | "priority" | "labels" | "assignee" | "metadata">
    >
  ): Promise<{ success: true; data: KanbanTask } | { success: false; error: string }> {
    const board = await this.getBoard(projectPath);
    const task = board.tasks[taskId];
    if (!task) return { success: false, error: `Task ${taskId} not found` };

    Object.assign(task, updates, { updatedAt: Date.now() });
    await this.saveBoard(board);
    return { success: true, data: task };
  }

  async deleteTask(
    projectPath: string,
    taskId: string
  ): Promise<{ success: true; data: void } | { success: false; error: string }> {
    const board = await this.getBoard(projectPath);
    if (!board.tasks[taskId]) {
      return { success: false, error: `Task ${taskId} not found` };
    }

    delete board.tasks[taskId];

    // Remove from all column order arrays
    for (const colId of Object.keys(board.taskOrder)) {
      board.taskOrder[colId] = (board.taskOrder[colId] ?? []).filter((id) => id !== taskId);
    }

    await this.saveBoard(board);
    return { success: true, data: undefined };
  }

  // ── Status Transitions ──

  async moveTask(
    projectPath: string,
    taskId: string,
    toStatus: KanbanTaskStatus,
    toIndex?: number
  ): Promise<{ success: true; data: KanbanTask } | { success: false; error: string }> {
    const board = await this.getBoard(projectPath);
    const task = board.tasks[taskId];
    if (!task) return { success: false, error: `Task ${taskId} not found` };

    const transitionError = validateTransition(task, toStatus);
    if (transitionError) return { success: false, error: transitionError };

    // Remove from current column order
    const currentColumnId = findColumnForStatus(board, task.status);
    if (currentColumnId) {
      board.taskOrder[currentColumnId] = (board.taskOrder[currentColumnId] ?? []).filter(
        (id) => id !== taskId
      );
    }

    // Update task status
    task.status = toStatus;
    task.updatedAt = Date.now();
    if (toStatus === "archived") {
      task.archivedAt = Date.now();
    } else {
      task.archivedAt = undefined;
    }

    // Insert into target column order
    const targetColumnId = findColumnForStatus(board, toStatus);
    if (targetColumnId) {
      const order = board.taskOrder[targetColumnId] ?? [];
      const insertAt = toIndex != null ? Math.min(toIndex, order.length) : order.length;
      order.splice(insertAt, 0, taskId);
      board.taskOrder[targetColumnId] = order;
    }

    await this.saveBoard(board);
    return { success: true, data: task };
  }

  // ── Ordering ──

  async reorderTasks(
    projectPath: string,
    columnId: string,
    taskIds: string[]
  ): Promise<{ success: true; data: void } | { success: false; error: string }> {
    const board = await this.getBoard(projectPath);

    // Validate all task IDs exist and belong to this column
    const currentOrder = board.taskOrder[columnId] ?? [];
    for (const id of taskIds) {
      if (!board.tasks[id]) {
        return { success: false, error: `Task ${id} not found` };
      }
      if (!currentOrder.includes(id)) {
        return { success: false, error: `Task ${id} is not in column ${columnId}` };
      }
    }

    board.taskOrder[columnId] = taskIds;
    await this.saveBoard(board);
    return { success: true, data: undefined };
  }

  async reorderColumns(
    projectPath: string,
    columnIds: string[]
  ): Promise<{ success: true; data: void } | { success: false; error: string }> {
    const board = await this.getBoard(projectPath);

    const columnMap = new Map(board.columns.map((c) => [c.id, c]));
    const reordered: typeof board.columns = [];
    for (const id of columnIds) {
      const col = columnMap.get(id);
      if (!col) return { success: false, error: `Column ${id} not found` };
      reordered.push(col);
    }

    board.columns = reordered;
    await this.saveBoard(board);
    return { success: true, data: undefined };
  }

  // ── Archive ──

  async archiveTask(
    projectPath: string,
    taskId: string,
    archive: boolean
  ): Promise<{ success: true; data: KanbanTask } | { success: false; error: string }> {
    if (archive) {
      return this.moveTask(projectPath, taskId, "archived");
    }

    // Unarchive: move back to backlog
    const board = await this.getBoard(projectPath);
    const task = board.tasks[taskId];
    if (!task) return { success: false, error: `Task ${taskId} not found` };

    if (task.status !== "archived") {
      return { success: false, error: "Task is not archived" };
    }

    return this.moveTask(projectPath, taskId, "backlog");
  }

  // ── Column Management ──

  async updateColumn(
    projectPath: string,
    columnId: string,
    updates: { title?: string; wipLimit?: number | null }
  ): Promise<
    { success: true; data: KanbanBoardData["columns"][number] } | { success: false; error: string }
  > {
    const board = await this.getBoard(projectPath);
    const column = board.columns.find((c) => c.id === columnId);
    if (!column) return { success: false, error: `Column ${columnId} not found` };

    if (updates.title != null) column.title = updates.title;
    if (updates.wipLimit !== undefined) {
      column.wipLimit = updates.wipLimit ?? undefined;
    }

    await this.saveBoard(board);
    return { success: true, data: column };
  }

  // ── Queue Management ──

  /** Count tasks currently in_progress (used for queue capacity). */
  async countRunningTasks(projectPath: string): Promise<number> {
    const board = await this.getBoard(projectPath);
    return Object.values(board.tasks).filter((t) => t.status === "in_progress").length;
  }

  /** Promote the oldest queued task to in_progress. Returns promoted task or null. */
  async promoteQueuedTask(projectPath: string): Promise<KanbanTask | null> {
    const board = await this.getBoard(projectPath);

    // Find oldest queued task (by queuedAt)
    const queuedTasks = Object.values(board.tasks)
      .filter((t) => t.queued && t.status === "backlog")
      .sort((a, b) => (a.queuedAt ?? Infinity) - (b.queuedAt ?? Infinity));

    if (queuedTasks.length === 0) return null;

    const task = queuedTasks[0];

    const result = await this.moveTask(projectPath, task.id, "in_progress");
    if (!result.success) return null;

    // Clear queued flags on the persisted task after successful move
    result.data.queued = false;
    result.data.queuedAt = undefined;
    await this.saveBoard(await this.getBoard(projectPath));

    return result.data;
  }
}
