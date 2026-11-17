import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { teamExtTable } from "../../apps/api/src/database/schema-parity";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("PARITY_FEATURES", "teams");
});
afterEach(() => vi.unstubAllEnvs());
async function setup() {
  const { app } = createApp();
  const owner = await signUpWithSession(app, {
    name: "Team owner",
    email: "team-auth@example.com",
    role: "user",
  });
  const post = (path: string, body: object) =>
    app.request(`/api/auth/organization/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "http://localhost:5173",
        cookie: owner.cookies,
      },
      body: JSON.stringify(body),
    });
  const response = await post("create", {
    name: "Team auth",
    slug: "team-auth",
  });
  expect(response.status).toBe(200);
  const workspace = (await response.json()) as { id: string };
  return { app, owner, post, workspace };
}
it("provisions the provider default team and blocks direct and indirect raw writes", async () => {
  const { workspace, post } = await setup();
  const [team] = await db
    .select()
    .from(schema.teamTable)
    .where(eq(schema.teamTable.workspaceId, workspace.id));
  expect(
    await db
      .select()
      .from(teamExtTable)
      .where(eq(teamExtTable.teamId, team.id)),
  ).toHaveLength(1);
  for (const path of [
    "create-team",
    "update-team",
    "remove-team",
    "add-team-member",
    "remove-team-member",
  ])
    for (const organization of [
      {},
      { organizationId: workspace.id },
      { organizationId: "other" },
    ]) {
      const response = await post(path, {
        ...organization,
        name: "Blocked",
        teamId: team.id,
        userId: "other",
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        code: "TEAMS_PARITY_ROUTE_REQUIRED",
      });
    }
  expect(
    (
      await post("invite-member", {
        organizationId: workspace.id,
        email: "invite@example.com",
        role: "member",
        teamId: team.id,
      })
    ).status,
  ).toBe(403);
  expect(await db.select().from(schema.teamTable)).toHaveLength(1);
});
it("rejects old team-bearing invitation acceptance but leaves workspace invites available", async () => {
  const { workspace, post, owner } = await setup();
  const [team] = await db
    .select()
    .from(schema.teamTable)
    .where(eq(schema.teamTable.workspaceId, workspace.id));
  await db.insert(schema.invitationTable).values({
    id: "legacy-invitation",
    workspaceId: workspace.id,
    email: "invite@example.com",
    role: "member",
    teamId: team.id,
    status: "pending",
    expiresAt: new Date(Date.now() + 86400000),
    inviterId: owner.userId,
  });
  expect(
    (await post("accept-invitation", { invitationId: "legacy-invitation" }))
      .status,
  ).toBe(403);
  const response = await post("invite-member", {
    organizationId: workspace.id,
    email: "plain@example.com",
    role: "member",
  });
  expect(response.status).toBe(200);
});

it("reconciles team leads and memberships when a member leaves through native auth", async () => {
  const { app, workspace, owner } = await setup();
  const member = await signUpWithSession(app, {
    name: "Leaving member",
    email: "leaving-team@example.com",
    role: "user",
  });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: workspace.id,
    userId: member.userId,
    role: "member",
    joinedAt: new Date(),
  });
  const call = (path: string, method: string, body?: object) =>
    app.request(`/api/parity/${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        Origin: "http://localhost:5173",
        cookie: owner.cookies,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const response = await call(`teams/${workspace.id}`, "POST", {
    name: "Leave QA",
    key: "LVE",
    leadId: member.userId,
  });
  expect(response.status).toBe(201);
  const team = (await response.json()) as { id: string };
  expect(
    (
      await call(
        `teams/${workspace.id}/${team.id}/members/${member.userId}`,
        "POST",
      )
    ).status,
  ).toBe(200);
  const leave = await app.request("/api/auth/organization/leave", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Origin: "http://localhost:5173",
      cookie: member.cookies,
    },
    body: JSON.stringify({ organizationId: workspace.id }),
  });
  expect(leave.status).toBe(200);
  expect(
    (
      await db
        .select()
        .from(teamExtTable)
        .where(eq(teamExtTable.teamId, team.id))
    )[0].leadId,
  ).toBeNull();
  expect(
    await db
      .select()
      .from(schema.teamMemberTable)
      .where(eq(schema.teamMemberTable.userId, member.userId)),
  ).toEqual([]);
  expect(
    (
      await db
        .select()
        .from(schema.teamTable)
        .where(eq(schema.teamTable.id, team.id))
    )[0].memberCount,
  ).toBe(0);
});

it("does not bypass owned rules through trailing, encoded or bearer auth team writes", async () => {
  const { app, post, owner, workspace } = await setup();
  for (const path of ["create-team/", "%63reate-team"]) {
    const response = await post(path, {
      organizationId: workspace.id,
      name: "Bypass",
    });
    expect([200, 201]).not.toContain(response.status);
  }
  const [session] = await db
    .select({ token: schema.sessionTable.token })
    .from(schema.sessionTable)
    .where(eq(schema.sessionTable.userId, owner.userId));
  const response = await app.request("/api/auth/organization/create-team", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Origin: "http://localhost:5173",
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({
      organizationId: workspace.id,
      name: "Bearer bypass",
    }),
  });
  expect(response.status).toBe(403);
  expect(await db.select().from(schema.teamTable)).toHaveLength(1);
});
