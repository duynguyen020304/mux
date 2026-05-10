/**
 * KanbanBoard — main board layout with DnD context, columns, modals, and IPC.
 *
 * Owns: DndContext, task modals, context menu, IPC calls for CRUD/move/reorder.
 * The parent (KanbanView) provides the workspace ID, project path, and board refresh.
 */
import { useCallback, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import type { KanbanBoardData, KanbanTask } from "@/common/types/kanban";
import { groupTasksByColumn } from "@/common/utils/kanban";
import { useAPI } from "@/browser/contexts/API";
import { Button } from "@/browser/components/Button/Button";
import {
  PositionedMenu,
  PositionedMenuItem,
} from "@/browser/components/PositionedMenu/PositionedMenu";
import { useContextMenuPosition } from "@/browser/hooks/useContextMenuPosition";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCardPreview } from "./KanbanCardPreview";
import { TaskCreateModal } from "./KanbanTaskModal/TaskCreateModal";
import { TaskDetailModal } from "./KanbanTaskModal/TaskDetailModal";

interface KanbanBoardProps {
  workspaceId: string;
  projectPath: string;
  board: KanbanBoardData;
  onBoardChanged?: () => void;
}

export function KanbanBoard(props: KanbanBoardProps) {
  const { workspaceId, projectPath, board, onBoardChanged } = props;
  const { api } = useAPI();

  // Drag state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  // Context menu state
  const ctxMenu = useContextMenuPosition({ longPress: false });
  const [ctxTaskId, setCtxTaskId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const activeTask = activeTaskId ? board.tasks[activeTaskId] : null;
  const tasksByColumn = groupTasksByColumn(board);
  const detailTask = detailTaskId ? (board.tasks[detailTaskId] ?? null) : null;
  const ctxTask = ctxTaskId ? (board.tasks[ctxTaskId] ?? null) : null;

  const refresh = useCallback(() => {
    onBoardChanged?.();
  }, [onBoardChanged]);

  // ── IPC helpers ──

  const moveTask = useCallback(
    async (taskId: string, toStatus: KanbanTask["status"]) => {
      if (!api) return;
      try {
        const result = await api.kanban.moveTask({ workspaceId, taskId, toStatus });
        if (result.success) refresh();
      } catch (err) {
        console.error("[KanbanBoard] moveTask failed:", err);
      }
    },
    [api, workspaceId, refresh]
  );

  const reorderTasks = useCallback(
    async (columnId: string, taskIds: string[]) => {
      if (!api) return;
      try {
        const result = await api.kanban.reorderTasks({ workspaceId, columnId, taskIds });
        if (result.success) refresh();
      } catch (err) {
        console.error("[KanbanBoard] reorderTasks failed:", err);
      }
    },
    [api, workspaceId, refresh]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!api) return;
      try {
        const result = await api.kanban.deleteTask({ workspaceId, taskId });
        if (result.success) refresh();
      } catch (err) {
        console.error("[KanbanBoard] deleteTask failed:", err);
      }
    },
    [api, workspaceId, refresh]
  );

  const archiveTask = useCallback(
    async (taskId: string, archive: boolean) => {
      if (!api) return;
      try {
        const result = await api.kanban.archiveTask({ workspaceId, taskId, archive });
        if (result.success) refresh();
      } catch (err) {
        console.error("[KanbanBoard] archiveTask failed:", err);
      }
    },
    [api, workspaceId, refresh]
  );

  // ── DnD handlers ──

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Live column preview placeholder
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTaskId(null);
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      // Find source and target columns
      let sourceColId: string | null = null;
      let targetColId: string | null = null;

      for (const [colId, taskIds] of Object.entries(board.taskOrder)) {
        if (taskIds.includes(activeId)) sourceColId = colId;
        if (taskIds.includes(overId)) targetColId = colId;
      }

      // over.id might be a column droppable (dropped on empty area)
      if (!targetColId) {
        const col = board.columns.find((c) => c.id === overId);
        if (col) targetColId = col.id;
      }

      if (!sourceColId) return;

      // Same column reorder
      if (sourceColId === targetColId) {
        const order = [...(board.taskOrder[sourceColId] ?? [])];
        const oldIndex = order.indexOf(activeId);
        const newIndex = order.indexOf(overId);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(order, oldIndex, newIndex);
          void reorderTasks(sourceColId, reordered);
        }
        return;
      }

      // Cross-column move
      if (targetColId) {
        const targetCol = board.columns.find((c) => c.id === targetColId);
        if (targetCol) {
          void moveTask(activeId, targetCol.status);
        }
      }
    },
    [board, moveTask, reorderTasks]
  );

  // ── Context menu handlers ──

  const handleTaskContextMenu = useCallback(
    (taskId: string, e: React.MouseEvent) => {
      setCtxTaskId(taskId);
      ctxMenu.onContextMenu(e);
    },
    [ctxMenu]
  );

  const handleCtxEdit = useCallback(() => {
    if (ctxTaskId) setDetailTaskId(ctxTaskId);
    ctxMenu.close();
  }, [ctxTaskId, ctxMenu]);

  const handleCtxDelete = useCallback(() => {
    if (ctxTaskId) void deleteTask(ctxTaskId);
    ctxMenu.close();
  }, [ctxTaskId, deleteTask, ctxMenu]);

  const handleCtxArchive = useCallback(() => {
    if (ctxTaskId) void archiveTask(ctxTaskId, true);
    ctxMenu.close();
  }, [ctxTaskId, archiveTask, ctxMenu]);

  const handleCtxMoveTo = useCallback(
    (status: KanbanTask["status"]) => {
      if (ctxTaskId) void moveTask(ctxTaskId, status);
      ctxMenu.close();
    },
    [ctxTaskId, moveTask, ctxMenu]
  );

  return (
    <>
      {/* Board header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <h2 className="text-foreground text-sm font-semibold">Board</h2>
        <div className="flex-1" />
        <Button size="xs" onClick={() => setIsCreateOpen(true)}>
          <Plus className="size-3" />
          New Task
        </Button>
      </div>

      {/* Board columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full gap-4 overflow-x-auto p-4">
          {board.columns
            .filter((col) => col.status !== "archived")
            .map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={tasksByColumn[col.id] ?? []}
                onTaskClick={(id) => setDetailTaskId(id)}
                onTaskContextMenu={handleTaskContextMenu}
              />
            ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask && <KanbanCardPreview task={activeTask} />}
        </DragOverlay>
      </DndContext>

      {/* Context menu */}
      <PositionedMenu
        open={ctxMenu.isOpen}
        onOpenChange={ctxMenu.onOpenChange}
        position={ctxMenu.position}
      >
        <PositionedMenuItem icon={<span />} label="Edit" onClick={handleCtxEdit} />
        <PositionedMenuItem
          icon={<span />}
          label="Archive"
          onClick={handleCtxArchive}
          disabled={ctxTask?.status === "archived"}
        />
        <PositionedMenuItem
          icon={<span />}
          label="Move to Backlog"
          onClick={() => handleCtxMoveTo("backlog")}
        />
        <PositionedMenuItem
          icon={<span />}
          label="Move to In Progress"
          onClick={() => handleCtxMoveTo("in_progress")}
        />
        <PositionedMenuItem
          icon={<span />}
          label="Move to In Review"
          onClick={() => handleCtxMoveTo("in_review")}
        />
        <PositionedMenuItem
          icon={<span />}
          label="Move to Done"
          onClick={() => handleCtxMoveTo("done")}
        />
        <PositionedMenuItem
          icon={<span />}
          label="Delete"
          onClick={handleCtxDelete}
          variant="destructive"
        />
      </PositionedMenu>

      {/* Task create modal */}
      <TaskCreateModal
        workspaceId={workspaceId}
        projectPath={projectPath}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={refresh}
      />

      {/* Task detail/edit modal */}
      <TaskDetailModal
        task={detailTask}
        isOpen={detailTask != null}
        onClose={() => setDetailTaskId(null)}
        onUpdated={refresh}
        onDelete={(id) => void deleteTask(id)}
      />
    </>
  );
}
