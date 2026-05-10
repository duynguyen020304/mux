/**
 * TaskFormFields — shared form body for task create/edit modals.
 */
import { Input } from "@/browser/components/Input/Input";
import { Select } from "@/browser/components/Select/Select";
import type { KanbanTaskPriority } from "@/common/types/kanban";

export interface TaskFormData {
  title: string;
  description: string;
  priority: KanbanTaskPriority | "none";
  labels: string;
  assignee: string;
}

interface TaskFormFieldsProps {
  data: TaskFormData;
  onChange: (data: TaskFormData) => void;
  disabled?: boolean;
}

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "No priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function TaskFormFields(props: TaskFormFieldsProps) {
  const { data, onChange, disabled } = props;

  const update = <K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Title */}
      <div>
        <label
          htmlFor="kanban-task-title"
          className="text-foreground mb-1 block text-xs font-medium"
        >
          Title
        </label>
        <Input
          id="kanban-task-title"
          value={data.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Task title"
          disabled={disabled}
          autoFocus
        />
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="kanban-task-desc"
          className="text-foreground mb-1 block text-xs font-medium"
        >
          Description
        </label>
        <textarea
          id="kanban-task-desc"
          value={data.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Optional description..."
          disabled={disabled}
          rows={3}
          className="border-input placeholder:text-muted focus-visible:ring-ring min-h-[60px] w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Priority */}
      <div>
        <label className="text-foreground mb-1 block text-xs font-medium">Priority</label>
        <Select
          value={data.priority}
          options={PRIORITY_OPTIONS}
          onChange={(val) => update("priority", val as KanbanTaskPriority | "none")}
          disabled={disabled}
          aria-label="Priority"
        />
      </div>

      {/* Labels (comma-separated) */}
      <div>
        <label
          htmlFor="kanban-task-labels"
          className="text-foreground mb-1 block text-xs font-medium"
        >
          Labels
        </label>
        <Input
          id="kanban-task-labels"
          value={data.labels}
          onChange={(e) => update("labels", e.target.value)}
          placeholder="bug, feature (comma-separated)"
          disabled={disabled}
        />
      </div>

      {/* Assignee */}
      <div>
        <label
          htmlFor="kanban-task-assignee"
          className="text-foreground mb-1 block text-xs font-medium"
        >
          Assignee
        </label>
        <Input
          id="kanban-task-assignee"
          value={data.assignee}
          onChange={(e) => update("assignee", e.target.value)}
          placeholder="Optional assignee"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
