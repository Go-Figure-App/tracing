import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vite-plus/test";
import { invalidateParity } from "./workspace-events";

it("uses workspace events as planning refetch hints", () => {
  const client = new QueryClient();
  client.setQueryData(["parity", "cycles", "workspace"], []);
  invalidateParity(client, { type: "NOTIFICATION_CREATED" });
  expect(
    client.getQueryState(["parity", "cycles", "workspace"])?.isInvalidated,
  ).toBe(false);
  invalidateParity(client, { type: "CYCLE_UPDATED" });
  expect(
    client.getQueryState(["parity", "cycles", "workspace"])?.isInvalidated,
  ).toBe(true);
  invalidateParity(client, { type: "WORKSPACE_ACCESS_REVOKED" });
  expect(
    client.getQueryData(["parity", "cycles", "workspace"]),
  ).toBeUndefined();
  client.clear();
});

it("refetches teams and derived collections for every team hint", () => {
  for (const type of [
    "TEAM_CREATED",
    "TEAM_UPDATED",
    "TEAM_DELETED",
    "TEAM_MEMBERSHIP_UPDATED",
    "PROJECT_TEAM_UPDATED",
  ]) {
    const client = new QueryClient();
    client.setQueryData(["parity", "teams", "workspace"], []);
    invalidateParity(client, { type });
    expect(
      client.getQueryState(["parity", "teams", "workspace"])?.isInvalidated,
    ).toBe(true);
    client.clear();
  }
});
