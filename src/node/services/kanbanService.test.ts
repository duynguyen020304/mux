/**
 * Tests for KanbanService — CRUD, status transitions, ordering.
 *
 * Uses real filesystem with temp directories, following the testHistoryService pattern.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { Config } from "@/node/config";
import { KanbanService } from "./kanbanService";

let tempDir: string;
let config: Config;
let service: KanbanService;

beforeEach(async () => {
  tempDir = path.join(
    os.tmpdir(),
    `kanban-svc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(tempDir, { recursive: true });
  config = new Config(tempDir);
  service = new KanbanService(config);
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

const WS_ID = "test-workspace";
const PROJECT_PATH = "/test/project";

describe("KanbanService.getBoard", () => {
  test("returns default board for new workspace", async () => {
    const board = await service.getBoard(WS_ID);
    expect(board.workspaceId).toBe(WS_ID);
    expect(board.columns.length).toBeGreaterThan(0);
    expect(board.tasks).toEqual({});
  });

  test("caches board after first read", async () => {
    const board1 = await service.getBoard(WS_ID);
    const board2 = await service.getBoard(WS_ID);
    expect(board1).toBe(board2); // Same reference (cached)
  });
});

describe("KanbanService.createTask", () => {
  test("creates task with defaults", async () => {
    const result = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "My task",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("My task");
    expect(result.data.status).toBe("backlog");
    expect(result.data.workspaceId).toBe(WS_ID);
    expect(result.data.id).toBeDefined();
  });

  test("creates task with all fields", async () => {
    const result = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Full task",
      description: "A description",
      status: "backlog",
      priority: "high",
      labels: ["bug", "urgent"],
      assignee: "alice",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.priority).toBe("high");
    expect(result.data.labels).toEqual(["bug", "urgent"]);
    expect(result.data.assignee).toBe("alice");
  });

  test("adds task to correct column order", async () => {
    const result = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Order test",
    });

    expect(result.success).toBe(true);
    const board = await service.getBoard(WS_ID);
    // Task should appear in backlog column's taskOrder
    const backlogOrder = board.taskOrder["backlog"];
    expect(backlogOrder).toContain(result.success ? result.data.id : "");
  });

  test("accepts empty title (UI validates)", async () => {
    // Title is required by convention — the service doesn't enforce it,
    // but the modal does. We just verify the task gets created with the given title.
    const result = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "",
    });
    expect(result.success).toBe(true);
  });
});

describe("KanbanService.updateTask", () => {
  test("updates task fields", async () => {
    const created = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Original",
    });
    if (!created.success) return;
    const taskId = created.data.id;

    const updated = await service.updateTask(WS_ID, taskId, {
      title: "Updated",
      priority: "urgent",
    });

    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.title).toBe("Updated");
    expect(updated.data.priority).toBe("urgent");
  });

  test("returns error for nonexistent task", async () => {
    const result = await service.updateTask(WS_ID, "nonexistent", { title: "X" });
    expect(result.success).toBe(false);
  });
});

describe("KanbanService.deleteTask", () => {
  test("deletes existing task", async () => {
    const created = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "To delete",
    });
    if (!created.success) return;

    const deleted = await service.deleteTask(WS_ID, created.data.id);
    expect(deleted.success).toBe(true);

    // Task should be removed from board
    const board = await service.getBoard(WS_ID);
    expect(board.tasks[created.data.id]).toBeUndefined();
  });

  test("returns error for nonexistent task", async () => {
    const result = await service.deleteTask(WS_ID, "nonexistent");
    expect(result.success).toBe(false);
  });

  test("removes task from column order", async () => {
    const created = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Order removal",
    });
    if (!created.success) return;
    const taskId = created.data.id;

    await service.deleteTask(WS_ID, taskId);

    // Invalidate cache to re-read from disk
    service.invalidateCache(WS_ID);
    const board = await service.getBoard(WS_ID);

    for (const order of Object.values(board.taskOrder)) {
      expect(order).not.toContain(taskId);
    }
  });
});

describe("KanbanService.moveTask", () => {
  test("moves task from backlog to in_progress", async () => {
    const created = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Move me",
    });
    if (!created.success) return;

    const moved = await service.moveTask(WS_ID, created.data.id, "in_progress");
    expect(moved.success).toBe(true);
    if (!moved.success) return;
    expect(moved.data.status).toBe("in_progress");
  });

  test("disallows invalid transition (done -> in_progress)", async () => {
    const created = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Bad transition",
    });
    if (!created.success) return;

    // backlog -> in_progress -> in_review -> done
    await service.moveTask(WS_ID, created.data.id, "in_progress");
    await service.moveTask(WS_ID, created.data.id, "in_review");
    await service.moveTask(WS_ID, created.data.id, "done");

    // done -> in_progress should fail
    const result = await service.moveTask(WS_ID, created.data.id, "in_progress");
    expect(result.success).toBe(false);
  });

  test("allows done -> backlog (reopen)", async () => {
    const created = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Reopen me",
    });
    if (!created.success) return;

    await service.moveTask(WS_ID, created.data.id, "in_progress");
    await service.moveTask(WS_ID, created.data.id, "done");

    const result = await service.moveTask(WS_ID, created.data.id, "backlog");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("backlog");
  });

  test("moves task to correct column order", async () => {
    const created = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Column check",
    });
    if (!created.success) return;
    const taskId = created.data.id;

    await service.moveTask(WS_ID, taskId, "in_progress");

    // Re-read to get updated state
    service.invalidateCache(WS_ID);
    const board = await service.getBoard(WS_ID);

    // Should be in in_progress column
    const inProgressOrder = board.taskOrder["in_progress"] ?? [];
    expect(inProgressOrder).toContain(taskId);
    // Should NOT be in backlog column
    const backlogOrder = board.taskOrder["backlog"] ?? [];
    expect(backlogOrder).not.toContain(taskId);
  });
});

describe("KanbanService.reorderTasks", () => {
  test("reorders tasks within a column", async () => {
    const t1 = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "T1",
    });
    const t2 = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "T2",
    });
    const t3 = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "T3",
    });
    if (!t1.success || !t2.success || !t3.success) return;

    const newOrder = [t3.data.id, t1.data.id, t2.data.id];
    const result = await service.reorderTasks(WS_ID, "backlog", newOrder);
    expect(result.success).toBe(true);

    service.invalidateCache(WS_ID);
    const board = await service.getBoard(WS_ID);
    expect(board.taskOrder["backlog"]).toEqual(newOrder);
  });

  test("returns error for nonexistent task in order", async () => {
    const result = await service.reorderTasks(WS_ID, "backlog", ["nonexistent"]);
    expect(result.success).toBe(false);
  });
});

describe("KanbanService.archiveTask", () => {
  test("archives a task", async () => {
    const created = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Archive",
    });
    if (!created.success) return;

    const result = await service.archiveTask(WS_ID, created.data.id, true);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("archived");
    expect(result.data.archivedAt).toBeDefined();
  });

  test("unarchives a task back to backlog", async () => {
    const created = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Unarchive",
    });
    if (!created.success) return;

    await service.archiveTask(WS_ID, created.data.id, true);
    const result = await service.archiveTask(WS_ID, created.data.id, false);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("backlog");
    expect(result.data.archivedAt).toBeUndefined();
  });
});

describe("KanbanService.updateColumn", () => {
  test("updates column title", async () => {
    const result = await service.updateColumn(WS_ID, "backlog", { title: "Todo" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("Todo");
  });

  test("updates column wipLimit", async () => {
    const result = await service.updateColumn(WS_ID, "backlog", { wipLimit: 5 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.wipLimit).toBe(5);
  });

  test("clears wipLimit when set to null", async () => {
    await service.updateColumn(WS_ID, "backlog", { wipLimit: 5 });
    const result = await service.updateColumn(WS_ID, "backlog", { wipLimit: null });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.wipLimit).toBeUndefined();
  });

  test("returns error for nonexistent column", async () => {
    const result = await service.updateColumn(WS_ID, "nonexistent", { title: "X" });
    expect(result.success).toBe(false);
  });
});

describe("KanbanService.promoteQueuedTask", () => {
  test("returns null when no queued tasks", async () => {
    const result = await service.promoteQueuedTask(WS_ID);
    expect(result).toBeNull();
  });

  test("promotes oldest queued task to in_progress", async () => {
    const t1 = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Queued 1",
    });
    const t2 = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Queued 2",
    });
    if (!t1.success || !t2.success) return;

    // Manually set queued flags — createTask doesn't accept these fields
    const board = await service.getBoard(WS_ID);
    board.tasks[t1.data.id].queued = true;
    board.tasks[t1.data.id].queuedAt = 100;
    board.tasks[t2.data.id].queued = true;
    board.tasks[t2.data.id].queuedAt = 200;

    const promoted = await service.promoteQueuedTask(WS_ID);
    expect(promoted).not.toBeNull();
    expect(promoted!.id).toBe(t1.data.id); // oldest first
    expect(promoted!.status).toBe("in_progress");
    expect(promoted!.queued).toBe(false);
    expect(promoted!.queuedAt).toBeUndefined();
  });

  test("returns null when all tasks have queued=false", async () => {
    await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "Not queued",
    });

    const result = await service.promoteQueuedTask(WS_ID);
    expect(result).toBeNull();
  });
});

describe("KanbanService.reorderColumns", () => {
  test("reorders columns", async () => {
    const board = await service.getBoard(WS_ID);
    const originalIds = board.columns.map((c) => c.id);
    const reversed = [...originalIds].reverse();

    const result = await service.reorderColumns(WS_ID, reversed);
    expect(result.success).toBe(true);

    service.invalidateCache(WS_ID);
    const updated = await service.getBoard(WS_ID);
    expect(updated.columns.map((c) => c.id)).toEqual(reversed);
  });
});

describe("KanbanService.countRunningTasks", () => {
  test("returns 0 for empty board", async () => {
    const count = await service.countRunningTasks(WS_ID);
    expect(count).toBe(0);
  });

  test("counts in_progress tasks", async () => {
    const t1 = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "R1",
    });
    const t2 = await service.createTask({
      workspaceId: WS_ID,
      projectPath: PROJECT_PATH,
      title: "R2",
    });
    if (!t1.success || !t2.success) return;

    await service.moveTask(WS_ID, t1.data.id, "in_progress");

    const count = await service.countRunningTasks(WS_ID);
    expect(count).toBe(1);
  });
});
