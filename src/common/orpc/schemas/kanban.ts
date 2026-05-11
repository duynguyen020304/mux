import { z } from "zod";
import { ResultSchema } from "./result";

// ── Reusable sub-schemas ──

export const KanbanTaskStatusSchema = z.enum([
  "backlog",
  "in_progress",
  "in_review",
  "done",
  "archived",
]);

export const KanbanTaskPrioritySchema = z.enum(["urgent", "high", "medium", "low"]);

export const KanbanColumnSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: KanbanTaskStatusSchema,
  wipLimit: z.number().int().min(1).optional(),
  collapsed: z.boolean().optional(),
});

export const KanbanTaskSchema = z.object({
  id: z.string(),
  workspaceId: z.string().nullable(),
  projectPath: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: KanbanTaskStatusSchema,
  priority: KanbanTaskPrioritySchema.optional(),
  labels: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  queued: z.boolean().optional(),
  queuedAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  archivedAt: z.number().optional(),
});

export const KanbanBoardDataSchema = z.object({
  version: z.literal(1),
  projectPath: z.string(),
  columns: z.array(KanbanColumnSchema),
  tasks: z.record(z.string(), KanbanTaskSchema),
  taskOrder: z.record(z.string(), z.array(z.string())),
});

// ── IPC endpoint schemas ──

export const kanban = {
  getBoard: {
    input: z.object({ projectPath: z.string() }),
    output: KanbanBoardDataSchema,
  },

  createTask: {
    input: z.object({
      projectPath: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      status: KanbanTaskStatusSchema.optional(),
      priority: KanbanTaskPrioritySchema.optional(),
      labels: z.array(z.string()).optional(),
      assignee: z.string().optional(),
      columnId: z.string().optional(),
    }),
    output: ResultSchema(KanbanTaskSchema, z.string()),
  },

  updateTask: {
    input: z.object({
      taskId: z.string(),
      projectPath: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      priority: KanbanTaskPrioritySchema.optional(),
      labels: z.array(z.string()).optional(),
      assignee: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
    output: ResultSchema(KanbanTaskSchema, z.string()),
  },

  deleteTask: {
    input: z.object({ taskId: z.string(), projectPath: z.string() }),
    output: ResultSchema(z.void(), z.string()),
  },

  moveTask: {
    input: z.object({
      taskId: z.string(),
      projectPath: z.string(),
      toStatus: KanbanTaskStatusSchema,
      toIndex: z.number().int().min(0).optional(),
    }),
    output: ResultSchema(KanbanTaskSchema, z.string()),
  },

  reorderTasks: {
    input: z.object({
      projectPath: z.string(),
      columnId: z.string(),
      taskIds: z.array(z.string()),
    }),
    output: ResultSchema(z.void(), z.string()),
  },

  archiveTask: {
    input: z.object({
      taskId: z.string(),
      projectPath: z.string(),
      archive: z.boolean(),
    }),
    output: ResultSchema(KanbanTaskSchema, z.string()),
  },

  updateColumn: {
    input: z.object({
      projectPath: z.string(),
      columnId: z.string(),
      title: z.string().min(1).optional(),
      wipLimit: z.number().int().min(1).nullable().optional(),
    }),
    output: ResultSchema(KanbanColumnSchema, z.string()),
  },

  reorderColumns: {
    input: z.object({
      projectPath: z.string(),
      columnIds: z.array(z.string()),
    }),
    output: ResultSchema(z.void(), z.string()),
  },
} as const;
