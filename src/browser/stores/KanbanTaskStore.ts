/**
 * KanbanTaskStore — reactive store for kanban board data.
 *
 * Follows the MapStore pattern from WorkspaceStore/GitStatusStore.
 * Per-project board state with surgical React re-renders via useSyncExternalStore.
 */

import { useSyncExternalStore } from "react";

import type { KanbanBoardData } from "@/common/types/kanban";
import { createEmptyBoard } from "@/common/utils/kanban";
import { MapStore } from "./MapStore";

export class KanbanTaskStore {
  private readonly boardStates = new MapStore<string, KanbanBoardData>();
  private readonly boardCache = new Map<string, KanbanBoardData>();

  // ── Subscriptions ──

  subscribe = this.boardStates.subscribeAny;
  subscribeKey = (projectPath: string, listener: () => void) =>
    this.boardStates.subscribeKey(projectPath, listener);

  // ── Getters ──

  getBoardState(projectPath: string): KanbanBoardData {
    if (!this.boardStates.has(projectPath)) {
      // Cache the empty board so useSyncExternalStore sees a stable reference
      // (createEmptyBoard returns a new object every call → infinite re-render loop)
      let board = this.boardCache.get(projectPath);
      if (!board) {
        board = createEmptyBoard(projectPath);
        this.boardCache.set(projectPath, board);
      }
      return board;
    }
    return this.boardStates.get(projectPath, () => {
      return this.boardCache.get(projectPath) ?? createEmptyBoard(projectPath);
    });
  }

  // ── Mutations (called from IPC handlers, never during render) ──

  /** Set board data from backend response. */
  setBoardState(projectPath: string, board: KanbanBoardData): void {
    this.boardCache.set(projectPath, board);
    this.boardStates.bump(projectPath);
  }

  /** Remove project data (e.g., when project is archived/removed). */
  clearProject(projectPath: string): void {
    this.boardCache.delete(projectPath);
    this.boardStates.delete(projectPath);
  }

  /** Clean up stale entries when project list changes. */
  syncProjects(activeProjectPaths: Set<string>): void {
    for (const path of Array.from(this.boardCache.keys())) {
      if (!activeProjectPaths.has(path)) {
        this.clearProject(path);
      }
    }
  }
}

// ── Singleton ──

let instance: KanbanTaskStore | null = null;

function getInstance(): KanbanTaskStore {
  instance ??= new KanbanTaskStore();
  return instance;
}

// ── React Hooks ──

/** Subscribe to board state for a specific project. Re-renders only on changes to that project's board. */
export function useKanbanBoard(projectPath: string): KanbanBoardData {
  const store = getInstance();
  return useSyncExternalStore(
    (listener) => store.subscribeKey(projectPath, listener),
    () => store.getBoardState(projectPath)
  );
}

/** Raw store access for imperative operations (no re-render subscription). */
export function useKanbanTaskStoreRaw(): KanbanTaskStore {
  return getInstance();
}

/** Get singleton instance outside of React (for imperative store updates). */
export function getKanbanTaskStore(): KanbanTaskStore {
  return getInstance();
}
