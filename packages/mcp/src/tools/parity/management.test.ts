import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { expect, it, vi } from "vite-plus/test";
import { registerTools } from "../register.js";

function fixture() {
  const tools = new Map<string, (input: unknown) => Promise<CallToolResult>>();
  const json = vi.fn().mockResolvedValue({ ok: true });
  registerTools(
    { registerTool: (name, _config, callback) => tools.set(name, callback) },
    { client: { json } },
  );
  return {
    json,
    call: (name: string, input: unknown) => tools.get(name)!(input),
  };
}

it("preserves omitted fields, explicit nulls and false values in planning edits", async () => {
  const { json, call } = fixture();
  for (const [name, input, path, body] of [
    [
      "update_milestone",
      { id: "a/b", targetDate: null, position: 0 },
      "milestone/item/a%2Fb",
      { targetDate: null, position: 0 },
    ],
    [
      "update_initiative",
      { id: "a/b", archived: false, ownerId: null, color: null },
      "initiative/item/a%2Fb",
      { archived: false, ownerId: null, color: null },
    ],
    [
      "update_cycle",
      { id: "a/b", name: null },
      "cycle/item/a%2Fb",
      { name: null },
    ],
    [
      "update_cycle_settings",
      {
        workspaceId: "a/b",
        cyclesEnabled: false,
        autoRollover: false,
        cooldownWeeks: 0,
        estimateScale: "t-shirt",
      },
      "cycle/settings/a%2Fb",
      {
        cyclesEnabled: false,
        autoRollover: false,
        cooldownWeeks: 0,
        estimateScale: "t-shirt",
      },
    ],
    [
      "update_task_milestone",
      { taskId: "a/b", milestoneId: null },
      "task/a%2Fb/milestone",
      { milestoneId: null },
    ],
  ] as const) {
    expect((await call(name, input)).isError).toBe(false);
    expect(json).toHaveBeenLastCalledWith(`/api/parity/${path}`, {
      method: "PUT",
      body: expect.any(String),
    });
    expect(JSON.parse(json.mock.lastCall![1].body)).toEqual(body);
  }
});

it("routes creates, deletions, reads and reordering through the authorized API", async () => {
  const { json, call } = fixture();
  for (const [name, input, path, method, body] of [
    [
      "create_milestone",
      { projectId: "a/b", name: "Ship", description: "## Scope" },
      "milestone/a%2Fb",
      "POST",
      { name: "Ship", description: "## Scope" },
    ],
    [
      "delete_milestone",
      { id: "a/b" },
      "milestone/item/a%2Fb",
      "DELETE",
      undefined,
    ],
    [
      "delete_initiative",
      { id: "a/b" },
      "initiative/item/a%2Fb",
      "DELETE",
      undefined,
    ],
    [
      "remove_project_from_initiative",
      { initiativeId: "a/b", projectId: "c/d" },
      "initiative/item/a%2Fb/project/c%2Fd",
      "DELETE",
      undefined,
    ],
    [
      "reorder_initiatives",
      { workspaceId: "a/b", ids: ["second", "first"] },
      "initiative/a%2Fb/reorder",
      "POST",
      { ids: ["second", "first"] },
    ],
    [
      "get_cycle_settings",
      { workspaceId: "a/b" },
      "cycle/settings/a%2Fb",
      "GET",
      undefined,
    ],
    [
      "get_task_milestone",
      { taskId: "a/b" },
      "task/a%2Fb/milestone",
      "GET",
      undefined,
    ],
  ] as const) {
    expect((await call(name, input)).isError).toBe(false);
    expect(json).toHaveBeenLastCalledWith(`/api/parity/${path}`, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
});

it("encodes filters and paginates cycle issues and status feeds", async () => {
  const { json, call } = fixture();
  await call("list_cycle_tasks", {
    id: "a/b",
    search: "R&D",
    category: "started",
    label: "one & two",
    page: 2,
    pageSize: 100,
  });
  const url = new URL(json.mock.lastCall![0], "https://test.invalid");
  expect(url.pathname).toBe("/api/parity/cycle/item/a%2Fb/tasks");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    search: "R&D",
    category: "started",
    label: "one & two",
    page: "2",
    pageSize: "100",
  });
  await call("list_status_updates", {
    parentType: "initiative",
    parentId: "a/b",
    page: 2,
  });
  expect(json).toHaveBeenLastCalledWith(
    "/api/parity/status-update/initiative/a%2Fb?page=2",
    { method: "GET" },
  );
});

it.each([
  ["create_milestone", { projectId: "p", name: " " }],
  ["update_milestone", { id: "m" }],
  ["update_milestone", { id: "m", targetDate: "2026-02-30" }],
  ["update_milestone", { id: "m", position: -1 }],
  ["update_task_milestone", { taskId: "t" }],
  ["update_initiative", { id: "i" }],
  ["update_initiative", { id: "i", color: "red" }],
  ["update_initiative", { id: "i", description: "x".repeat(50_001) }],
  ["reorder_initiatives", { workspaceId: "w", ids: ["i", "i"] }],
  [
    "reorder_initiatives",
    {
      workspaceId: "w",
      ids: Array.from({ length: 1001 }, (_, i) => String(i)),
    },
  ],
  ["update_cycle", { id: "c" }],
  ["update_cycle", { id: "c", startDate: null }],
  ["update_cycle_settings", { workspaceId: "w" }],
  ["update_cycle_settings", { workspaceId: "w", cycleWeeks: 9 }],
  ["update_cycle_settings", { workspaceId: "w", upcomingCycles: 16 }],
  ["update_cycle_settings", { workspaceId: "w", cycleStartDay: 7 }],
  ["update_cycle_settings", { workspaceId: "w", timeZone: "invalid/zone" }],
  ["update_cycle_settings", { workspaceId: "w", timeZone: "+05:00" }],
  ["update_cycle_settings", { workspaceId: "w", cycleWeek: 2 }],
  ["list_cycle_tasks", { id: "c", pageSize: 101 }],
  ["list_status_updates", { parentType: "cycle", parentId: "c" }],
])("rejects invalid %s input without an API call", async (name, input) => {
  const { json, call } = fixture();
  expect((await call(name, input)).isError).toBe(true);
  expect(json).not.toHaveBeenCalled();
});

it.each([
  "update_initiative",
  "delete_initiative",
  "update_milestone",
  "delete_milestone",
  "update_cycle",
  "update_cycle_settings",
])("returns permission or lifecycle failures from %s", async (name) => {
  const { json, call } = fixture();
  json.mockRejectedValue(new Error("Permission denied"));
  const input =
    name === "update_cycle_settings"
      ? { workspaceId: "w", cyclesEnabled: true }
      : { id: "i", ...(name.startsWith("update") ? { name: "New name" } : {}) };
  const result = await call(name, input);
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result.content)).toContain("Permission denied");
});
