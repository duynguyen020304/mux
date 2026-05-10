/**
 * KanbanColumn — vertical column with SortableContext for card reordering.
 */
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import type { KanbanColumn as KanbanColumnType, KanbanTask } from "@/common/types/kanban";
import { KanbanCard } from "./KanbanCard";
import { ScrollArea } from "@/browser/components/ScrollArea/ScrollArea";

interface KanbanColumnProps {
  column: KanbanColumnType;
  tasks: KanbanTask[];
  onTaskClick?: (taskId: string) => void;
  onTaskContextMenu?: (taskId: string, e: React.MouseEvent) => void;
}

export function KanbanColumn(props: KanbanColumnProps) {
  const { column, tasks, onTaskClick, onTaskContextMenu } = props;

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-[260px] max-w-[360px] flex-1 flex-col rounded-lg border ${
        isOver ? "border-accent bg-accent/5" : "border-border bg-surface-secondary"
      }`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <h3 className="text-foreground text-sm font-medium">{column.title}</h3>
        <span className="text-muted text-xs">{tasks.length}</span>
        {column.wipLimit != null && (
          <span className="text-muted text-xs">
            ({tasks.length}/{column.wipLimit})
          </span>
        )}
      </div>

      {/* Card list */}
      <ScrollArea className="flex-1 px-2">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 pb-2">
            {tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick?.(task.id)}
                onContextMenu={(e) => onTaskContextMenu?.(task.id, e)}
              />
            ))}
            {tasks.length === 0 && (
              <div className="border-border text-muted rounded border border-dashed p-4 text-center text-xs italic">
                No tasks
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}
