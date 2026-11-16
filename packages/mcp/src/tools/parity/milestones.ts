import { z } from "zod";
import type { ToolClient, ToolRegistrar } from "../register.js";
import { parityTool } from "./register-tool.js";
import { date, hasChanges, id, position } from "./schemas.js";

export function registerMilestoneTools(
  server: ToolRegistrar,
  client: ToolClient,
) {
  const register = parityTool(server, client);
  const segment = encodeURIComponent;
  const fields = {
    name: z.string().trim().min(1).max(200),
    description: z.string().max(50_000).optional(),
    targetDate: date,
    position,
  };
  register(
    "list_milestones",
    "List a readable project's milestones and their progress.",
    z.strictObject({ projectId: id }),
    ({ projectId }) =>
      client.json(`/api/parity/milestone/${segment(projectId)}`, {
        method: "GET",
      }),
  );
  register(
    "create_milestone",
    "Create a project milestone with a Markdown description and optional target date and order. Requires project update permission.",
    z.strictObject({ projectId: id, ...fields }),
    ({ projectId, ...body }) =>
      client.json(`/api/parity/milestone/${segment(projectId)}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  );
  register(
    "update_milestone",
    "Edit or reorder a milestone. Omitted fields stay unchanged; targetDate null clears the date and an empty description clears its text. Position is zero-based.",
    z
      .strictObject({ id, ...fields, name: fields.name.optional() })
      .refine(hasChanges, "Provide at least one milestone field"),
    ({ id, ...body }) =>
      client.json(`/api/parity/milestone/item/${segment(id)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
  );
  register(
    "delete_milestone",
    "Permanently delete a milestone and clear its task milestone assignments. The tasks themselves are preserved. Requires project update permission.",
    z.strictObject({ id }),
    ({ id }) =>
      client.json(`/api/parity/milestone/item/${segment(id)}`, {
        method: "DELETE",
      }),
  );
  register(
    "get_task_milestone",
    "Get a task's current milestone ID and name, or null if unassigned.",
    z.strictObject({ taskId: id }),
    ({ taskId }) =>
      client.json(`/api/parity/task/${segment(taskId)}/milestone`, {
        method: "GET",
      }),
  );
  register(
    "update_task_milestone",
    "Assign a task to a milestone in the same project, or unassign with explicit null. Requires task update permission.",
    z.strictObject({ taskId: id, milestoneId: id.nullable() }),
    ({ taskId, milestoneId }) =>
      client.json(`/api/parity/task/${segment(taskId)}/milestone`, {
        method: "PUT",
        body: JSON.stringify({ milestoneId }),
      }),
  );
}
