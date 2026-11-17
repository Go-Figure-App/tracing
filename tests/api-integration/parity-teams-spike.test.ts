import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

beforeEach(async () => {
  vi.stubEnv("PARITY_FEATURES", "");
  await resetTestDatabase();
});
afterEach(() => vi.unstubAllEnvs());

// Characterize the installed provider before choosing the Teams identity store.
// These assertions describe the existing feature-disabled contract, not Teams v1.
async function fixture() {
  const { app } = createApp();
  const owner = await signUpWithSession(app, {
    name: "Teams spike owner",
    email: "teams-owner@example.com",
    role: "user",
  });
  const post = (path: string, body: object, cookie = owner.cookies) =>
    app.request(`/api/auth/organization/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "http://localhost:5173",
        cookie,
      },
      body: JSON.stringify(body),
    });
  const created = await post("create", {
    name: "Teams spike",
    slug: "teams-spike",
  });
  expect(created.status).toBe(200);
  const workspace = (await created.json()) as { id: string };
  const [team] = await db
    .select()
    .from(schema.teamTable)
    .where(eq(schema.teamTable.workspaceId, workspace.id));
  const get = (path: string, cookie = owner.cookies) =>
    app.request(`/api/auth/organization/${path}`, { headers: { cookie } });
  return { app, owner, post, get, workspace, team };
}

describe("Teams design spike: existing Better Auth contract", () => {
  it("can reject raw team writes through config without changing provider code", async () => {
    const { owner, workspace } = await fixture();
    // A separate provider instance demonstrates the proposed mount; the real
    // application config and feature-disabled behavior remain unchanged.
    const guarded = betterAuth({
      ...auth.options,
      hooks: {
        ...auth.options.hooks,
        before: createAuthMiddleware(async (ctx) => {
          await auth.options.hooks?.before?.(ctx);
          if (ctx.path === "/organization/create-team") {
            throw new APIError("FORBIDDEN", {
              code: "TEAMS_PARITY_ROUTE_REQUIRED",
              message: "Use the owned team endpoint",
            });
          }
        }),
      },
    });
    const response = await guarded.handler(
      new Request("http://localhost:1337/api/auth/organization/create-team", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: "http://localhost:5173",
          cookie: owner.cookies,
        },
        body: JSON.stringify({ name: "Blocked", organizationId: workspace.id }),
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "TEAMS_PARITY_ROUTE_REQUIRED",
    });
    expect(await db.select().from(schema.teamTable)).toHaveLength(1);
  });

  it("creates a default team, owner membership and active team with each workspace", async () => {
    const { app, owner, team } = await fixture();
    expect(team).toMatchObject({ name: "Teams spike", memberCount: 1 });
    expect(await db.select().from(schema.teamMemberTable)).toMatchObject([
      {
        teamId: team.id,
        userId: owner.userId,
        membershipKey: expect.any(String),
      },
    ]);
    const session = await app.request("/api/auth/get-session", {
      headers: { cookie: owner.cookies },
    });
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      session: { activeTeamId: team.id },
    });
  });

  it("counts the default team toward the ten-team limit", async () => {
    const { post, workspace } = await fixture();
    for (let index = 1; index < 10; index++) {
      expect(
        (
          await post("create-team", {
            name: `Team ${index}`,
            organizationId: workspace.id,
          })
        ).status,
      ).toBe(200);
    }
    const overflow = await post("create-team", {
      name: "Eleventh team",
      organizationId: workspace.id,
    });
    expect(overflow.status).toBe(400);
    expect(await overflow.json()).toMatchObject({
      code: "YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS",
    });
    expect(await db.select().from(schema.teamTable)).toHaveLength(10);
  });

  it("rejects active-team deletion and then last-team deletion after clearing the active team", async () => {
    const { post, workspace, team } = await fixture();
    const body = { teamId: team.id, organizationId: workspace.id };
    expect((await post("remove-team", body)).status).toBe(403);
    expect((await post("set-active-team", { teamId: null })).status).toBe(200);
    const last = await post("remove-team", body);
    expect(last.status).toBe(400);
    expect(await last.json()).toMatchObject({
      code: "UNABLE_TO_REMOVE_LAST_TEAM",
    });
    expect(await db.select().from(schema.teamTable)).toHaveLength(1);
  });

  it("allows workspace readers to list teams, restricts member listing to team members and denies member writes", async () => {
    const { app, post, get, team, workspace } = await fixture();
    for (const role of ["viewer", "member", "admin"]) {
      const person = await signUpWithSession(app, {
        name: role,
        email: `${role}@teams-spike.example.com`,
        role: "user",
      });
      await db.insert(schema.workspaceUserTable).values({
        userId: person.userId,
        workspaceId: workspace.id,
        role,
        joinedAt: new Date(),
      });
      expect(
        (await get(`list-teams?organizationId=${workspace.id}`, person.cookies))
          .status,
      ).toBe(200);
      expect(
        (await get(`list-team-members?teamId=${team.id}`, person.cookies))
          .status,
      ).toBe(400);
      expect(
        (
          await post(
            "create-team",
            { name: `${role} team`, organizationId: workspace.id },
            person.cookies,
          )
        ).status,
      ).toBe(role === "admin" ? 200 : 403);
      const membership = {
        teamId: team.id,
        userId: person.userId,
        organizationId: workspace.id,
      };
      expect(
        (await post("add-team-member", membership, person.cookies)).status,
      ).toBe(role === "admin" ? 200 : 403);
      if (role === "admin") {
        expect(
          (await get(`list-team-members?teamId=${team.id}`, person.cookies))
            .status,
        ).toBe(200);
        expect(
          (await post("remove-team-member", membership, person.cookies)).status,
        ).toBe(200);
      }
    }
    const outsider = await signUpWithSession(app, {
      name: "Outsider",
      email: "outsider@teams-spike.example.com",
      role: "user",
    });
    expect(
      (await get(`list-teams?organizationId=${workspace.id}`, outsider.cookies))
        .status,
    ).toBe(403);
    expect(
      (await get(`list-teams?organizationId=${workspace.id}`, "")).status,
    ).toBe(401);
    expect(
      (
        await post("add-team-member", {
          teamId: team.id,
          userId: outsider.userId,
          organizationId: workspace.id,
        })
      ).status,
    ).toBe(400);
  });
});
