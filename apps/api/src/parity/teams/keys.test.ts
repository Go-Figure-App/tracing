import { describe, expect, it } from "vite-plus/test";
import { allocateTeamKey, teamMembershipKey } from "./keys";
import { teamBody, teamPatch } from "./schema";
describe("team identifiers", () => {
  it("validates ASCII uppercase keys and nullable clearing", () => {
    for (const key of ["A", "APP1", "app", "ABCDEF", "ÄP"])
      expect(teamBody.safeParse({ name: "App", key }).success).toBe(false);
    expect(teamBody.parse({ name: " App ", key: "APP" })).toMatchObject({
      name: "App",
      description: "",
    });
    expect(teamPatch.parse({ leadId: null, color: null, icon: null })).toEqual({
      leadId: null,
      color: null,
      icon: null,
    });
  });
  it("allocates deterministic short keys, including collisions and non-Latin names", () => {
    const taken = new Set<string>();
    for (const name of ["App", "App", "App", "équipe", "团队", "A"]) {
      const key = allocateTeamKey(name, taken);
      expect(key).toMatch(/^[A-Z]{2,5}$/);
      expect(taken.has(key)).toBe(false);
      taken.add(key);
    }
    expect(allocateTeamKey("App", new Set())).toBe("APP");
  });
  it("uses unambiguous stable provider membership keys", () => {
    expect(teamMembershipKey("a", "b")).toBe(teamMembershipKey("a", "b"));
    expect(teamMembershipKey("ab", "c")).not.toBe(teamMembershipKey("a", "bc"));
    expect(teamMembershipKey("a", "b")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
