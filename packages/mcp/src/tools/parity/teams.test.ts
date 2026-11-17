import { expect, it, vi } from "vite-plus/test";
import { registerTools } from "../register.js";
function setup() {
  const tools = new Map<string, (input: unknown) => Promise<unknown>>();
  const json = vi.fn().mockResolvedValue({});
  registerTools(
    {
      registerTool: (name, _config, handler) => {
        tools.set(name, handler);
      },
    },
    { client: { json } },
  );
  return { tools, json };
}
it("exposes Teams on the shared HTTP/stdio catalog and preserves null clearing", async () => {
  const { tools, json } = setup();
  for (const name of [
    "list_teams",
    "get_team",
    "create_team",
    "update_team",
    "archive_team",
    "delete_team",
    "list_team_members",
    "add_team_member",
    "remove_team_member",
    "set_project_team",
  ])
    expect(tools.has(name)).toBe(true);
  await tools.get("set_project_team")!({ projectId: "p/a", teamId: null });
  expect(json).toHaveBeenLastCalledWith("/api/parity/project-plan/p%2Fa", {
    method: "PUT",
    body: '{"teamId":null}',
  });
  await tools.get("remove_team_member")!({
    workspaceId: "w/a",
    teamId: "t/a",
    userId: "u/a",
  });
  expect(json).toHaveBeenLastCalledWith(
    "/api/parity/teams/w%2Fa/t%2Fa/members/u%2Fa",
    { method: "DELETE" },
  );
});
it("encodes team issue and project filters and rejects invalid keys", async () => {
  const { tools, json } = setup();
  await tools.get("list_workspace_tasks")!({
    workspaceId: "w",
    team: "t/a",
    filters: [{ field: "team", operator: "is-not", values: [null] }],
  });
  expect(json.mock.calls[0]?.[0]).toContain("team=t%2Fa");
  await tools.get("list_projects")!({ workspaceId: "w", team: "none" });
  expect(json.mock.calls[1]?.[0]).toBe(
    "/api/parity/project-plan/workspace/w?team=none",
  );
  json.mockClear();
  expect(
    await tools.get("create_team")!({
      workspaceId: "w",
      name: "App",
      key: "app",
    }),
  ).toMatchObject({ isError: true });
  expect(json).not.toHaveBeenCalled();
});
