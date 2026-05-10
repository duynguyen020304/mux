/**
 * Tests for kanbanStorage — read/write/coerce board data.
 *
 * Uses real filesystem with temp directories, following the testHistoryService pattern.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { createEmptyBoard } from "@/common/utils/kanban";
import { coerceBoardData, readBoard, writeBoard, getKanbanBoardPath } from "./kanbanStorage";

let tempDir: string;

beforeEach(async () => {
  tempDir = path.join(
    os.tmpdir(),
    `kanban-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("coerceBoardData", () => {
  test("returns null for null input", () => {
    expect(coerceBoardData(null, "ws1")).toBeNull();
  });

  test("returns null for non-object input", () => {
    expect(coerceBoardData("string", "ws1")).toBeNull();
    expect(coerceBoardData(42, "ws1")).toBeNull();
  });

  test("returns null for wrong version", () => {
    const raw = { version: 999, workspaceId: "ws1", columns: [], tasks: {}, taskOrder: {} };
    expect(coerceBoardData(raw, "ws1")).toBeNull();
  });

  test("returns null for missing workspaceId", () => {
    const raw = { version: 1, columns: [], tasks: {}, taskOrder: {} };
    expect(coerceBoardData(raw, "ws1")).toBeNull();
  });

  test("returns null for missing columns", () => {
    const raw = { version: 1, workspaceId: "ws1", tasks: {}, taskOrder: {} };
    expect(coerceBoardData(raw, "ws1")).toBeNull();
  });

  test("returns null for missing tasks", () => {
    const raw = { version: 1, workspaceId: "ws1", columns: [], taskOrder: {} };
    expect(coerceBoardData(raw, "ws1")).toBeNull();
  });

  test("returns null for missing taskOrder", () => {
    const raw = { version: 1, workspaceId: "ws1", columns: [], tasks: {} };
    expect(coerceBoardData(raw, "ws1")).toBeNull();
  });

  test("returns valid board data for correct structure", () => {
    const raw = {
      version: 1,
      workspaceId: "ws1",
      columns: [{ id: "backlog", title: "Backlog", status: "backlog" }],
      tasks: {},
      taskOrder: { backlog: [] },
    };
    const result = coerceBoardData(raw, "ws1");
    expect(result).not.toBeNull();
    expect(result!.workspaceId).toBe("ws1");
    expect(result!.columns).toHaveLength(1);
  });
});

describe("readBoard", () => {
  test("returns empty board when file does not exist", async () => {
    const board = await readBoard(tempDir, "ws-nonexistent");
    expect(board.workspaceId).toBe("ws-nonexistent");
    expect(board.columns.length).toBeGreaterThan(0); // default columns
    expect(board.tasks).toEqual({});
  });

  test("returns empty board for malformed JSON", async () => {
    const dir = path.join(tempDir, "kanban");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "ws1.json"), "not json{{{", "utf-8");

    const board = await readBoard(tempDir, "ws1");
    expect(board.workspaceId).toBe("ws1");
  });

  test("returns empty board for invalid structure", async () => {
    const dir = path.join(tempDir, "kanban");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "ws1.json"), JSON.stringify({ version: 999 }), "utf-8");

    const board = await readBoard(tempDir, "ws1");
    expect(board.workspaceId).toBe("ws1");
  });

  test("reads valid board data", async () => {
    const dir = path.join(tempDir, "kanban");
    await fs.mkdir(dir, { recursive: true });

    const validBoard = createEmptyBoard("ws1");
    validBoard.tasks["task-1"] = {
      id: "task-1",
      workspaceId: "ws1",
      projectPath: "/test",
      title: "Test task",
      status: "backlog",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    validBoard.taskOrder["backlog"] = ["task-1"];

    await fs.writeFile(path.join(dir, "ws1.json"), JSON.stringify(validBoard), "utf-8");

    const board = await readBoard(tempDir, "ws1");
    expect(board.workspaceId).toBe("ws1");
    expect(board.tasks["task-1"]).toBeDefined();
    expect(board.tasks["task-1"].title).toBe("Test task");
  });
});

describe("writeBoard", () => {
  test("creates directory and writes board file", async () => {
    const board = createEmptyBoard("ws-write");
    await writeBoard(tempDir, board);

    const boardPath = getKanbanBoardPath(tempDir, "ws-write");
    const content = await fs.readFile(boardPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.workspaceId).toBe("ws-write");
  });

  test("round-trips board data correctly", async () => {
    const board = createEmptyBoard("ws-rt");
    board.tasks["t1"] = {
      id: "t1",
      workspaceId: "ws-rt",
      projectPath: "/test",
      title: "Round trip task",
      status: "backlog",
      priority: "high",
      labels: ["bug"],
      createdAt: 1000,
      updatedAt: 2000,
    };
    board.taskOrder["backlog"] = ["t1"];

    await writeBoard(tempDir, board);
    const read = await readBoard(tempDir, "ws-rt");

    expect(read.tasks["t1"]).toEqual(board.tasks["t1"]);
    expect(read.taskOrder["backlog"]).toEqual(["t1"]);
  });
});
