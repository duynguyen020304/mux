/**
 * KanbanCard — draggable card showing task summary.
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { KanbanTask, KanbanTaskPriority } from "@/common/types/kanban";
import { cn } from "@/common/lib/utils";

interface KanbanCardProps {
  task: KanbanTask;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isOverlay?: boolean;
}

const PRIORITY_STYLES: Record<KanbanTaskPriority, string> = {
  urgent: "bg-danger/15 text-danger border-danger/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-muted/15 text-muted-foreground border-muted/30",
  low: "bg-muted/10 text-muted border-muted/20",
};

export function KanbanCard(props: KanbanCardProps) {
  const { task, onClick, onContextMenu, isOverlay } = props;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "card", taskId: task.id },
    disabled: task.status === "in_progress",
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border border-border bg-surface-primary px-3 py-2 shadow-sm",
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
        isOverlay && "shadow-lg",
        task.status === "in_progress" && "cursor-default opacity-90"
      )}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* Title */}
      <p className="text-foreground text-sm font-medium leading-tight">{task.title}</p>

      {/* Meta row */}
      <div className="mt-1 flex items-center gap-2">
        {task.priority && (
          <span
            className={cn(
              "inline-flex items-center rounded border px-1 py-0.5 text-[10px] font-medium",
              PRIORITY_STYLES[task.priority]
            )}
          >
            {task.priority}
          </span>
        )}
        {task.labels && task.labels.length > 0 && (
          <span className="text-muted text-[10px]">{task.labels[0]}</span>
        )}
        {task.status === "in_progress" && <span className="text-warning text-[10px]">Running</span>}
        {task.queued && <span className="text-muted text-[10px]">Queued</span>}
      </div>
    </div>
  );
}
