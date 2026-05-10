/**
 * KanbanView — container component that loads board data from the store
 * and renders KanbanBoard with the correct props.
 *
 * This component replaces ChatPane in the WorkspaceShell flex layout
 * when the user toggles to kanban view mode.
 */
import { useCallback, useEffect } from "react";

import { useAPI } from "@/browser/contexts/API";
import { getKanbanTaskStore, useKanbanBoard } from "@/browser/stores/KanbanTaskStore";
import { KanbanBoard } from "./KanbanBoard";

interface KanbanViewProps {
  workspaceId: string;
  projectPath: string;
}

export function KanbanView(props: KanbanViewProps) {
  const { workspaceId, projectPath } = props;
  const { api } = useAPI();
  const board = useKanbanBoard(workspaceId);
  const store = getKanbanTaskStore();

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      const data = await api.kanban.getBoard({ workspaceId });
      store.setBoardState(workspaceId, data);
    } catch {
      // Keep existing board state
    }
  }, [api, workspaceId, store]);

  // Load board from backend on mount
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex h-full flex-col">
      <KanbanBoard
        workspaceId={workspaceId}
        projectPath={projectPath}
        board={board}
        onBoardChanged={() => void refresh()}
      />
    </div>
  );
}
