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
    expect(coerceBoardData(null, "/test/project")).toBeNull();
  });

  test("returns null for non-object input", () => {
    expect(coerceBoardData("string", "/test/project")).toBeNull();
    expect(coerceBoardData(42, "/test/project")).toBeNull();
  });

  test("returns null for wrong version", () => {
    const raw = {
      version: 999,
      projectPath: "/test/project",
      columns: [],
      tasks: {},
      taskOrder: {},
    };
    expect(coerceBoardData(raw, "/test/project")).toBeNull();
  });

  test("returns null for missing projectPath", () => {
    const raw = { version: 1, columns: [], tasks: {}, taskOrder: {} };
    expect(coerceBoardData(raw, "/test/project")).toBeNull();
  });

  test("returns null for missing columns", () => {
    const raw = { version: 1, projectPath: "/test/project", tasks: {}, taskOrder: {} };
    expect(coerceBoardData(raw, "/test/project")).toBeNull();
  });

  test("returns null for missing tasks", () => {
    const raw = { version: 1, projectPath: "/test/project", columns: [], taskOrder: {} };
    expect(coerceBoardData(raw, "/test/project")).toBeNull();
  });

  test("returns null for missing taskOrder", () => {
    const raw = { version: 1, projectPath: "/test/project", columns: [], tasks: {} };
    expect(coerceBoardData(raw, "/test/project")).toBeNull();
  });

  test("returns valid board data for correct structure", () => {
    const raw = {
      version: 1,
      projectPath: "/test/project",
      columns: [{ id: "backlog", title: "Backlog", status: "backlog" }],
      tasks: {},
      taskOrder: { backlog: [] },
    };
    const result = coerceBoardData(raw, "/test/project");
    expect(result).not.toBeNull();
    expect(result!.projectPath).toBe("/test/project");
    expect(result!.columns).toHaveLength(1);
  });
});

describe("readBoard", () => {
  test("returns empty board when file does not exist", async () => {
    const board = await readBoard(tempDir, "/test/nonexistent");
    expect(board.projectPath).toBe("/test/nonexistent");
    expect(board.columns.length).toBeGreaterThan(0); // default columns
    expect(board.tasks).toEqual({});
  });

  test("returns empty board for malformed JSON", async () => {
    const dir = path.join(tempDir, "kanban");
    await fs.mkdir(dir, { recursive: true });
    // File name is derived from projectPath via getProjectRouteId
    const { getProjectRouteId } = await import("@/common/utils/projectRouteId");
    const slug = getProjectRouteId("/test/malformed");
    await fs.writeFile(path.join(dir, `${slug}.json`), "not json{{{", "utf-8");

    const board = await readBoard(tempDir, "/test/malformed");
    expect(board.projectPath).toBe("/test/malformed");
  });

  test("returns empty board for invalid structure", async () => {
    const dir = path.join(tempDir, "kanban");
    await fs.mkdir(dir, { recursive: true });
    const { getProjectRouteId } = await import("@/common/utils/projectRouteId");
    const slug = getProjectRouteId("/test/invalid");
    await fs.writeFile(path.join(dir, `${slug}.json`), JSON.stringify({ version: 999 }), "utf-8");

    const board = await readBoard(tempDir, "/test/invalid");
    expect(board.projectPath).toBe("/test/invalid");
  });

  test("reads valid board data", async () => {
    const dir = path.join(tempDir, "kanban");
    await fs.mkdir(dir, { recursive: true });

    const { getProjectRouteId } = await import("@/common/utils/projectRouteId");
    const projectPath = "/test/valid-board";
    const slug = getProjectRouteId(projectPath);

    const validBoard = createEmptyBoard(projectPath);
    validBoard.tasks["task-1"] = {
      id: "task-1",
      workspaceId: null,
      projectPath,
      title: "Test task",
      status: "backlog",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    validBoard.taskOrder["backlog"] = ["task-1"];

    await fs.writeFile(path.join(dir, `${slug}.json`), JSON.stringify(validBoard), "utf-8");

    const board = await readBoard(tempDir, projectPath);
    expect(board.projectPath).toBe(projectPath);
    expect(board.tasks["task-1"]).toBeDefined();
    expect(board.tasks["task-1"].title).toBe("Test task");
  });
});

describe("writeBoard", () => {
  test("creates directory and writes board file", async () => {
    const projectPath = "/test/write-board";
    const board = createEmptyBoard(projectPath);
    await writeBoard(tempDir, board);

    const boardPath = getKanbanBoardPath(tempDir, projectPath);
    const content = await fs.readFile(boardPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.projectPath).toBe(projectPath);
  });

  test("round-trips board data correctly", async () => {
    const projectPath = "/test/round-trip";
    const board = createEmptyBoard(projectPath);
    board.tasks["t1"] = {
      id: "t1",
      workspaceId: null,
      projectPath,
      title: "Round trip task",
      status: "backlog",
      priority: "high",
      labels: ["bug"],
      createdAt: 1000,
      updatedAt: 2000,
    };
    board.taskOrder["backlog"] = ["t1"];

    await writeBoard(tempDir, board);
    const read = await readBoard(tempDir, projectPath);

    expect(read.tasks["t1"]).toEqual(board.tasks["t1"]);
    expect(read.taskOrder["backlog"]).toEqual(["t1"]);
  });
});
