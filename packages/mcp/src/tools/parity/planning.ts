import { z } from "zod";
import type { ToolClient, ToolRegistrar } from "../register.js";
import { registerInitiativeTools } from "./initiatives.js";
import { registerMilestoneTools } from "./milestones.js";
import { parityTool } from "./register-tool.js";
import { date, id, page, queryString } from "./schemas.js";

export function registerPlanningTools(
  server: ToolRegistrar,
  client: ToolClient,
) {
  const register = parityTool(server, client);
  const segment = encodeURIComponent;
  register(
    "get_project_plan",
    "Get a readable project's status, lead, dates, milestones, progress and latest update.",
    z.object({ projectId: id }),
    ({ projectId }) =>
      client.json(`/api/parity/project-plan/${segment(projectId)}`, {
        method: "GET",
      }),
  );
  register(
    "update_project_plan",
    "Update project planning fields. Explicit null clears a lead or date; health is set by posting an update.",
    z.object({
      projectId: id,
      status: z
        .enum([
          "backlog",
          "planned",
          "started",
          "paused",
          "completed",
          "canceled",
        ])
        .optional(),
      leadId: id.nullable().optional(),
      startDate: date,
      targetDate: date,
      priority: z
        .enum(["no-priority", "low", "medium", "high", "urgent"])
        .optional(),
    }),
    ({ projectId, ...body }) =>
      client.json(`/api/parity/project-plan/${segment(projectId)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
  );
  register(
    "create_status_update",
    "Post a Markdown project or initiative update and set its health.",
    z.object({
      parentType: z.enum(["project", "initiative"]),
      parentId: id,
      health: z.enum(["on_track", "at_risk", "off_track"]),
      body: z.string().trim().min(1).max(50_000),
    }),
    ({ parentType, parentId, ...body }) =>
      client.json(
        `/api/parity/status-update/${parentType}/${segment(parentId)}`,
        { method: "POST", body: JSON.stringify(body) },
      ),
  );
  register(
    "list_status_updates",
    "Read a project's or initiative's status update feed, including health and authors. Paginate while hasMore is true.",
    z.strictObject({
      parentType: z.enum(["project", "initiative"]),
      parentId: id,
      ...page,
    }),
    ({ parentType, parentId, ...options }) =>
      client.json(
        `/api/parity/status-update/${parentType}/${segment(parentId)}?${queryString(options)}`,
        { method: "GET" },
      ),
  );
  registerMilestoneTools(server, client);
  registerInitiativeTools(server, client);
}
