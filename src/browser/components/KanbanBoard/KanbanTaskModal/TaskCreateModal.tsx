/**
 * TaskCreateModal — dialog for creating a new Kanban task.
 */
import { useCallback, useState } from "react";

import type { KanbanTaskPriority } from "@/common/types/kanban";
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

interface TaskCreateModalProps {
  workspaceId: string;
  projectPath: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const EMPTY_FORM: TaskFormData = {
  title: "",
  description: "",
  priority: "",
  labels: "",
  assignee: "",
};

export function TaskCreateModal(props: TaskCreateModalProps) {
  const { workspaceId, projectPath, isOpen, onClose, onCreated } = props;
  const { api } = useAPI();

  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isCreating) {
        setForm(EMPTY_FORM);
        setError("");
        onClose();
      }
    },
    [isCreating, onClose]
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = form.title.trim();
    if (!trimmed) {
      setError("Title is required");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      if (!api) return;
      const result = await api.kanban.createTask({
        workspaceId,
        projectPath,
        title: trimmed,
        description: form.description.trim() || undefined,
        priority: (form.priority || undefined) as KanbanTaskPriority | undefined,
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

      setForm(EMPTY_FORM);
      onCreated?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setIsCreating(false);
    }
  }, [api, form, workspaceId, projectPath, onCreated, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isCreating) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit, isCreating]
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isCreating}>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Add a new task to the board</DialogDescription>
        </DialogHeader>

        <div onKeyDown={handleKeyDown}>
          <TaskFormFields data={form} onChange={setForm} disabled={isCreating} />

          {error && <p className="text-error mt-2 text-xs">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isCreating || !form.title.trim()}>
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
