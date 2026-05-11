/**
 * Kanban board storage — read/write board data from ~/.mux/kanban/<projectSlug>.json
 *
 * Boards are keyed by projectPath (shared across all workspaces in a project).
 * Follows the same pattern as todoStorage.ts: JSON file per project,
 * self-healing on read, atomic writes.
 */

import * as fs from "fs/promises";
import * as path from "path";

import writeFileAtomic from "write-file-atomic";

import type { KanbanBoardData } from "@/common/types/kanban";
import { KANBAN_DATA_DIR, KANBAN_DATA_VERSION } from "@/common/constants/kanban";
import { getProjectRouteId } from "@/common/utils/projectRouteId";
import { createEmptyBoard } from "@/common/utils/kanban";
import { ensurePrivateDir } from "@/node/utils/fs";
import { log } from "./log";

/** Get the kanban data directory under mux home. */
export function getKanbanDir(muxHome: string): string {
  return path.join(muxHome, KANBAN_DATA_DIR);
}

/** Get path to a project's kanban board file. */
export function getKanbanBoardPath(muxHome: string, projectPath: string): string {
  const slug = getProjectRouteId(projectPath);
  return path.join(getKanbanDir(muxHome), `${slug}.json`);
}

/** Coerce unknown parsed JSON into a valid KanbanBoardData, or return null. */
export function coerceBoardData(raw: unknown, _projectPath: string): KanbanBoardData | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // Check version field
  if (obj.version !== KANBAN_DATA_VERSION) return null;
  if (typeof obj.projectPath !== "string") return null;
  if (!Array.isArray(obj.columns)) return null;
  if (!obj.tasks || typeof obj.tasks !== "object") return null;
  if (!obj.taskOrder || typeof obj.taskOrder !== "object") return null;

  // Basic structure is valid — trust the shape
  return obj as unknown as KanbanBoardData;
}

/** Read board data for a project. Returns empty board if not found or invalid. */
export async function readBoard(muxHome: string, projectPath: string): Promise<KanbanBoardData> {
  const boardPath = getKanbanBoardPath(muxHome, projectPath);

  try {
    const content = await fs.readFile(boardPath, "utf-8");
    const parsed: unknown = JSON.parse(content);
    const board = coerceBoardData(parsed, projectPath);
    if (board) return board;
  } catch (error) {
    // ENOENT or parse error — return empty board below
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code !== "ENOENT"
    ) {
      // Log unexpected errors but don't crash
      log.warn(`[kanbanStorage] Error reading board for ${projectPath}:`, error);
    }
  }

  return createEmptyBoard(projectPath);
}

/** Write board data atomically. Creates directory if needed. */
export async function writeBoard(muxHome: string, board: KanbanBoardData): Promise<void> {
  const kanbanDir = getKanbanDir(muxHome);
  await ensurePrivateDir(kanbanDir);

  const boardPath = getKanbanBoardPath(muxHome, board.projectPath);
  const data = JSON.stringify(board, null, 2);
  await writeFileAtomic(boardPath, data, "utf-8");
}
