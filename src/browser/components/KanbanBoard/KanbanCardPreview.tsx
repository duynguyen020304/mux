/**
 * KanbanCardPreview — rendered inside DragOverlay as the drag preview.
 * Receives the task and renders a styled card (no DragOverlay wrapper here;
 * the parent KanbanBoard owns the DragOverlay).
 */
import type { KanbanTask } from "@/common/types/kanban";
import { KanbanCard } from "./KanbanCard";

interface KanbanCardPreviewProps {
  task: KanbanTask;
}

export function KanbanCardPreview(props: KanbanCardPreviewProps) {
  return <KanbanCard task={props.task} isOverlay />;
}
