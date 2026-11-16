import { z } from "zod";
import type { ToolClient, ToolRegistrar } from "../register.js";
import { parityTool } from "./register-tool.js";
import {
  date,
  hasChanges,
  id,
  page,
  position,
  queryString,
} from "./schemas.js";

export function registerInitiativeTools(
  server: ToolRegistrar,
  client: ToolClient,
) {
  const register = parityTool(server, client);
  const segment = encodeURIComponent;
  const fields = {
    name: z.string().trim().min(1).max(200),
    description: z.string().max(50_000).optional(),
    status: z.enum(["planned", "active", "completed"]).optional(),
    ownerId: id.nullable().optional(),
    targetDate: date,
    icon: z.string().max(100).nullable().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
  };
  register(
    "list_initiatives",
    "List workspace initiatives; project counts and progress include only readable projects. Set includeArchived to find archived initiatives and paginate while hasMore is true.",
    z.strictObject({
      workspaceId: id,
      ...page,
      includeArchived: z.boolean().optional(),
    }),
    ({ workspaceId, ...options }) =>
      client.json(
        `/api/parity/initiative/${segment(workspaceId)}?${queryString(options)}`,
        { method: "GET" },
      ),
  );
  register(
    "get_initiative",
    "Get an initiative's properties, progress, latest update and readable linked projects.",
    z.strictObject({ id }),
    ({ id }) =>
      client.json(`/api/parity/initiative/item/${segment(id)}`, {
        method: "GET",
      }),
  );
  register(
    "create_initiative",
    "Create an initiative in a workspace. Requires project update permission.",
    z.strictObject({ workspaceId: id, ...fields }),
    ({ workspaceId, ...body }) =>
      client.json(`/api/parity/initiative/${segment(workspaceId)}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  );
  register(
    "update_initiative",
    "Edit initiative properties or archive/restore it with archived true/false. Null clears owner, target date, icon or color; omitted fields stay unchanged. Requires project update permission; changing archived also requires workspace settings permission. Health is set through create_status_update.",
    z
      .strictObject({
        id,
        ...fields,
        name: fields.name.optional(),
        archived: z.boolean().optional(),
      })
      .refine(hasChanges, "Provide at least one initiative field"),
    ({ id, ...body }) =>
      client.json(`/api/parity/initiative/item/${segment(id)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
  );
  register(
    "delete_initiative",
    "Permanently delete an initiative and its updates and project links. Projects and issues are preserved. Requires workspace settings permission. Use update_initiative archived:true for reversible archiving instead.",
    z.strictObject({ id }),
    ({ id }) =>
      client.json(`/api/parity/initiative/item/${segment(id)}`, {
        method: "DELETE",
      }),
  );
  register(
    "reorder_initiatives",
    "Set the order of all non-archived initiatives in a workspace. Supply every active initiative ID once, in desired order (including planned and completed statuses). Fetch all pages of list_initiatives first. Requires project update permission.",
    z.strictObject({
      workspaceId: id,
      ids: z
        .array(id)
        .max(1000)
        .refine(
          (ids) => new Set(ids).size === ids.length,
          "Initiative IDs must be unique",
        ),
    }),
    ({ workspaceId, ids }) =>
      client.json(`/api/parity/initiative/${segment(workspaceId)}/reorder`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
  );
  register(
    "add_project_to_initiative",
    "Link or reorder a readable project in an initiative in the same workspace. Position is zero-based; a project can belong to multiple initiatives.",
    z.strictObject({ initiativeId: id, projectId: id, position }),
    ({ initiativeId, projectId, ...body }) =>
      client.json(
        `/api/parity/initiative/item/${segment(initiativeId)}/project/${segment(projectId)}`,
        { method: "POST", body: JSON.stringify(body) },
      ),
  );
  register(
    "remove_project_from_initiative",
    "Unlink a project from an initiative, preserving the project and its issues. Requires project update permission and access to the project.",
    z.strictObject({ initiativeId: id, projectId: id }),
    ({ initiativeId, projectId }) =>
      client.json(
        `/api/parity/initiative/item/${segment(initiativeId)}/project/${segment(projectId)}`,
        { method: "DELETE" },
      ),
  );
}
