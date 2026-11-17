import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { teamExtTable } from "../../apps/api/src/database/schema-parity";
import { provisionWorkspaceTeams } from "../../apps/api/src/parity/teams/provision";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";
import { projectAccessApi } from "./helpers/project-access/project-access-api";
beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("PARITY_FEATURES", "teams,roadmap,initiatives");
});
afterEach(() => vi.unstubAllEnvs());
async function setup() {
  const c = await createRestrictedWorkspace();
  mockAuthenticatedSession(c.owner);
  const request = projectAccessApi();
  const send = async (
    path: string,
    method = "GET",
    body?: unknown,
    status = 200,
  ) => {
    const response = await request(`/parity/${path}`, { method, body });
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(status);
    return result;
  };
  const team = await send(
    `teams/${c.workspace.id}`,
    "POST",
    { name: "Engineering", key: "ENG" },
    201,
  );
  return { ...c, request, send, team };
}
it("creates, edits, archives, restores and deletes while retaining projects and tasks", async () => {
  const c = await setup();
  const root = `teams/${c.workspace.id}/${c.team.id}`;
  expect(c.team).toMatchObject({ key: "ENG", projectCount: 0, memberCount: 0 });
  await c.send(`project-plan/${c.alpha.id}`, "PUT", { teamId: c.team.id });
  await c.send(`project-plan/${c.beta.id}`, "PUT", { teamId: c.team.id });
  expect(await c.send(root)).toMatchObject({ projectCount: 2 });
  await c.send(root, "PUT", {
    description: "Owns delivery",
    leadId: c.restricted.id,
    color: "#123456",
  });
  await c.send(root, "PUT", { archived: true });
  await c.send(`project-plan/${c.alpha.id}`, "PUT", { teamId: c.team.id }, 409);
  await c.send(`${root}/members/${c.restricted.id}`, "POST", undefined, 409);
  await c.send(`project-plan/${c.alpha.id}`, "PUT", { teamId: null });
  await c.send(root, "PUT", { archived: false, leadId: null, color: null });
  await c.send(root, "DELETE");
  expect(await c.send(`project-plan/${c.beta.id}`)).toMatchObject({
    teamId: null,
  });
  expect(await db.select().from(schema.projectTable)).toHaveLength(2);
  expect(await db.select().from(schema.taskTable)).toHaveLength(2);
});
it("counts and filters only readable projects, including negative and No team filters", async () => {
  const c = await setup();
  await c.send(`project-plan/${c.alpha.id}`, "PUT", { teamId: c.team.id });
  await c.send(`project-plan/${c.beta.id}`, "PUT", { teamId: c.team.id });
  mockAuthenticatedSession(c.restricted);
  expect(await c.send(`teams/${c.workspace.id}/${c.team.id}`)).toMatchObject({
    projectCount: 1,
  });
  const projects = await c.send(
    `project-plan/workspace/${c.workspace.id}?team=${c.team.id}`,
  );
  expect(projects.items.map((p: { id: string }) => p.id)).toEqual([c.alpha.id]);
  const issues = await c.send(`tasks/${c.workspace.id}?team=${c.team.id}`);
  expect(issues.items.map((task: { id: string }) => task.id)).toEqual([
    c.alphaTask.id,
  ]);
  expect(JSON.stringify(issues)).not.toContain("Hidden beta");
  const filters = encodeURIComponent(
    JSON.stringify([
      { field: "team", operator: "is-not", values: [c.team.id] },
    ]),
  );
  expect(
    (await c.send(`tasks/${c.workspace.id}?filters=${filters}`)).items,
  ).toEqual([]);
  expect((await c.send(`tasks/${c.workspace.id}?team=none`)).items).toEqual([]);
});
it("enforces management, lead membership, cross-workspace boundaries and idempotence", async () => {
  const c = await setup();
  const root = `teams/${c.workspace.id}/${c.team.id}`;
  const outsider = await createWorkspaceMember();
  await c.send(`${root}/members/${outsider.user.id}`, "POST", undefined, 400);
  await c.send(root, "PUT", { leadId: c.restricted.id });
  mockAuthenticatedSession(c.restricted);
  await c.send(root, "PUT", { name: "Denied" }, 403);
  await c.send(
    `teams/${c.workspace.id}`,
    "POST",
    { name: "Denied", key: "NO" },
    403,
  );
  await c.send(`${root}/members/${c.restricted.id}`, "POST");
  await c.send(`${root}/members/${c.restricted.id}`, "POST");
  expect(await c.send(root)).toMatchObject({ memberCount: 1 });
  await c.send(`${root}/members/${c.restricted.id}`, "DELETE");
  expect(await c.send(root)).toMatchObject({ memberCount: 0 });
  mockAuthenticatedSession(outsider.user);
  expect((await c.request(`/parity/${root}`)).status).toBe(404);
  mockAuthenticatedSession(c.owner);
  await c.send(
    `project-plan/${c.alpha.id}`,
    "PUT",
    { teamId: "foreign-team" },
    404,
  );
});
it("serializes duplicate keys and the ten-team limit", async () => {
  const c = await setup();
  const root = `teams/${c.workspace.id}`;
  const duplicates = await Promise.all(
    ["A", "B"].map((name) =>
      c.request(`/parity/${root}`, {
        method: "POST",
        body: { name, key: "DUP" },
      }),
    ),
  );
  expect(duplicates.map((r) => r.status).sort()).toEqual([201, 409]);
  for (let index = 0; index < 7; index++)
    await c.send(
      root,
      "POST",
      { name: `Team ${index}`, key: `T${String.fromCharCode(65 + index)}` },
      201,
    );
  const final = await Promise.all(
    ["ZZ", "YY"].map((key) =>
      c.request(`/parity/${root}`, {
        method: "POST",
        body: { name: key, key },
      }),
    ),
  );
  expect(final.map((r) => r.status).sort()).toEqual([201, 409]);
});
it("provisions legacy identities repeatedly and concurrently without assigning projects", async () => {
  const c = await setup();
  await db.insert(schema.teamTable).values({
    id: "legacy-team",
    name: "Engineering",
    workspaceId: c.workspace.id,
    createdAt: new Date(),
  });
  await Promise.all([
    provisionWorkspaceTeams(c.workspace.id),
    provisionWorkspaceTeams(c.workspace.id),
  ]);
  expect(
    await db
      .select()
      .from(teamExtTable)
      .where(eq(teamExtTable.teamId, "legacy-team")),
  ).toHaveLength(1);
  expect((await c.send(`project-plan/${c.alpha.id}`)).teamId).toBeNull();
});
it("keeps the feature-off contract and rejects team filters and writes", async () => {
  const c = await setup();
  vi.stubEnv("PARITY_FEATURES", "projects,views");
  expect((await c.request(`/parity/teams/${c.workspace.id}`)).status).toBe(404);
  const plan = await c.send(`project-plan/${c.alpha.id}`);
  expect(plan).not.toHaveProperty("teamId");
  await c.send(`project-plan/${c.alpha.id}`, "PUT", { teamId: null }, 404);
  await c.send(`tasks/${c.workspace.id}?team=none`, "GET", undefined, 404);
  const filter = encodeURIComponent(
    JSON.stringify([{ field: "team", operator: "is", values: [null] }]),
  );
  await c.send(
    `tasks/${c.workspace.id}?filters=${filter}`,
    "GET",
    undefined,
    404,
  );
});
it("denies viewer management and membership without lead permission", async () => {
  const c = await setup();
  const viewer = await addWorkspaceMember(c.workspace.id, "viewer");
  mockAuthenticatedSession(viewer);
  await c.send(`teams/${c.workspace.id}`, "GET");
  await c.send(
    `teams/${c.workspace.id}/${c.team.id}`,
    "DELETE",
    undefined,
    403,
  );
  await c.send(
    `teams/${c.workspace.id}/${c.team.id}/members/${viewer.id}`,
    "POST",
    undefined,
    403,
  );
});
it("requires explicit API-key scopes for team writes and project assignment", async () => {
  const c = await setup();
  const { createHash } = await import("node:crypto");
  const { mockAnonymousSession } = await import("./helpers/auth");
  const key = `teams-read-${c.owner.id}`.padEnd(64, "x");
  await db.insert(schema.apikeyTable).values({
    referenceId: c.owner.id,
    userId: c.owner.id,
    key: createHash("sha256").update(key).digest("base64url"),
    createdAt: new Date(),
    updatedAt: new Date(),
    enabled: true,
    permissions: JSON.stringify({
      workspace: ["read"],
      project: ["read"],
      task: ["read"],
    }),
  });
  mockAnonymousSession();
  const request = projectAccessApi({ "x-api-key": key });
  expect((await request(`/parity/teams/${c.workspace.id}`)).status).toBe(200);
  for (const [path, method, body] of [
    [`teams/${c.workspace.id}`, "POST", { name: "Denied", key: "NO" }],
    [`teams/${c.workspace.id}/${c.team.id}`, "PUT", { name: "Denied" }],
    [`teams/${c.workspace.id}/${c.team.id}`, "DELETE", undefined],
    [
      `teams/${c.workspace.id}/${c.team.id}/members/${c.owner.id}`,
      "POST",
      undefined,
    ],
    [`project-plan/${c.alpha.id}`, "PUT", { teamId: c.team.id }],
  ] as const)
    expect((await request(`/parity/${path}`, { method, body })).status).toBe(
      403,
    );
});

