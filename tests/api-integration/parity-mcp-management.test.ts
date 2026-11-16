import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { registerTools } from "../../packages/mcp/src/tools/register";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("PARITY_FEATURES", "projects,initiatives,cycles");
});
afterEach(() => vi.unstubAllEnvs());

async function setup() {
  const c = await createRestrictedWorkspace();
  mockAuthenticatedSession(c.owner);
  const request = projectAccessApi();
  const tools = new Map<string, (input: unknown) => Promise<CallToolResult>>();
  registerTools(
    { registerTool: (name, _config, callback) => tools.set(name, callback) },
    {
      client: {
        async json<T>(path: string, init?: RequestInit): Promise<T> {
          const response = await request(path.replace(/^\/api/, ""), {
            method: init?.method,
            body: init?.body ? JSON.parse(String(init.body)) : undefined,
          });
          const body = await response.json();
          if (!response.ok)
            throw new Error(`${response.status}: ${JSON.stringify(body)}`);
          return body as T;
        },
      },
    },
  );
  const raw = (name: string, input: unknown) => tools.get(name)!(input);
  const call = async (name: string, input: unknown) => {
    const result = await raw(name, input);
    expect(result.isError, JSON.stringify(result.content)).toBe(false);
    const content = result.content[0];
    if (content?.type !== "text") throw new Error("Expected JSON tool content");
    return JSON.parse(content.text);
  };
  return { ...c, raw, call, request };
}

it("manages milestone content, order and task assignment without losing issues", async () => {
  const c = await setup();
  const first = await c.call("create_milestone", {
    projectId: c.alpha.id,
    name: "Launch",
    description: "## Retain context",
    targetDate: "2027-03-01",
  });
  const second = await c.call("create_milestone", {
    projectId: c.alpha.id,
    name: "Followup",
  });
  await c.call("update_milestone", { id: second.id, position: 0 });
  await c.call("update_milestone", {
    id: first.id,
    position: 1,
    targetDate: null,
  });
  const milestones = await c.call("list_milestones", { projectId: c.alpha.id });
  expect(milestones.map((m: { id: string }) => m.id)).toEqual([
    second.id,
    first.id,
  ]);
  expect(milestones[1]).toMatchObject({
    description: "## Retain context",
    targetDate: null,
  });
  await c.call("update_task_milestone", {
    taskId: c.alphaTask.id,
    milestoneId: first.id,
  });
  expect(
    await c.call("get_task_milestone", { taskId: c.alphaTask.id }),
  ).toMatchObject({ milestoneId: first.id });
  expect(
    (
      await c.raw("update_task_milestone", {
        taskId: c.betaTask.id,
        milestoneId: first.id,
      })
    ).isError,
  ).toBe(true);
  await c.call("update_task_milestone", {
    taskId: c.alphaTask.id,
    milestoneId: null,
  });
  await c.call("update_task_milestone", {
    taskId: c.alphaTask.id,
    milestoneId: first.id,
  });
  mockAuthenticatedSession(c.restricted);
  expect(
    (await c.raw("create_milestone", { projectId: c.beta.id, name: "Hidden" }))
      .isError,
  ).toBe(true);
  mockAuthenticatedSession(c.owner);
  await c.call("delete_milestone", { id: first.id });
  expect(
    await c.call("get_task_milestone", { taskId: c.alphaTask.id }),
  ).toMatchObject({ milestoneId: null });
  expect((await c.request(`/task/${c.alphaTask.id}`)).status).toBe(200);
});

