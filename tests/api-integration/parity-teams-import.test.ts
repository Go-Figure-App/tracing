import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { importProjectTeam } from "../../apps/api/src/parity/teams/import-team";
import type { ProjectPlanning } from "../../apps/api/src/parity/import/types";
import { createWorkspaceMember } from "./helpers/fixtures";
import { resetTestDatabase } from "./helpers/database";
beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("PARITY_FEATURES", "teams,import");
});
afterEach(() => vi.unstubAllEnvs());
function data(teamIds = ["source-team"]): ProjectPlanning {
  return {
    sourceId: "p",
    project: null,
    teamIds,
    issues: [],
    milestones: [],
    updates: [],
    workspace: {
      teams: [
        {
          id: "source-team",
          name: "App",
          key: "APP",
          description: "Delivery",
          timezone: "UTC",
          issueEstimationType: "linear",
        },
      ],
      states: [],
      cycles: [],
      initiatives: [],
      initiativeProjects: [],
      initiativeUpdates: [],
      relations: [],
      warnings: [],
    },
  };
}
it("reuses imported teams across projects and runs without importing members", async () => {
  const { workspace } = await createWorkspaceMember();
  const warnings: string[] = [];
  const first = await db.transaction((tx) =>
    importProjectTeam(tx, workspace.id, data(), warnings),
  );
  const second = await db.transaction((tx) =>
    importProjectTeam(tx, workspace.id, data(), warnings),
  );
  expect(first).toBe(second);
  expect(await db.select().from(schema.teamTable)).toHaveLength(1);
  expect(await db.select().from(schema.teamMemberTable)).toEqual([]);
  expect(warnings).toEqual([]);
});
it("retains No team with an explicit warning for ambiguous source ownership", async () => {
  const { workspace } = await createWorkspaceMember();
  const warnings: string[] = [];
  expect(
    await db.transaction((tx) =>
      importProjectTeam(
        tx,
        workspace.id,
        data(["source-team", "another-team"]),
        warnings,
      ),
    ),
  ).toBeNull();
  expect(warnings.join(" ")).toContain("multiple teams");
  expect(await db.select().from(schema.teamTable)).toEqual([]);
});
it("does nothing when teams is disabled", async () => {
  const { workspace } = await createWorkspaceMember();
  vi.stubEnv("PARITY_FEATURES", "import");
  expect(
    await db.transaction((tx) =>
      importProjectTeam(tx, workspace.id, data(), []),
    ),
  ).toBeUndefined();
  expect(await db.select().from(schema.teamTable)).toEqual([]);
});
