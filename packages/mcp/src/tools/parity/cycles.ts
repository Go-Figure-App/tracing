import { z } from "zod";
import type { ToolClient, ToolRegistrar } from "../register.js";
import { parityTool } from "./register-tool.js";
import { hasChanges, id, page, queryString } from "./schemas.js";

// Shared by the stdio package and the authenticated HTTP MCP endpoint.
export function registerCycleTools(server: ToolRegistrar, client: ToolClient) {
  const register = parityTool(server, client);
  register(
    "list_cycles",
    "List current, upcoming or past workspace cycles, with progress from readable projects and the workspace's estimate scale. Cycles run automatically; there is no manual start operation.",
    z.object({
      workspaceId: id,
      phase: z.enum(["current", "upcoming", "past", "all"]).optional(),
      page: z.number().int().min(1).max(100_000).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
    }),
    ({ workspaceId, ...options }) => {
      const query = new URLSearchParams(
        Object.entries(options)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)]),
      );
      return client.json(
        `/api/parity/cycle/${encodeURIComponent(workspaceId)}?${query}`,
        { method: "GET" },
      );
    },
  );
  register(
    "get_cycle",
    "Get a cycle's dates, progress, closing summary and daily history, filtered to projects you can currently read. historyAvailable is false when imported aggregate history cannot be safely filtered.",
    z.object({ id }),
    ({ id }) =>
      client.json(`/api/parity/cycle/item/${encodeURIComponent(id)}`, {
        method: "GET",
      }),
  );
  register(
    "get_cycle_settings",
    "Read the workspace's automatic cycle cadence, timezone, upcoming cycle count, rollover and estimate scale.",
    z.strictObject({ workspaceId: id }),
    ({ workspaceId }) =>
      client.json(
        `/api/parity/cycle/settings/${encodeURIComponent(workspaceId)}`,
        { method: "GET" },
      ),
  );
  register(
    "update_cycle_settings",
    "Configure automatic cycle creation and rollover. Enabling cycles generates the current and upcoming cycles; upcomingCycles controls the lookahead. Cadence/timezone changes reschedule upcoming cycles. Disabling closes the active cycle, deletes upcoming cycles and clears their task assignments while preserving past history. Requires workspace settings permission. Cycles start/close automatically; individual manual creation/deletion is not supported.",
    z
      .strictObject({
        workspaceId: id,
        cyclesEnabled: z.boolean().optional(),
        estimateScale: z
          .enum(["none", "linear", "fibonacci", "t-shirt"])
          .optional(),
        cycleWeeks: z.number().int().min(1).max(8).optional(),
        cooldownWeeks: z.number().int().min(0).max(8).optional(),
        cycleStartDay: z
          .number()
          .int()
          .min(0)
          .max(6)
          .describe("Weekday: 0 Sunday through 6 Saturday")
          .optional(),
        upcomingCycles: z.number().int().min(1).max(15).optional(),
        autoRollover: z.boolean().optional(),
        timeZone: z
          .string()
          .min(1)
          .max(100)
          .refine((value) => {
            try {
              if (/^[+-]/.test(value)) return false;
              new Intl.DateTimeFormat("en", { timeZone: value });
              return true;
            } catch {
              return false;
            }
          }, "Use an IANA time zone")
          .optional(),
      })
      .refine(hasChanges, "Provide at least one cycle setting"),
    ({ workspaceId, ...body }) =>
      client.json(
        `/api/parity/cycle/settings/${encodeURIComponent(workspaceId)}`,
        { method: "PUT", body: JSON.stringify(body) },
      ),
  );
  register(
    "update_cycle",
    "Rename a cycle (null restores its default numbered name) or reschedule an upcoming cycle. Dates are YYYY-MM-DD in the workspace timezone; endDate is exclusive. Dates must be future, non-overlapping and at most eight weeks apart. Current/past cycle dates cannot change. Requires project update permission.",
    z
      .strictObject({
        id,
        name: z.string().trim().min(1).max(200).nullable().optional(),
        startDate: z.iso.date().optional(),
        endDate: z.iso.date().optional(),
      })
      .refine(hasChanges, "Provide at least one cycle field"),
    ({ id, ...body }) =>
      client.json(`/api/parity/cycle/item/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
  );
  register(
    "list_cycle_tasks",
    "List issues in a cycle across readable projects, with filters and pagination. Use update_task_cycle to assign, move or remove issues. Paginate while hasMore is true.",
    z.strictObject({
      id,
      ...page,
      projectId: id.optional(),
      assigneeId: id.optional(),
      category: z
        .enum(["backlog", "unstarted", "started", "completed", "canceled"])
        .optional(),
      status: z.string().min(1).max(128).optional(),
      priority: z
        .enum(["no-priority", "low", "medium", "high", "urgent"])
        .optional(),
      label: z.string().min(1).max(200).optional(),
      search: z.string().trim().max(200).optional(),
    }),
    ({ id, ...options }) =>
      client.json(
        `/api/parity/cycle/item/${encodeURIComponent(id)}/tasks?${queryString(options)}`,
        { method: "GET" },
      ),
  );
  register(
    "update_task_cycle",
    "Assign an accepted task to a cycle in the same workspace, or clear its cycle with explicit null. Requires task update permission; disabled cycles allow clearing only.",
    z.object({ taskId: id, cycleId: id.nullable() }),
    ({ taskId, cycleId }) =>
      client.json(`/api/parity/task/${encodeURIComponent(taskId)}/cycle`, {
        method: "PUT",
        body: JSON.stringify({ cycleId }),
      }),
  );
  register(
    "update_task_estimate",
    "Set an estimate on the workspace scale, or clear it with explicit null. Linear: 1–5; Fibonacci: 1, 2, 3, 5, 8; T-shirt XS/S/M/L/XL: 1/2/3/5/8. The API enforces the configured scale. Unestimated tasks count as one point in charts.",
    z.object({
      taskId: id,
      estimate: z.number().int().min(1).max(8).nullable(),
    }),
    ({ taskId, estimate }) =>
      client.json(`/api/parity/task/${encodeURIComponent(taskId)}/estimate`, {
        method: "PUT",
        body: JSON.stringify({ estimate }),
      }),
  );
}