it("manages initiative edits, ordering, links, archive restoration and status feeds", async () => {
  const c = await setup();
  const first = await c.call("create_initiative", {
    workspaceId: c.workspace.id,
    name: "Launch",
    description: "Retain me",
    icon: "Flag",
    color: "#336699",
    ownerId: c.owner.id,
  });
  const second = await c.call("create_initiative", {
    workspaceId: c.workspace.id,
    name: "Second",
  });
  expect(
    await c.call("update_initiative", {
      id: first.id,
      name: "Release",
      status: "active",
      ownerId: null,
      targetDate: null,
    }),
  ).toMatchObject({
    name: "Release",
    description: "Retain me",
    ownerId: null,
    icon: "Flag",
  });
  await c.call("reorder_initiatives", {
    workspaceId: c.workspace.id,
    ids: [second.id, first.id],
  });
  expect(
    (
      await c.call("list_initiatives", { workspaceId: c.workspace.id })
    ).items.map((i: { id: string }) => i.id),
  ).toEqual([second.id, first.id]);
  expect(
    (
      await c.raw("reorder_initiatives", {
        workspaceId: c.workspace.id,
        ids: [first.id],
      })
    ).isError,
  ).toBe(true);
  await c.call("add_project_to_initiative", {
    initiativeId: first.id,
    projectId: c.alpha.id,
  });
  await c.call("add_project_to_initiative", {
    initiativeId: first.id,
    projectId: c.beta.id,
  });
  mockAuthenticatedSession(c.restricted);
  expect(
    (await c.call("get_initiative", { id: first.id })).projects.map(
      (p: { id: string }) => p.id,
    ),
  ).toEqual([c.alpha.id]);
  expect(
    (
      await c.raw("remove_project_from_initiative", {
        initiativeId: first.id,
        projectId: c.beta.id,
      })
    ).isError,
  ).toBe(true);
  expect(
    (await c.raw("update_initiative", { id: first.id, archived: true }))
      .isError,
  ).toBe(true);
  expect((await c.raw("delete_initiative", { id: first.id })).isError).toBe(
    true,
  );
  mockAuthenticatedSession(c.owner);
  await c.call("remove_project_from_initiative", {
    initiativeId: first.id,
    projectId: c.alpha.id,
  });
  await c.call("add_project_to_initiative", {
    initiativeId: first.id,
    projectId: c.alpha.id,
    position: 0,
  });
  await c.call("create_status_update", {
    parentType: "initiative",
    parentId: first.id,
    health: "at_risk",
    body: "## Needs review",
  });
  expect(
    (
      await c.call("list_status_updates", {
        parentType: "initiative",
        parentId: first.id,
        pageSize: 1,
      })
    ).items,
  ).toHaveLength(1);
  expect(
    (
      await c.call("list_status_updates", {
        parentType: "initiative",
        parentId: first.id,
        pageSize: 1,
        page: 2,
      })
    ).items,
  ).toEqual([]);
  await c.call("update_initiative", { id: first.id, archived: true });
  expect(
    (await c.call("list_initiatives", { workspaceId: c.workspace.id })).items,
  ).toHaveLength(1);
  await c.call("update_initiative", { id: first.id, archived: false });
  expect(
    (await c.call("get_initiative", { id: first.id })).projects,
  ).toHaveLength(2);
  await c.call("delete_initiative", { id: first.id });
  expect(
    (
      await c.call("list_initiatives", {
        workspaceId: c.workspace.id,
        includeArchived: true,
      })
    ).items,
  ).toHaveLength(1);
  expect((await c.request(`/project/${c.alpha.id}`)).status).toBe(200);
});

it("generates and edits cycles through cadence settings, filters issues and enforces lifecycle and access", async () => {
  const c = await setup();
  expect(
    await c.call("get_cycle_settings", { workspaceId: c.workspace.id }),
  ).toMatchObject({ cyclesEnabled: false });
  await c.call("update_cycle_settings", {
    workspaceId: c.workspace.id,
    cyclesEnabled: true,
    cycleWeeks: 1,
    upcomingCycles: 2,
    timeZone: "UTC",
    estimateScale: "t-shirt",
  });
  const current = (
    await c.call("list_cycles", {
      workspaceId: c.workspace.id,
      phase: "current",
    })
  ).items[0];
  const upcoming = (
    await c.call("list_cycles", {
      workspaceId: c.workspace.id,
      phase: "upcoming",
    })
  ).items[0];
  expect(
    await c.call("update_cycle", { id: current.id, name: "Launch" }),
  ).toMatchObject({ name: "Launch" });
  expect(
    await c.call("update_cycle", { id: current.id, name: null }),
  ).toMatchObject({ name: null });
  const startDate = new Date(Date.parse(upcoming.startsAt) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  expect(
    await c.call("update_cycle", { id: upcoming.id, startDate }),
  ).toMatchObject({ startsAt: `${startDate}T00:00:00.000Z` });
  expect(
    (await c.raw("update_cycle", { id: current.id, startDate })).isError,
  ).toBe(true);
  await c.call("update_task_cycle", {
    taskId: c.alphaTask.id,
    cycleId: current.id,
  });
  await c.call("update_task_cycle", {
    taskId: c.betaTask.id,
    cycleId: current.id,
  });
  const query = {
    id: current.id,
    projectId: c.alpha.id,
    search: "Visible",
    pageSize: 1,
  };
  expect(
    (await c.call("list_cycle_tasks", query)).items.map(
      (t: { id: string }) => t.id,
    ),
  ).toEqual([c.alphaTask.id]);
  expect(
    (await c.call("list_cycle_tasks", { ...query, page: 2 })).items,
  ).toEqual([]);
  mockAuthenticatedSession(c.restricted);
  expect(
    (await c.call("list_cycle_tasks", { id: current.id })).items.map(
      (t: { id: string }) => t.id,
    ),
  ).toEqual([c.alphaTask.id]);
  expect(
    (
      await c.raw("update_cycle_settings", {
        workspaceId: c.workspace.id,
        cyclesEnabled: false,
      })
    ).isError,
  ).toBe(true);
  mockAuthenticatedSession(c.owner);
  await c.call("update_task_cycle", { taskId: c.alphaTask.id, cycleId: null });
  await c.call("update_task_cycle", {
    taskId: c.alphaTask.id,
    cycleId: upcoming.id,
  });
  await c.call("update_cycle_settings", {
    workspaceId: c.workspace.id,
    cyclesEnabled: false,
  });
  expect(
    (
      await c.call("list_cycles", {
        workspaceId: c.workspace.id,
        phase: "upcoming",
      })
    ).items,
  ).toEqual([]);
  expect((await c.request(`/task/${c.alphaTask.id}`)).status).toBe(200);
});
