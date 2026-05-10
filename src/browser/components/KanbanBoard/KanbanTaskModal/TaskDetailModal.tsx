/**
 * TaskDetailModal — dialog for viewing/editing an existing Kanban task.
 */
import { useCallback, useState } from "react";

import type { KanbanTask, KanbanTaskPriority } from "@/common/types/kanban";
import { KANBAN_STATUS_LABELS } from "@/common/utils/kanban";
import { useAPI } from "@/browser/contexts/API";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/browser/components/Dialog/Dialog";
import { Button } from "@/browser/components/Button/Button";
import { TaskFormFields, type TaskFormData } from "./TaskFormFields";

interface TaskDetailModalProps {
  task: KanbanTask | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  onDelete?: (taskId: string) => void;
}

function taskToForm(task: KanbanTask): TaskFormData {
  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority ?? "none",
    labels: task.labels?.join(", ") ?? "",
    assignee: task.assignee ?? "",
  };
}

const EMPTY_FORM: TaskFormData = {
  title: "",
  description: "",
  priority: "none",
  labels: "",
  assignee: "",
};

export function TaskDetailModal(props: TaskDetailModalProps) {
  const { task, isOpen, onClose, onUpdated, onDelete } = props;
  const { api } = useAPI();

  // key prop on the form wrapper remounts form fields when task changes,
  // replacing the old useEffect-based reset pattern.
  const formKey = task?.id ?? "empty";
  const [form, setForm] = useState<TaskFormData>(task ? taskToForm(task) : EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isSaving) {
        setError("");
        onClose();
      }
    },
    [isSaving, onClose]
  );

  const handleSave = useCallback(async () => {
    if (!task) return;
    const trimmed = form.title.trim();
    if (!trimmed) {
      setError("Title is required");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      if (!api) return;
      const result = await api.kanban.updateTask({
        workspaceId: task.workspaceId,
        taskId: task.id,
        title: trimmed,
        description: form.description.trim() || undefined,
        priority: (form.priority === "none" ? undefined : form.priority) as
          | KanbanTaskPriority
          | undefined,
        labels: form.labels.trim()
          ? form.labels
              .split(",")
              .map((l) => l.trim())
              .filter(Boolean)
          : undefined,
        assignee: form.assignee.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      onUpdated?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setIsSaving(false);
    }
  }, [api, task, form, onUpdated, onClose]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    setIsSaving(true);
    try {
      if (!api) return;
      const result = await api.kanban.deleteTask({
        workspaceId: task.workspaceId,
        taskId: task.id,
      });
      if (result.success) {
        onDelete?.(task.id);
        onClose();
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete task");
    } finally {
      setIsSaving(false);
    }
  }, [api, task, onDelete, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isSaving) {
        e.preventDefault();
        void handleSave();
      }
    },
    [handleSave, isSaving]
  );

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isSaving}>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Created {new Date(task.createdAt).toLocaleDateString()} ·{" "}
            {KANBAN_STATUS_LABELS[task.status]}
          </DialogDescription>
        </DialogHeader>

        <div key={formKey} onKeyDown={handleKeyDown}>
          <TaskFormFields data={form} onChange={setForm} disabled={isSaving} />

          {error && <p className="text-error mt-2 text-xs">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={isSaving}>
            Delete
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving || !form.title.trim()}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
