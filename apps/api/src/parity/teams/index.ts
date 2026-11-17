import { createRoute, jsonResponse, z } from "../../openapi";
import {
  hasWorkspacePermission,
  requireApiKeyScope,
  requireWorkspacePermission,
} from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { requireParity } from "../foundation/features";
import { actor } from "../planning/access";
import { body, errors, planningRouter } from "../planning/routes/shared";
import { requireTeamWorkspaceMember } from "./membership";
import { getTeam, listTeamMembers, listTeams } from "./read";
import { teamBody, teamMemberSchema, teamPatch, teamSchema } from "./schema";
import { changeTeamMember, createTeam, deleteTeam, updateTeam } from "./write";

const id = z.string().min(1).max(128);
const workspaceParams = z.object({ workspaceId: id });
const teamParams = workspaceParams.extend({ teamId: id });
const memberParams = teamParams.extend({ userId: id });
const read = [
  requireParity("teams"),
  workspaceAccess.fromParam(),
  requireTeamWorkspaceMember,
  requireWorkspacePermission({ workspace: ["read"] }),
] as const;
const tags = ["Teams"];
const success = z.object({ success: z.literal(true) });

const list = createRoute({
  method: "get",
  path: "/{workspaceId}",
  operationId: "listTeams",
  tags,
  summary:
    "List workspace teams with membership and caller-readable project counts",
  middleware: [...read],
  request: { params: workspaceParams },
  responses: {
    200: jsonResponse("Teams, including archived teams", z.array(teamSchema)),
    ...errors,
  },
});
const get = createRoute({
  method: "get",
  path: "/{workspaceId}/{teamId}",
  operationId: "getTeam",
  tags,
  summary: "Get a team without granting project visibility",
  middleware: [...read],
  request: { params: teamParams },
  responses: {
    200: jsonResponse("Team and caller-readable counts", teamSchema),
    ...errors,
  },
});
const create = createRoute({
  method: "post",
  path: "/{workspaceId}",
  operationId: "createTeam",
  tags,
  summary:
    "Create an organizing team with a unique workspace key (at most ten teams)",
  middleware: [...read, requireWorkspacePermission({ team: ["create"] })],
  request: { params: workspaceParams, body: body(teamBody) },
  responses: { 201: jsonResponse("Created team", teamSchema), ...errors },
});
const update = createRoute({
  method: "put",
  path: "/{workspaceId}/{teamId}",
  operationId: "updateTeam",
  tags,
  summary: "Edit, archive or restore a team; null clears icon, color or lead",
  middleware: [...read, requireWorkspacePermission({ team: ["update"] })],
  request: { params: teamParams, body: body(teamPatch) },
  responses: { 200: jsonResponse("Updated team", teamSchema), ...errors },
});
const remove = createRoute({
  method: "delete",
  path: "/{workspaceId}/{teamId}",
  operationId: "deleteTeam",
  tags,
  summary:
    "Delete a team, retaining every project and task and clearing team assignments",
  middleware: [...read, requireWorkspacePermission({ team: ["delete"] })],
  request: { params: teamParams },
  responses: {
    200: jsonResponse("Team deleted; projects retained", success),
    ...errors,
  },
});
const members = createRoute({
  method: "get",
  path: "/{workspaceId}/{teamId}/members",
  operationId: "listTeamMembers",
  tags,
  summary: "List team members; workspace readers need not join the team",
  middleware: [...read],
  request: { params: teamParams },
  responses: {
    200: jsonResponse(
      "Current workspace members in this team",
      z.array(teamMemberSchema),
    ),
    ...errors,
  },
});
const addMember = createRoute({
  method: "post",
  path: "/{workspaceId}/{teamId}/members/{userId}",
  operationId: "addTeamMember",
  tags,
  summary:
    "Add a workspace member as team manager or lead; API keys require team:update",
  middleware: [...read, requireApiKeyScope({ team: ["update"] })],
  request: { params: memberParams },
  responses: {
    200: jsonResponse("Member added idempotently", success),
    ...errors,
  },
});
const removeMember = createRoute({
  method: "delete",
  path: "/{workspaceId}/{teamId}/members/{userId}",
  operationId: "removeTeamMember",
  tags,
  summary:
    "Remove a team member as manager or lead without changing project access",
  middleware: [...read, requireApiKeyScope({ team: ["update"] })],
  request: { params: memberParams },
  responses: {
    200: jsonResponse("Member removed idempotently", success),
    ...errors,
  },
});

export default planningRouter()
  .openapi(list, async (c) =>
    c.json(
      await listTeams(
        actor(c),
        await hasWorkspacePermission(c, { project: ["read"] }),
      ),
      200,
    ),
  )
  .openapi(get, async (c) =>
    c.json(
      await getTeam(
        actor(c),
        c.req.valid("param").teamId,
        await hasWorkspacePermission(c, { project: ["read"] }),
      ),
      200,
    ),
  )
  .openapi(create, async (c) => {
    const teamId = await createTeam(actor(c), c.req.valid("json"));
    return c.json(
      await getTeam(
        actor(c),
        teamId,
        await hasWorkspacePermission(c, { project: ["read"] }),
      ),
      201,
    );
  })
  .openapi(update, async (c) => {
    const { teamId } = c.req.valid("param");
    await updateTeam(actor(c), teamId, c.req.valid("json"));
    return c.json(
      await getTeam(
        actor(c),
        teamId,
        await hasWorkspacePermission(c, { project: ["read"] }),
      ),
      200,
    );
  })
  .openapi(remove, async (c) => {
    await deleteTeam(actor(c), c.req.valid("param").teamId);
    return c.json({ success: true as const }, 200);
  })
  .openapi(members, async (c) =>
    c.json(await listTeamMembers(actor(c), c.req.valid("param").teamId), 200),
  )
  .openapi(addMember, async (c) => {
    const { teamId, userId } = c.req.valid("param");
    await changeTeamMember(
      actor(c),
      teamId,
      userId,
      true,
      await hasWorkspacePermission(c, { team: ["update"] }),
    );
    return c.json({ success: true as const }, 200);
  })
  .openapi(removeMember, async (c) => {
    const { teamId, userId } = c.req.valid("param");
    await changeTeamMember(
      actor(c),
      teamId,
      userId,
      false,
      await hasWorkspacePermission(c, { team: ["update"] }),
    );
    return c.json({ success: true as const }, 200);
  });