it("allows an admin role and requires instance administrators to join before reading", async () => {
  const c = await setup();
  const admin = await addWorkspaceMember(c.workspace.id, "admin");
  mockAuthenticatedSession(admin);
  const team = await c.send(
    `teams/${c.workspace.id}`,
    "POST",
    { name: "Admin team", key: "ADM" },
    201,
  );
  await c.send(`teams/${c.workspace.id}/${team.id}`, "PUT", {
    description: "Admin editable",
  });
  const outsider = await createWorkspaceMember();
  await db
    .update(schema.userTable)
    .set({ role: "admin" })
    .where(eq(schema.userTable.id, outsider.user.id));
  mockAuthenticatedSession({ ...outsider.user, role: "admin" });
  expect((await c.request(`/parity/teams/${c.workspace.id}`)).status).toBe(404);
});
it("keeps hidden projects out of real authorized MCP tool responses", async () => {
  const c = await setup();
  await c.send(`project-plan/${c.alpha.id}`, "PUT", { teamId: c.team.id });
  await c.send(`project-plan/${c.beta.id}`, "PUT", { teamId: c.team.id });
  mockAuthenticatedSession(c.restricted);
  const { registerTools } =
    await import("../../packages/mcp/src/tools/register");
  const handlers = new Map<string, (input: unknown) => Promise<unknown>>();
  registerTools(
    {
      registerTool: (name, _config, handler) => {
        handlers.set(name, handler);
      },
    },
    {
      client: {
        json: async <T>(path: string, init?: RequestInit): Promise<T> => {
          const response = await c.request(path.replace(/^\/api/, ""), {
            method: init?.method,
            body:
              typeof init?.body === "string"
                ? JSON.parse(init.body)
                : undefined,
          });
          if (!response.ok) throw new Error(String(response.status));
          return response.json();
        },
      },
    },
  );
  for (const [name, args] of [
    ["list_teams", { workspaceId: c.workspace.id }],
    ["get_team", { workspaceId: c.workspace.id, teamId: c.team.id }],
    ["list_projects", { workspaceId: c.workspace.id, team: c.team.id }],
    ["list_workspace_tasks", { workspaceId: c.workspace.id, team: c.team.id }],
  ] as const) {
    const result = JSON.stringify(await handlers.get(name)!(args));
    expect(result).not.toContain(c.beta.id);
    expect(result).not.toContain("Hidden beta");
    if (name === "list_teams" || name === "get_team")
      expect(result).toMatch(/projectCount\\":\s*1/);
  }
});

it("ignores moved assignments immediately and reconciles hints to both workspaces", async () => {
  const c = await setup();
  await c.send(`project-plan/${c.alpha.id}`, "PUT", { teamId: c.team.id });
  const destination = await createWorkspaceMember({ role: "owner" });
  const { initializeTeams } =
    await import("../../apps/api/src/parity/teams/initialize");
  const teamEvents = await import("../../apps/api/src/parity/teams/events");
  const hints = vi.spyOn(teamEvents, "publishTeamEvent");
  await initializeTeams();
  await db
    .update(schema.projectTable)
    .set({ workspaceId: destination.workspace.id })
    .where(eq(schema.projectTable.id, c.alpha.id));
  expect(await c.send(`teams/${c.workspace.id}/${c.team.id}`)).toMatchObject({
    projectCount: 0,
  });
  const { publishEvent } = await import("../../apps/api/src/events");
  await publishEvent(
    "project.updated",
    { projectId: c.alpha.id },
    { waitForHandlers: true },
  );
  expect(hints).toHaveBeenCalledWith(c.workspace.id, "PROJECT_TEAM_UPDATED");
  expect(hints).toHaveBeenCalledWith(
    destination.workspace.id,
    "PROJECT_TEAM_UPDATED",
  );
  mockAuthenticatedSession(destination.user);
  expect(await c.send(`project-plan/${c.alpha.id}`)).toMatchObject({
    teamId: null,
  });
});
