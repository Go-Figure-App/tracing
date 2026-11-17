import { expect, it } from "vite-plus/test";
import { canChangeTeamMembership, readableTeamProjectCounts } from "./privacy";
it("counts only projects authorized in the current workspace", () => {
  expect([
    ...readableTeamProjectCounts(
      [
        { id: "visible", teamId: "team" },
        { id: "hidden", teamId: "team" },
        { id: "moved", teamId: "team" },
        { id: "unassigned", teamId: null },
      ],
      new Map([
        ["visible", "workspace"],
        ["moved", "other"],
        ["unassigned", "workspace"],
      ]),
      "workspace",
    ),
  ]).toEqual([["team", 1]]);
});
it("permits team managers and the designated lead only", () => {
  expect(canChangeTeamMembership("member", null, false)).toBe(false);
  expect(canChangeTeamMembership("member", "other", false)).toBe(false);
  expect(canChangeTeamMembership("lead", "lead", false)).toBe(true);
  expect(canChangeTeamMembership("admin", null, true)).toBe(true);
});
