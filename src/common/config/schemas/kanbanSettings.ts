import { z } from "zod";

import { KanbanColumnSchema } from "@/common/orpc/schemas/kanban";
export { KanbanColumnSchema };

export const KANBAN_SETTINGS_LIMITS = {
  maxParallelKanbanTasks: { min: 1, max: 50, default: 5 },
} as const;

export const KanbanSettingsSchema = z.object({
  maxParallelKanbanTasks: z
    .number()
    .int()
    .min(KANBAN_SETTINGS_LIMITS.maxParallelKanbanTasks.min)
    .max(KANBAN_SETTINGS_LIMITS.maxParallelKanbanTasks.max)
    .optional(),
  columns: z.array(KanbanColumnSchema).optional(),
  autoArchiveCompletedTasks: z.boolean().optional(),
});

export type KanbanSettings = z.infer<typeof KanbanSettingsSchema>;
