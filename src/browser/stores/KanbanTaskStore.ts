/**
 * KanbanTaskStore — reactive store for kanban board data.
 *
 * Follows the MapStore pattern from WorkspaceStore/GitStatusStore.
 * Per-workspace board state with surgical React re-renders via useSyncExternalStore.
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
  subscribeKey = (workspaceId: string, listener: () => void) =>
    this.boardStates.subscribeKey(workspaceId, listener);

  // ── Getters ──

  getBoardState(workspaceId: string): KanbanBoardData {
    if (!this.boardStates.has(workspaceId)) {
      // Cache the empty board so useSyncExternalStore sees a stable reference
      // (createEmptyBoard returns a new object every call → infinite re-render loop)
      let board = this.boardCache.get(workspaceId);
      if (!board) {
        board = createEmptyBoard(workspaceId);
        this.boardCache.set(workspaceId, board);
      }
      return board;
    }
    return this.boardStates.get(workspaceId, () => {
      return this.boardCache.get(workspaceId) ?? createEmptyBoard(workspaceId);
    });
  }

  // ── Mutations (called from IPC handlers, never during render) ──

  /** Set board data from backend response. */
  setBoardState(workspaceId: string, board: KanbanBoardData): void {
    this.boardCache.set(workspaceId, board);
    this.boardStates.bump(workspaceId);
  }

  /** Remove workspace data (e.g., when workspace is archived/removed). */
  clearWorkspace(workspaceId: string): void {
    this.boardCache.delete(workspaceId);
    this.boardStates.delete(workspaceId);
  }

  /** Clean up stale entries when workspace list changes. */
  syncWorkspaces(activeWorkspaceIds: Set<string>): void {
    for (const id of Array.from(this.boardCache.keys())) {
      if (!activeWorkspaceIds.has(id)) {
        this.clearWorkspace(id);
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

/** Subscribe to board state for a specific workspace. Re-renders only on changes to that workspace's board. */
export function useKanbanBoard(workspaceId: string): KanbanBoardData {
  const store = getInstance();
  return useSyncExternalStore(
    (listener) => store.subscribeKey(workspaceId, listener),
    () => store.getBoardState(workspaceId)
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
