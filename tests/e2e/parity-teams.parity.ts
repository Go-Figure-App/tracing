import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("Teams manage membership and project ownership, retain issues on deletion, and refresh a second browser", async ({
  page,
  context,
  baseURL,
}) => {
  page.on("pageerror", (error) =>
    console.error("Teams browser error:", error.message),
  );
  if (!baseURL) throw new Error("A local baseURL is required");
  const headers = { Origin: new URL(baseURL).origin };
  const post = async (path: string, data: object) => {
    const response = await page.request.post(`/api/${path}`, { headers, data });
    await expect(response).toBeOK();
    return response.json();
  };
  const suffix = randomUUID();
  const user = await post("auth/sign-up/email", {
    name: "Teams browser owner",
    email: `teams-${suffix}@example.com`,
    password: `Teams-${suffix}-password`,
  });
  const workspace = await post("auth/organization/create", {
    name: "Teams browser",
    slug: `teams-${suffix}`,
  });
  await post("auth/organization/set-active", { organizationId: workspace.id });
  const projects = [];
  for (const [name, slug] of [
    ["App launch", "APP"],
    ["Website launch", "WEB"],
  ])
    projects.push(
      await post("project", {
        workspaceId: workspace.id,
        name,
        slug,
        icon: "Layout",
      }),
    );
  const columns = await (
    await page.request.get(`/api/column/${projects[0].id}`)
  ).json();
  const issue = await post(`task/${projects[0].id}`, {
    title: "Teams launch issue",
    description: "",
    status: columns[0].slug,
    priority: "medium",
  });
  const otherTeam = await post(`parity/teams/${workspace.id}`, {
    name: "Other QA",
    key: "OTH",
  });
  for (const [name, slug, teamId] of [
    ["No team control", "NTC", null],
    ["Other team control", "OTC", otherTeam.id],
  ]) {
    const project = await post("project", {
      workspaceId: workspace.id,
      name,
      slug,
      icon: "Layout",
    });
    if (teamId) {
      const assigned = await page.request.put(
        `/api/parity/project-plan/${project.id}`,
        { headers, data: { teamId } },
      );
      await expect(assigned).toBeOK();
    }
    const columns = await (
      await page.request.get(`/api/column/${project.id}`)
    ).json();
    await post(`task/${project.id}`, {
      title: name,
      description: "",
      status: columns[0].slug,
      priority: "medium",
    });
  }
  const base = `/dashboard/workspace/${workspace.id}`;
  await page.goto(`${base}/teams`);
  await page.getByRole("button", { name: "Create team", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Engineering QA");
  await page.getByLabel("Key", { exact: true }).fill("ENG");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Owns app delivery");
  await page
    .getByRole("combobox", { name: "Lead", exact: true })
    .selectOption(user.user.id);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "ENG · Engineering QA", exact: true }),
  ).toBeVisible();
  const teams = await (
    await page.request.get(`/api/parity/teams/${workspace.id}`)
  ).json();
  const team = teams.find((item: { key: string }) => item.key === "ENG");
  expect(team).toBeTruthy();
  const second = await context.newPage();
  const socketReady = second.waitForEvent("websocket", {
    predicate: (socket) => socket.url().includes("/api/ws/user"),
  });
  await second.goto(`${base}/teams`);
  const socket = await socketReady;
  expect(socket.url()).toContain("/api/ws/user");
  await page.goto(`${base}/teams/${team.id}/members`);
  await page
    .getByRole("combobox", { name: "Members", exact: true })
    .selectOption(user.user.id);
  await page.getByRole("button", { name: "Add member", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove member", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove member", exact: true })
    .click();
  await expect(page.getByText("No members yet", { exact: true })).toBeVisible();
  await page.route(
    `**/api/parity/project-plan/${projects[0].id}`,
    async (route) => {
      if (route.request().method() === "PUT")
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Synthetic assignment failure" }),
        });
      else await route.continue();
    },
    { times: 1 },
  );
  for (const project of projects) {
    await page.goto(`${base}/projects`);
    const row = page.getByRole("row").filter({
      has: page.getByRole("link", { name: project.name, exact: true }),
    });
    await row
      .getByRole("combobox", { name: "Team", exact: true })
      .selectOption(team.id);
    if (project.id === projects[0].id) {
      await expect(row.getByRole("alert")).toBeVisible();
      await row.getByRole("button", { name: "Try again", exact: true }).click();
    }
    await expect(
      row.getByRole("combobox", { name: "Team", exact: true }),
    ).toHaveValue(team.id);
  }
  await page.goto(`${base}/teams/${team.id}/projects`);
  await expect(
    page.getByRole("link", { name: "App launch", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Website launch", exact: true }),
  ).toBeVisible();
  await page.goto(`${base}/issues`);
  await page.getByRole("button", { name: "Add filter", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Field", exact: true })
    .selectOption("team");
  await page.getByRole("button", { name: "Filter value", exact: true }).click();
  await page.getByRole("checkbox", { name: "Not set", exact: true }).uncheck();
  await page
    .getByRole("checkbox", { name: "Engineering QA", exact: true })
    .check();
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("Teams launch issue", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No team control", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByText("Other team control", { exact: true }),
  ).not.toBeVisible();
  await page.goto(`${base}/projects`);
  const row = page.getByRole("row").filter({
    has: page.getByRole("link", { name: "Website launch", exact: true }),
  });
  await row
    .getByRole("combobox", { name: "Team", exact: true })
    .selectOption("");
  await page.goto(`${base}/teams/${team.id}/settings`);
  await page.getByRole("button", { name: "Archive team", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restore team", exact: true }),
  ).toBeVisible();
  await expect(
    second.getByText("ENG · Engineering QA · Archived", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore team", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Archive team", exact: true }),
  ).toBeVisible();
  for (const width of [1280, 1440, 430])
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`${base}/teams/${team.id}/projects`);
      const toggle = page.getByRole("switch", {
        name: "Toggle theme",
        exact: true,
      });
      const desired = String(colorScheme === "light");
      if ((await toggle.getAttribute("aria-checked")) !== desired)
        await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", desired);
      await page.setViewportSize({ width, height: 960 });
      await expect(
        page.getByRole("link", { name: "App launch", exact: true }),
      ).toBeVisible();
      await page.evaluate(async () => {
        await Promise.allSettled(
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.effect?.getComputedTiming().iterations !== Infinity,
            )
            .map((animation) => animation.finished),
        );
      });
      await page.screenshot({
        path: `../../.cache/e2e/teams-${width}-${colorScheme}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  const filtered = await context.newPage();
  await filtered.goto(`${base}/projects`);
  await filtered
    .getByRole("combobox", { name: "Team", exact: true })
    .first()
    .selectOption(team.id);
  await page.goto(`${base}/teams/${team.id}/settings`);
  await page.getByRole("button", { name: "Delete team", exact: true }).click();
  await expect(
    page.getByText(/All projects and issues will be kept/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete team", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/workspace/${workspace.id}/teams/?$`),
  );
  await expect(
    second.getByText("ENG · Engineering QA", { exact: true }),
  ).toHaveCount(0);
  // A 404 conservatively clears every parity cache; the recovery action must
  // remain available even when that also marks the team-list query as failed.
  await filtered
    .getByRole("button", { name: "All teams", exact: true })
    .click();
  await expect(
    filtered.getByRole("combobox", { name: "Team", exact: true }).first(),
  ).toHaveValue("");
  await expect(
    filtered.getByRole("link", { name: "Website launch", exact: true }),
  ).toBeVisible();
  await filtered.close();
  const retained = await page.request.get(`/api/task/${issue.id}`);
  await expect(retained).toBeOK();
  for (const project of projects) {
    const plan = await (
      await page.request.get(`/api/parity/project-plan/${project.id}`)
    ).json();
    expect(plan.teamId).toBeNull();
  }
  await second.close();
});
