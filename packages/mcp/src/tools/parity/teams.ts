import { z } from "zod";
import type { ToolClient, ToolRegistrar } from "../register.js";
import { parityTool } from "./register-tool.js";
import { id } from "./schemas.js";

export function registerTeamTools(server: ToolRegistrar, client: ToolClient) {
  const register = parityTool(server, client);
  const scope = { workspaceId: id };
  const item = { ...scope, teamId: id };
  const member = { ...item, userId: id };
  const fields = {
    name: z.string().trim().min(1).max(200),
    key: z.string().regex(/^[A-Z]{2,5}$/),
    description: z.string().max(10_000).optional(),
    icon: z.string().max(100).nullable().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
    leadId: id.nullable().optional(),
  };
  const path = (workspaceId: string, teamId?: string) =>
    `/api/parity/teams/${encodeURIComponent(workspaceId)}${teamId ? `/${encodeURIComponent(teamId)}` : ""}`;
  register(
    "list_teams",
    "List organizing teams, including archived teams, with caller-readable project counts. Teams grant no project access.",
    z.object(scope),
    ({ workspaceId }) => client.json(path(workspaceId)),
  );
  register(
    "get_team",
    "Get an organizing team and caller-readable counts.",
    z.object(item),
    ({ workspaceId, teamId }) => client.json(path(workspaceId, teamId)),
  );
  register(
    "create_team",
    "Create a workspace team. Requires team:create. Keys contain 2–5 uppercase letters, unique in the workspace.",
    z.object({ ...scope, ...fields }),
    ({ workspaceId, ...body }) =>
      client.json(path(workspaceId), {
        method: "POST",
        body: JSON.stringify(body),
      }),
  );
  register(
    "update_team",
    "Edit team metadata. Explicit null clears icon, color or lead; omitted fields remain unchanged.",
    z.object({ ...item, ...z.object(fields).partial().shape }),
    ({ workspaceId, teamId, ...body }) =>
      client.json(path(workspaceId, teamId), {
        method: "PUT",
        body: JSON.stringify(body),
      }),
  );
  register(
    "archive_team",
    "Archive a team or pass archived=false to restore it. Existing project assignments remain; archived teams reject new assignments and members.",
    z.object({ ...item, archived: z.boolean() }),
    ({ workspaceId, teamId, archived }) =>
      client.json(path(workspaceId, teamId), {
        method: "PUT",
        body: JSON.stringify({ archived }),
      }),
  );
  register(
    "delete_team",
    "Delete a team while preserving all projects and tasks. Projects become No team.",
    z.object(item),
    ({ workspaceId, teamId }) =>
      client.json(path(workspaceId, teamId), { method: "DELETE" }),
  );
  register(
    "list_team_members",
    "List current workspace members belonging to a team.",
    z.object(item),
    ({ workspaceId, teamId }) =>
      client.json(`${path(workspaceId, teamId)}/members`),
  );
  register(
    "add_team_member",
    "Add an existing workspace member. Requires team manager or lead; API keys also require team:update. Does not grant project access.",
    z.object(member),
    ({ workspaceId, teamId, userId }) =>
      client.json(
        `${path(workspaceId, teamId)}/members/${encodeURIComponent(userId)}`,
        { method: "POST" },
      ),
  );
  register(
    "remove_team_member",
    "Remove membership without changing project access. Requires manager or lead and, for API keys, team:update.",
    z.object(member),
    ({ workspaceId, teamId, userId }) =>
      client.json(
        `${path(workspaceId, teamId)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      ),
  );
  register(
    "set_project_team",
    "Assign a project to a team in its workspace, or pass teamId=null to clear ownership. Tasks derive their team from the project; identifiers and visibility stay unchanged.",
    z.object({ projectId: id, teamId: id.nullable() }),
    ({ projectId, teamId }) =>
      client.json(`/api/parity/project-plan/${encodeURIComponent(projectId)}`, {
        method: "PUT",
        body: JSON.stringify({ teamId }),
      }),
  );
}
