# Go Figure planning fork

Phase 0 implements the foundation from the technical design attached to [GOF-272](https://linear.app/gofigure/issue/GOF-272). Later phases require a separate branch, pull request and review. The fork remote is `Go-Figure-App/tracing`; never open parity pull requests against `usekaneo/kaneo`.

## Teams — design spike, November 16, 2026

**Status: Phase A design and PR split approved; Phase B complete and ready for PR review.** This section records the approved Teams v1 model and the screenshot-led native
navigation follow-up (merged in #24). Teams core remains behind its feature flag. Phase C requires its own approval before implementation. No deployment,
production-data inspection, Railway change or distribution upload is included.

### Identity and membership

Recommend **Option 1: reuse Better Auth's `team` and `team_member`**, with a
parity `team_ext`. The installed provider is pinned to `better-auth@1.7.14`.
Upstream migration `0067_better_auth_team_membership.sql` already supplies
`member_count` and nullable unique `membership_key`; existing legacy memberships
may have null keys. The existing schema-upgrade test covers such rows. No
production rows were read or counted. There is no evidence here about which
teams a particular deployment currently contains.

The spike checks the real auth routes against a new disposable PostgreSQL
database named `tracing_teams_spike_test`, with the feature disabled. It does
not mock sessions or replace provider authorization. Findings:

- Workspace creation creates a same-name default team, adds its creator, sets
  `member_count=1`, and selects that team for the creating session.
- The default team counts toward `maximumTeams: 10`. Sequential creation of
  nine more teams succeeds; creation of an eleventh is rejected. Provider code
  implements this as list-then-create, so it is not a concurrency guarantee.
- An active team cannot be deleted through the provider endpoint. After
  clearing the active team, `allowRemovingAllTeams: false` still rejects
  deletion of the last team. These restrictions are endpoint behavior, not
  database constraints.
- The existing permission vocabulary already includes `team:create`,
  `team:update` and `team:delete`. Default admin/owner roles grant them;
  viewer/member roles do not. No new permission statement is necessary.
- Team lists require workspace membership and Tracing's `workspace:read`.
  Provider member-listing additionally requires the caller to belong to that
  team, even for a workspace admin. V1 needs an owned member-list endpoint
  because teams organize work rather than restricting visibility.
- Provider membership writes use `member:update` for adding and
  `member:delete` for removing; the existing native API-key boundary also
  requires `team:update`. They do not implement Tracing's proposed lead rule.
  Adding someone who is not a workspace member is rejected.

Exposed team paths under `/api/auth/organization`:

| Method and path | Existing provider rule, in addition to Tracing's native boundary |
| --- | --- |
| `POST /create-team` | Workspace member with `team:create`; ten-team limit. |
| `POST /update-team` | Workspace member with `team:update`. |
| `POST /remove-team` | Workspace member with `team:delete`; active/last-team protections. |
| `GET /list-teams` | Workspace member. |
| `GET /list-user-teams` | Own teams; another user's teams require `member:update`. |
| `GET /list-team-members` | Workspace and team membership. |
| `POST /add-team-member` | `member:update`; target must be a workspace member. |
| `POST /remove-team-member` | `member:delete`; target must be a workspace member. |
| `POST /set-active-team` | Caller belongs to the selected team; null clears. |

The source and [provider documentation](https://www.better-auth.com/docs/plugins/organization)
expose organization/team lifecycle hooks. Tracing already has a global
`createAuthMiddleware` before hook in `auth.ts` that rejects and short-circuits
organization routes. A small mount there can call an owned Teams guard: when
Teams is enabled, reject raw team mutation endpoints and direct clients to
`/api/parity/teams`. Preserve their exact existing behavior with Teams disabled.
Keep read/session-selection endpoints subject to existing access checks; these
do not assign projects or change team metadata.

A separate test provider instance using the application's existing options and
an additional before hook rejects `create-team` with 403 and leaves the team
table unchanged. This proves a config-only guard is feasible; it is not the
complete Phase B bypass defense.

Guard indirect membership paths too: invitation `teamId`, acceptance of old
team-bearing invitations, and native organization member operations must not
silently bypass membership events or the archived-team rule. Existing workspace
member removal must still clean team memberships and reconcile leads/counts.
Use provider lifecycle hooks where the route itself must remain usable. Guard
both cookie and API-key callers, and test omitted organization IDs, explicit
IDs, other workspaces and native bearer sessions. Do not modify provider code
or bypass the existing native auth security checks.

Owned controllers will write identity, membership, count and side rows in one
database transaction. Use the provider's observed canonical membership-key
format and handle legacy null-key memberships idempotently. Serialize creates,
membership changes and deletes with workspace/team row locks; do not rely on
the provider's list-then-create limit. Reuse ten total teams (including archived
teams) for v1. Deleting the final team is allowed through the owned API and
clears affected session selections/invitation references. It preserves every
project and task. Default-team provisioning remains unchanged with the flag
off; feature-enabled provisioning must create its extension using the same
key allocator as ordinary team creation.

### Proposed v1 model and permissions

Teams **organize only**. They never grant project access. Every team project
count/list, issue query, roadmap and MCP result intersects current readable
projects from `project-access/find-accessible-projects.ts`. Membership counts
describe workspace members of the team, independent of project visibility.
Events carry only type/workspace hints; clients refetch authorized responses.
Redis stays optional, and access changes discard protected cached results.

A project has zero or one team through nullable `project_ext.team_id` with
`ON DELETE SET NULL` and an index. Missing extension rows mean "No team".
A task derives its team from its project. Many-to-many project ownership would
make a task's team ambiguous and is unnecessary for v1. Assigning a team must
check both workspace identity and existing project-update permission. Moving a
project between workspaces must clear its old team; reads must immediately
ignore stale cross-workspace assignments before subscribers reconcile them.

`team_ext` contains the requested key, description, icon, color, lead,
archive timestamp and position; `team_id` is its cascading primary foreign key.
**Proposed clarification requiring approval:** also store `workspace_id` on
`team_ext`, with an inline workspace foreign key and unique `(workspace_id,
key)` index. PostgreSQL cannot enforce per-workspace key uniqueness by joining
the parent team from an index. Validate that the extension and identity belong
to the same workspace inside the locked write transaction; do not add a
constraint or column to the upstream team table.

Keys are 2–5 ASCII uppercase letters (`^[A-Z]{2,5}$`), unique even for archived
teams; API filtering uses stable team IDs, while keys appear in the UI. Keep
per-project task numbering and identifiers. Before enabling Teams, provision
extensions for existing default/legacy teams with deterministic, collision-safe
keys under a workspace lock; preserve their identity and membership. Provisioning
must be repeatable and must not assign existing projects. Keep feature-disabled
startup free of this data provisioning. Changing task identifiers is out of scope.

Propose that `teams` imply `projects` and `views` because the team pages reuse
their gated project and issue APIs. Feature discovery and both clients must
agree on these dependencies. Merely leaving Teams disabled must not change
existing planning or provider behavior.

Use `requireWorkspacePermission` and the existing `team:*` vocabulary for
team CRUD; this respects editable workspace roles and API-key scope. The default
roles give CRUD to admin/owner only. Membership writes require workspace-read
and either team-management authority or the current lead; even a lead's API
key must have the explicit mutation scope. Leads must remain workspace members;
clear a lead removed from the workspace. Archived teams stay readable, can be
restored/deleted, retain existing project assignments, and reject new project
assignments/membership additions until restored. Assignment clearing and member
removal remain available. Every reverse action is tested.

Migration `0005_teams.sql` belongs in `drizzle-parity`, not upstream `drizzle`.
The independent startup ledger/advisory lock stays unchanged. The migration is
additive; project-team references target the existing team table with inline
foreign keys, and no upstream schema file changes.

### PR sequence and screenshot-led mobile scope

1. **Teams design spike (this change):** this design and executable provider
   characterization. Obtain maintainer design approval before Phase B.
2. **Teams core (Phase B, one PR):** gated schema/API, privacy-aware filters,
   realtime invalidation, web navigation/settings/properties, native Teams
   under More and the project picker, ten shared HTTP/stdio MCP tools, Linear
   team import, translated catalogs, docs and behavioral verification. Shared
   modules receive small mounts; domain behavior stays in owned Teams modules.
3. **Native navigation and visual parity (separate PR):** implement the real
   iOS system glass bottom bar using the already installed SDK 58
   `expo-router/native-tabs`; no added native package. Move the state-selected
   home tabs into routes under a tabs layout while retaining root-stack detail
   navigation, deep links, workspace selection, unread badges and authenticated
   realtime handling. Keep Android native navigation and older-iOS system
   fallbacks. Verify installed native-module compatibility in a rebuilt local
   simulator app before claiming glass support.
   Use the eight supplied screenshots for large headers, compact icon rows,
   pill controls, selected-tab treatment and the destination menu. Keep existing
   Tracing destinations reachable. Native system tabs may not reproduce Linear's
   custom expanding fourth slot exactly; verify the supported API before adding
   that interaction. The separate round action should open a real existing
   action such as issue creation; do not invent an Agent feature. Review light,
   dark, safe-area/scroll overlap, keyboard, accessibility, back navigation and
   workspace switching. Keep private screenshots outside the repository/PR.
4. **Team cycles/triage (Phase C):** design below is pending, with a separate
   approval before any cycle-model implementation PR.

For every implementation PR: run required local checks, push to
`Go-Figure-App/tracing`, inspect the review on the latest head, fix valid findings,
resolve discussions, and require approval plus every required check green on
that same head before merging. Do not substitute green CI for review approval.
Do not enable production flags, deploy, or submit a distribution build.

Native API research: the [Expo native tabs guide](https://docs.expo.dev/router/advanced/native-tabs/)
documents SDK 58's stable import and system glass behavior. The installed Router
package exports that path. Its guide is supporting evidence; simulator behavior
has not been checked during this design-only phase.

### Expected shared-file register for implementation (proposed)

| Shared file(s) | Reason and limit |
| --- | --- |
| `apps/api/src/auth.ts` | Mount owned raw-team guard and lifecycle integration; retain current auth checks. |
| `apps/api/src/database/schema-parity.ts` | Owned team extension and nullable project-team link. |
| `apps/api/src/database/index.ts` | Export/register the new side table. |
| `apps/api/src/index.ts` | Initialize owned provisioning/event integration if needed. |
| `packages/mcp/src/tools/register.ts` | Mount the owned Teams registrar for HTTP and stdio. |
| `apps/web/src/components/app-sidebar.tsx` | Mount the feature-gated Your teams section. |
| `apps/web/src/components/settings/nav/use-settings-nav.ts` | Mount Teams settings navigation. |
| `apps/web/src/routeTree.gen.ts` | Generate new team/settings routes. |
| `apps/mobile/src/app/(app)/index.tsx` | Integrate Teams capability, then extract shared workspace/realtime state for native tabs. |
| `apps/mobile/src/app/(app)/_layout.tsx` | Mount nested native tabs while retaining the detail stack. |
| `apps/mobile/src/features/home/bottom-nav.tsx` | Replace the current custom bar with the native layout. |
| `apps/mobile/src/features/home/home-tab.tsx` | Preserve Home actions and workspace switching after route extraction if necessary. |
| `apps/mobile/src/components/screen.tsx` | Adjust inset ownership only if native-tab verification requires it. |
| `apps/docs/openapi.json` | Generate the accurate gated API contract. |
| `tests/e2e/compose.parity.yml`, `tests/e2e/smoke.spec.ts` | Enable teams in synthetic parity tests and check feature-off navigation. |
| `i18n/en-US.json`, 20 catalogs, `i18n/schema.json` | New web/native strings, synchronized and translated; catalog edits counted separately. |

Owned planning, views, roadmap, import, foundation and native More modules also
need team-aware contracts/filters/cache handling; record their actual paths and
reasons in Phase B. New routes are thin mounts. No large shared-file rewrite,
upstream schema/controller change, dependency or lockfile change is proposed.
Revise this register to actual edits before each PR review.

### Phase C proposal — not approved for implementation

Add nullable `cycle.team_id` to the parity-owned cycle table and a parity team
settings table. Existing rows retain null and workspace settings; never infer
past ownership from today's project assignments. Replace the existing
`(workspace_id, number)` index with two explicit uniqueness domains: workspace
cycles `(workspace_id, number) WHERE team_id IS NULL` and team cycles
`(team_id, number) WHERE team_id IS NOT NULL`. Preserve cycle IDs, historical
dates, task links, daily points and closed summaries. This index change and
the following behavior require approval beyond Phase B's additive-only model.

Tick/rollover locks must identify workspace and optional team; disabled team
cadences must not prevent workspace ticks. Use each scope's timezone/settings,
and validate destination cycles against the task's current project team.
Open-cycle assignment/move policy must be decided before implementation:
recommend clearing incompatible open-cycle assignments on project-team changes,
with an explicit event, while retaining immutable historical links. Closed
cycles may therefore reference a project that later changes team. Do not
recompute closed summaries or redistribute historical `cycle_day.project_totals`.
Continue permission filtering by stored project totals; aggregate-only imported
history stays unavailable to restricted readers. Add DST, parallel ticks,
overlap, scope-change and historical privacy regression coverage.

For triage, first add a team-filtered view over the existing pending queue using
the team's currently readable projects. Acceptance/decline/snooze remain the
existing operations. Do not add a second inbox store or silently alter project
triage settings. Independent team inbox ownership/policies would be another
design decision. Team deletion with historical cycles also needs an approved
retention policy: recommend prohibiting hard deletion until historical scope
can be preserved rather than collapsing duplicate team cycle numbers into the
workspace domain. Phase B has no team-owned cycles, so its delete operation
continues to preserve projects/tasks as specified.

### Future work (Phase D only)

Private teams that constrain project visibility, team workflow templates and
team keys in task identifiers remain future work. They are not part of v1 or
the mobile visual pass.

### Teams verification

| Check | Phase A result |
| --- | --- |
| Provider behavior on disposable PostgreSQL | Five spike tests passed, including the config-only raw-write guard. |
| Existing team schema/membership migration regression | Both existing tests passed; no upstream migration edited. |
| Root lint/format and typecheck | Passed; all 22 typecheck/build tasks succeeded. |
| Locale synchronization | All 21 catalogs synchronized. No catalog changed. |
| Root unit suites | Passed: all 26 Vite+ tasks succeeded, including 2,066 web tests and 158 native tests. The initial sandbox run denied local SMTP test sockets; the unchanged suites passed with socket permission. |
| OpenAPI consistency | Passed unchanged after granting tsx local IPC permission. |
| Runtime Teams, filters, import and MCP | Not implemented; Phase B awaits design approval. |
| Native glass, browser UI and simulator | Research only; implementation/visual verification pending. |
| Production/data/distribution | Not accessed or changed. |

## Expo organization — November 16, 2026

The maintainer authorized moving Tracing builds to the `tracing` Expo
organization and generating builds there. The supplied project identity stays
`4dfa905a-804d-4710-a412-559fc4428e21`, slug `tracing`, with native application
ID `io.gofigureapp.tracing`. `apps/mobile/app.config.js` changes only its default
Expo owner; `apps/mobile/README.md` records the organization and project link.
Existing fork overrides remain available. Check the remote owner/project before
dispatching builds, and omit the local-server override from distribution builds.
Store/TestFlight submission remains a separate step from build generation.

## Boundaries

- API logic: `apps/api/src/parity/<feature>/`.
- Web components: `apps/web/src/components/parity/<feature>/`; typed fetchers under `fetchers/parity/`.
- Mobile logic: `apps/mobile/src/features/parity/<feature>/`.
- Tables: `apps/api/src/database/schema-parity.ts`. Do not edit upstream `schema.ts` or `apps/api/drizzle/`.
- Migrations: `apps/api/drizzle-parity/`, tracked in `drizzle.__drizzle_parity_migrations`. Startup runs these after upstream migrations, even when features are disabled. Initial foreign keys are inline in new table declarations; no upstream table is altered.
- React to mutations through the existing event bus. Do not modify task controllers.
- Reuse existing permissions. Project data and event recipients must respect project access restrictions. Socket messages carry only a type and workspace ID; clients refetch authorized endpoints and discard parity caches on access changes.
- Target fewer than 20 shared integration edits. Record generated locale synchronization separately and count it in the total; upstream's required locale check needs every catalog to contain the source keys. Ask before a large change to a shared file or a design/model change.
- No Railway changes, production migration/import, paid services, TestFlight or App Store submission without explicit permission. The maintainer authorized review fixes, merging approved green PRs, and continuing to the next phase; deployment remains separate.

## Native glass navigation — November 2026

The maintainer supplied eight Linear iOS screenshots and requested native glass
navigation. The installed Expo SDK 58 Router exposes `expo-router/native-tabs`;
the new home layout uses the native system tab bar with icon-only iOS labels,
accessible destination names, the current-tab capsule and an unread badge.
The system supplies glass on supported iOS versions and its normal tab bar on
older systems. No native package or generated native project is changed.

Home, My tasks, Inbox and More remain the four destinations. More retains
Activity when planning is disabled. Its nested stack keeps the bar visible on
Projects, Initiatives, Cycles, Roadmap, Views, Insights and Activity. Existing
collection URLs remain unchanged. Root project/issue/detail, creation, search
and account routes retain their outer stack. Shared workspace/realtime handling
mounts once; changing workspace remounts tab state and counts. Other tabs load
their content on first visit and retain it for later visits. No-workspace,
loading and failure handling remain available, including direct Activity links.

The reference's custom expanding destination slot and separate Agent action
are not implemented. Tracing retains its current destinations and workflows.
The screenshots stay outside Git and PR attachments. The real native system
owns selection, glass, insets and platform fallbacks rather than a simulated
blurred React Native view. ThemeProvider follows the device appearance to avoid
white transitions in dark mode.

Shared-file register: `apps/mobile/src/app/(app)/_layout.tsx` mounts the nested
tabs; its old `index.tsx` is split into thin tab routes and owned
`features/parity/navigation` components. The six existing collection routes
(`projects`, `initiatives`, `cycles`, `roadmap`, `views`, `insights`) move unchanged
inside the nested collections stack, preserving public paths. The unused
`features/home/bottom-nav.tsx` is removed. New Activity and layout files are thin
mounts. The shared catalogs, API, permissions, data model, native identity and
dependencies are unchanged by this slice; Expo ownership is the separately
approved PR #23.

`components/sheet.tsx` keeps the native Modal host mounted through dismissal
and exposes its existing native dismissal callback. `features/home/workspace-sheet.tsx`
waits for that callback before iOS workspace actions navigate. The simulator
found that pushing a parent-stack route while a tab's modal was still closing
could leave the modal over the destination. Other platforms retain their
existing navigation sequence. The collections layout explicitly owns its bottom
safe area so a horizontal filter scroller cannot receive the vertical list's
tab-bar inset.

Verification: root lint/format, all 22 typecheck/build tasks, all 158 native unit
tests, all 2,066 web tests, locale synchronization and unchanged OpenAPI passed.
The workspace unit run hit the two previously observed five-second API import
timeouts under concurrent local load; their unchanged files passed all 11 cases
when run alone. The final iOS production JavaScript export passed with the local
server override unset. Other workspace unit packages passed in the root run.

The Tracing UI QA iPhone simulator (iOS 27) exercised all four tabs, unread
badges, collection navigation with the bar retained, scrolling to the final
project row, project detail/back, new-workspace creation with the keyboard,
empty-state isolation, restoring the original workspace, and light/dark search
and detail navigation. Maestro drove the disposable local instance after the
computer-use surface could not access Simulator. Assertions were corrected to
match combined accessibility labels and the localized ellipsis; the navigation
and modal fixes were then verified through the corrected flows. No physical
device, older iOS runtime or distribution binary was exercised in this slice.

Review correction: render the unread badge only for positive counts. The locked
Router version processes nonempty badge children before its `hidden` property,
so a hidden badge containing `"0"` would still appear. Positive counts and the
`99+` cap are retained.

The Teams core changes are parked until this PR is approved, green and merged,
as requested by the maintainer. Distribution builds are iOS only; production
API enablement and store submission remain separate.

## Phase 0 spike findings

Validated against upstream `cb70ff64` (v2.49.0), with the existing Go Figure mobile identity commit `104f1f6f` preserved.

1. **Separate migrations work.** A disposable PostgreSQL database applied 74 upstream migrations followed by an independent migration through `prepareDatabaseStartup`. Concurrent and repeated startup do not reapply either set. A dedicated PostgreSQL session holds an advisory lock before reading the parity ledger and releases it on success or failure. The integration test checks that upstream columns and its migration ledger remain identical and that the previous migration sequence still runs.
2. **Task properties support small insertions.** `components/task/properties/properties-rail.tsx` already composes `PropertyRow`; `property-chips.tsx` handles compact layouts. Later phases can mount parity components in those two places, just like custom fields. No task-panel changes are needed in Phase 0.
3. **The importer cannot transparently carry planning metadata.** `packages/importers/src/linear/source.ts` lists Linear teams, not Linear projects, and `ImportedProject`/`ImportedTask` have no planning metadata. `writeProjectContent` constructs its source-to-destination task map internally and returns counts, not that map. Phase 7 needs a parity source/writer path or an explicit hook exposing that mapping. No shared importer types were changed in this phase.

Other design/code differences: startup must seed categories after upstream `migrateColumns`; existing tasks have a real `column_id` as well as a status slug; activity for a project move uses type `moved`. Tracing's final flag still drives upstream automations, while parity categories drive planning. The deployment has one bundled Tracing service plus Postgres, rather than the three services assumed by the design. Railway was inspected read-only.

## Configuration and behavior

`PARITY_FEATURES` is a comma-separated allowlist: `foundation,triage,projects,initiatives,roadmap,cycles,insights,views,import`. It defaults to empty. Any recognized feature implies `foundation`; unknown names have no effect. Foundation, triage, projects, initiatives, roadmap, cycles, insights and views are implemented; import remains gated until its phase lands. Initiatives implicitly enables projects; roadmap enables initiatives and projects. Restart the API after changing configuration.

With `PARITY_FEATURES=foundation`, project Workflow settings show state categories, and lifecycle subscribers are enabled. New columns without side rows use deterministic defaults; startup seeds existing columns without overriding manual choices. A canceled/declined/duplicate slug maps to canceled, final columns to completed, backlog/triage to backlog, in-progress/in-review/started/doing to started, and other columns to unstarted. Categories can be reversed in settings without modifying upstream final flags.

Endpoints (all require authentication):

- `GET /api/parity/features`: enabled instance capabilities; no workspace data.
- `GET /api/parity/columns/{projectId}`: readable project's workflow categories.
- `PUT /api/parity/columns/{projectId}/{columnId}`: set a category with existing `project:update` permission; rejects columns from another project.

Lifecycle semantics: retain the first observed start, retain a terminal timestamp while the task stays in that category, clear terminal timestamps on reopening, and record a new timestamp on recompletion. Live subscribers capture the triggering transition before awaiting database work, replay recorded status/move history, and lock current task rows. The captured source status distinguishes entry into a terminal category from a move between two states in the same category. This preserves rapid transitions even when handlers run late or out of order, while the current category clears stale terminal dates. Reconciliation chooses the earliest known start and the latest applicable terminal transition. Category changes reconcile history for that project. The existing event bus is asynchronous and not a durable queue; the backfill is also a reconciliation tool.

The four side tables contain the design's fields. Missing task/project/workspace rows mean defaults. Cycle and milestone IDs are nullable reserved text fields; their target tables and assignment validation arrive in their own phases. No Phase 0 endpoint writes them.

### Historical backfill

After starting the API against a **local database or approved copy**, run from `apps/api`:

```sh
DATABASE_URL=postgresql://kaneo@127.0.0.1:55432/kaneo_parity_test pnpm exec tsx src/parity/foundation/backfill.ts
```

This script pages tasks, reads `status_changed`/`moved` activity in chronological order, preserves unrelated extension fields and live observations, and can be rerun. Tasks without usable history retain null historical timestamps. Move records reconstruct the project active at each historical transition, so identical slugs in different projects use their own categories. Activity does not preserve historical category configuration: deleted/renamed columns, missing move records, or later category redefinitions cannot be reconstructed exactly. No dates are synthesized for missing history. The script does not migrate the database.

Generate future parity migrations from `apps/api` with `pnpm exec drizzle-kit generate --config drizzle-parity.config.ts`; inspect SQL before use. Keep SQL additive and ensure both migration folders are included in both API Docker images.

### Mobile

The current fork config uses name `Tracing` and bundle/package ID `io.gofigureapp.tracing`. The build fixes its server to `https://tracing.gofigureapp.io`, hides server selection and removes the purchase screen, purchase module and `react-native-purchases`. Stored credentials for a different server are cleared on hydration; they cannot be saved by this build.

For local simulator testing only, `GOFIGURE_LOCAL_SERVER_URL=http://localhost:18173` overrides the fixed address at build/Metro startup. Do not set that override for distribution builds. Device login uses `tracing://` and retains `kaneo://` for existing clients; the server's approval page supports both. Expo SDK 58 [app configuration](https://docs.expo.dev/versions/v58.0.0/config/app/) and [Constants](https://docs.expo.dev/versions/v58.0.0/sdk/constants/) docs were checked. Native builds must be rebuilt after removing the purchases library or changing the application identifier.

## Shared-file register (70 files: 19 integration/config files, 20 catalogs, 28 workflow moves, 3 fixture paths)

| File | Change and reason |
| --- | --- |
| `AGENTS.md` | Replace the external-contributor marker instruction with this guide. |
| `apps/api/src/index.ts` | Mount/type parity routes; run separate migrations and initialize subscribers after upstream startup. |
| `apps/api/src/database/index.ts` | Register side tables in the existing database client. |
| `apps/api/Dockerfile` | Copy parity migrations into the standalone API image. |
| `Dockerfile.tracing` | Copy parity migrations into the bundled image. |
| `apps/docs/openapi.json` | Generated contract for the three foundation routes. |
| `apps/web/src/routes/_layout/_authenticated/dashboard/settings/projects/$projectId/workflow.tsx` | Mount the parity category component. |
| `apps/web/src/hooks/use-user-websocket.ts` | Forward hints and access changes to parity cache handling. |
| `i18n/en-US.json` | Source copy for category settings and the fixed-server mobile sign-in. The 20 other catalogs contain translations of the new strings. |
| `apps/mobile/app.config.js` | Add the fixed server URL to the existing fork-owned config. |
| `apps/mobile/package.json` | Remove the purchases native dependency. |
| `pnpm-lock.yaml` | Remove purchases and its unused transitive packages. |
| `apps/mobile/src/app/sign-in.tsx` | Probe the fixed server, hide server switching, remove unlock flow. |
| `apps/mobile/src/features/sign-in/self-hosted-unlock.tsx` | Delete the purchase screen. |
| `apps/mobile/src/lib/purchases.ts` | Delete the unused purchase client. |
| `apps/mobile/src/lib/session.ts` | Enforce the build's server for persisted credentials. |
| `apps/mobile/src/app/(app)/index.tsx` | Forward workspace hints and access changes to parity cache handling. |
| `.coderabbit.yaml` | Enable automatic reviews and the review approval workflow for this fork. |
| `apps/mobile/src/lib/api/client.ts` | Re-export the pure parity URL normalizer so connection and persisted sessions use the same canonical address without a circular import. |

The following 20 existing catalogs each receive translations for the 11 new source strings (17 added lines per file). Key synchronization began with `pnpm i18n:check:fix`; review then added locale-specific translations. Upstream CI requires locale key parity; no pre-existing translation is replaced. The source remains `i18n/en-US.json`.

| Generated catalog | Change and reason |
| --- | --- |
| `i18n/az-AZ.json` | Translate the new category and sign-in strings. |
| `i18n/de-DE.json` | Translate the new category and sign-in strings. |
| `i18n/el-GR.json` | Translate the new category and sign-in strings. |
| `i18n/es-ES.json` | Translate the new category and sign-in strings. |
| `i18n/fr-FR.json` | Translate the new category and sign-in strings. |
| `i18n/hi-IN.json` | Translate the new category and sign-in strings. |
| `i18n/id-ID.json` | Translate the new category and sign-in strings. |
| `i18n/it-IT.json` | Translate the new category and sign-in strings. |
| `i18n/ja-JP.json` | Translate the new category and sign-in strings. |
| `i18n/ko-KR.json` | Translate the new category and sign-in strings. |
| `i18n/mk-MK.json` | Translate the new category and sign-in strings. |
| `i18n/nl-NL.json` | Translate the new category and sign-in strings. |
| `i18n/pl-PL.json` | Translate the new category and sign-in strings. |
| `i18n/pt-BR.json` | Translate the new category and sign-in strings. |
| `i18n/ru-RU.json` | Translate the new category and sign-in strings. |
| `i18n/tr-TR.json` | Translate the new category and sign-in strings. |
| `i18n/uk-UA.json` | Translate the new category and sign-in strings. |
| `i18n/vi-VN.json` | Translate the new category and sign-in strings. |
| `i18n/zh-CN.json` | Translate the new category and sign-in strings. |
| `i18n/zh-TW.json` | Translate the new category and sign-in strings. |

The maintainer explicitly authorized retiring irrelevant CI/CD. These additional infrastructure edits exceed the original shared-file target and keep upstream automation from running or publishing on the fork. Workflow contents are preserved unchanged in `.github/upstream-workflows/` for reference; GitHub only discovers `.github/workflows/`. The archived workflows are not runnable from their new location.

| Upstream file | Change and reason |
| --- | --- |
| `.github/workflows/agentscan.yml` | Move unchanged to `.github/upstream-workflows/agentscan.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/android.yml` | Move unchanged to `.github/upstream-workflows/android.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/auto-assign.yml` | Move unchanged to `.github/upstream-workflows/auto-assign.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/browserstack.yml` | Move unchanged to `.github/upstream-workflows/browserstack.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/build-images.yml` | Move unchanged to `.github/upstream-workflows/build-images.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/ci.yml` | Move unchanged to `.github/upstream-workflows/ci.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/code-review.yml` | Move unchanged to `.github/upstream-workflows/code-review.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/contribution-eligibility.yml` | Move unchanged to `.github/upstream-workflows/contribution-eligibility.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/dependency-graph.yml` | Move unchanged to `.github/upstream-workflows/dependency-graph.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/deploy-site.yml` | Move unchanged to `.github/upstream-workflows/deploy-site.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/docker.yml` | Move unchanged to `.github/upstream-workflows/docker.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/helm-chart.yml` | Move unchanged to `.github/upstream-workflows/helm-chart.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/helm-validate.yml` | Move unchanged to `.github/upstream-workflows/helm-validate.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/issue-notify.yml` | Move unchanged to `.github/upstream-workflows/issue-notify.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/issue-priority.yml` | Move unchanged to `.github/upstream-workflows/issue-priority.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/mellon.yml` | Move unchanged to `.github/upstream-workflows/mellon.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/nightly.yml` | Move unchanged to `.github/upstream-workflows/nightly.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/pr-size-labeler.yml` | Move unchanged to `.github/upstream-workflows/pr-size-labeler.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/pr-title.yml` | Move unchanged to `.github/upstream-workflows/pr-title.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/publish-cli.yml` | Move unchanged to `.github/upstream-workflows/publish-cli.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/publish-mcp.yml` | Move unchanged to `.github/upstream-workflows/publish-mcp.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/publish-planka-import.yml` | Move unchanged to `.github/upstream-workflows/publish-planka-import.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/release-notify.yml` | Move unchanged to `.github/upstream-workflows/release-notify.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/release.yml` | Move unchanged to `.github/upstream-workflows/release.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/slop-labeler.yml` | Move unchanged to `.github/upstream-workflows/slop-labeler.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/ui-review-run.yml` | Move unchanged to `.github/upstream-workflows/ui-review-run.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/ui-review.yml` | Move unchanged to `.github/upstream-workflows/ui-review.yml`; replaced by fork CI or unrelated upstream automation. |
| `.github/workflows/update-contributors.yml` | Move unchanged to `.github/upstream-workflows/update-contributors.yml`; replaced by fork CI or unrelated upstream automation. |
| `scripts/security/release-inputs.test.mjs` | Read the archived build workflow fixture; retain all security assertions. |
| `scripts/ci/mcp-registry.test.mjs` | Read the archived publish workflow fixture; retain all registry assertions. |
| `scripts/security/workflows.test.mjs` | Read archived fixture commands and scan both workflow directories; retain all security assertions. |

## Fork CI and review

`.github/workflows/parity-ci.yml` runs on pull requests, pushes to `main` and manual dispatches in `Go-Figure-App/tracing`. It uses standard GitHub-hosted Ubuntu runners, read-only repository permissions, pinned actions, and synthetic PostgreSQL data. Checks cover active-workflow validation with checksum-verified actionlint, lint, locale parity, OpenAPI, typecheck, all workspace unit suites, four integration shards, the bundled Docker build, upstream browser flows with parity disabled, and parity browser flows with it enabled. The final result requires every job to succeed; skipped or cancelled jobs fail the gate. Packages run serially inside the unit job to avoid import-time resource contention.

CI retains browser failure artifacts for seven days; it does not publish images, deploy to Railway or submit mobile builds. The 28 inherited workflows have been removed from the active directory. The six that GitHub registered before this change were also disabled, and their queued runs were canceled. This prevents inherited Blacksmith, publishing, Pages, release, sponsor, labeling, and review jobs from activating after merge. CodeRabbit reviews are enabled, and maintainers can also request `@coderabbitai review`. Review findings and the latest commit's checks must be addressed before merging. Production deployment remains a separate approval step.

## Verification commands

Use the `packageManager` version in `package.json` (12.18.0 here; the setup document still says 12.15.0). The integration database name must end in `_test`, and its URL must include a nonempty test password for the file-secret fixture. Upstream's lease fixtures assume a UTC PostgreSQL session, matching its Docker environment.

```sh
pnpm lint
pnpm typecheck
pnpm test
DATABASE_URL=postgresql://kaneo:local-test-password@127.0.0.1:55432/kaneo_parity_test pnpm test:integration
pnpm openapi:check
```

The parity browser test uses its own config so the default upstream smoke suite continues to test a feature-disabled deployment. Start the disposable browser stack with both `tests/e2e/compose.yml` and `tests/e2e/compose.parity.yml`, then run:

```sh
pnpm --dir tests/e2e exec playwright test --config playwright.parity.config.ts
pnpm test:e2e
```

Do not loosen upstream tests. Diagnose failures and record environment limitations. Verify the new routes' success, permission denial and hidden-project cases; both migration sets on an upstream-shaped database; event-to-user-socket-to-cache behavior; and the iOS simulator before calling the phase complete.

For a local web preview outside Docker, explicitly set `VITE_API_URL`, `VITE_CLIENT_URL`, `VITE_TURNSTILE_SITE_KEY` and `VITE_SENTRY_DSN` when building. The checked-in production values are placeholders normally replaced by Docker's entrypoint. Empty CAPTCHA/Sentry values match the disposable test stack. Keep browser checks separate from resource-intensive workspace builds.

## Phase 0 verification (2026-11-12)

All checks used synthetic data and disposable PostgreSQL databases on this machine. No production migration, import, Railway change or distribution build was submitted.

| Check | Result |
| --- | --- |
| Root lint and formatting | Passed; no errors or warnings. |
| Root typecheck | All 22 tasks passed. |
| Workspace unit suites | 3,189 tests passed across package runs, plus 8 MCP protocol/input cases. The complete API suite passed separately: 209 files, 1,647 tests. |
| Full API integration suite | 200 files, 2,213 cases: 2,208 passed initially, 2 local setup failures resolved on rerun, 3 existing provider-conditional skips. No test was changed, skipped or relaxed to resolve a failure. |
| Final parity/lease integration rerun | All 186 cases passed, including all 8 new parity cases and the 178-case upstream lease file. |
| File-secret integration rerun | All 3 cases passed with a nonempty local test password in the URL. |
| OpenAPI check | Generated contract is up to date. |
| Web production build | Passed; existing large-chunk warnings remain. |
| Built-bundle Playwright | All 3 upstream flows passed, plus the parity workflow-category flow with a second browser page receiving the user-socket hint. |
| iOS native build and simulator | Built with 0 errors and 1 build warning. `Tracing` on iPhone 17 / iOS 27 signed into the disposable server and displayed the test workspace/project. Server selection and the purchase screen were absent. |

Failures encountered and resolved without changing upstream assertions:

- The parallel root unit run hit `Test timed out in 5000ms` in `bounded-fetch.test.ts` and `mcp-internal-api-url.test.ts`. The full API suite passed when run alone with unchanged timeouts; all other package suites passed.
- The lease fixture reported `expected { degraded: false } to deeply equal {}` because PostgreSQL's local timezone was not UTC. With the disposable server set to UTC, its complete 178-case file passed.
- The file-secret fixture reported `POSTGRES_PASSWORD_FILE points to an empty file` because the initial local connection URL omitted a password. The fixture passed with a nonempty test password.
- Development-server browser runs encountered `net::ERR_ABORTED` and a detached button while navigating. The first production preview also retained Docker's placeholder CAPTCHA key and displayed `The security check didn't load`. Building with explicit local configuration and running against the built bundle produced four passing browser flows.

The first Go Figure CI run additionally passed the bundled Docker build, all four browser flows, quality/contracts, and all four API integration shards. Its unit job caught four existing web assertions affected by unconditional parity cache removal; the fix avoids touching caches when no parity queries exist and retains the upstream assertions.

Not verified: production data or deployment, Redis fan-out across replicas, physical-device/APNs behavior, OAuth/OTP mobile sign-in, TestFlight/App Store distribution or Android execution. Android identity configuration remains in place and shared mobile code passes typecheck; Android-specific testing is outside this phase's requested scope. Incomplete historical activity cannot recover exact old workflow categories; the backfill limitations above apply.

### Review regression checks (2026-11-13)

- All 22 typecheck tasks, root lint/formatting, and 21 locale catalogs passed.
- All 9 parity integration cases passed, including delayed/out-of-order transitions, concurrent migration startup and lock release after failure. The migration case passed again after the final lock-cleanup change.
- Workspace suites ran 5,151 cases: 5,147 passed initially and four existing editor cases hit local timing failures. Both affected files passed all 15 cases with two workers and unchanged assertions/timeouts. The 25 focused socket/cache cases passed, including the four regressions caught by the first CI run.
- All 176 security, workflow, release and contribution-script cases passed after installing their pinned disposable nginx image and relocating three fixture paths.
- All 28 archived workflow files are byte-for-byte copies of the inherited definitions. Existing translations are unchanged; all 20 non-English locales now translate the 11 new strings.
- Merge remains gated on approval and the latest commit's complete GitHub CI run.

### Additional lifecycle review fixes (2026-11-13)

The second review identified cross-project history interpretation and timestamp drift between two terminal states. Backfill now reconstructs project context backward through recorded moves, and both historical and live transitions carry their source category. A move within the same terminal category retains its entry date; reopening and recompletion record a new date even if the reopening activity is delayed.

All 11 parity integration cases passed, including three project moves with conflicting custom-state categories and terminal-state events delivered before activity insertion and in reverse order. All 1,649 API unit cases and all 22 workspace typecheck tasks passed. The previous commit's full CI run passed all eight checks; the updated commit must pass CI and review again before merge.

Phase 1 starts after this phase receives approval and its latest CI run is green, as authorized by the maintainer. No new product decision is required before triage work; the importer boundary must be settled before Phase 7.


## Phase 0 merged

[PR #1](https://github.com/Go-Figure-App/tracing/pull/1) merged as `d7b7b71` after CodeRabbit approved the final head and all nine checks passed. The subsequent main-branch CI run `43390076716` passed all eight jobs.

## Phase 1: triage

Enable `PARITY_FEATURES=foundation,triage` to show the workspace Triage inbox, project settings and the iOS Inbox segment. Pending tasks remain excluded from normal boards, assigned-task lists, search, calendar feeds, public descriptions and public assets even if the flag is later disabled. Authorized members can still open their normal task detail to edit fields, comments, labels or attachments. Declined and duplicate submissions appear in the canceled column.

The inbox supports paging and project filters, accept (`1`), duplicate (`2`), decline with a required comment (`3`), and snooze (`H`). Acceptance validates the destination column, assignment and required fields, materializes defaults, and publishes the normal task lifecycle events. Member creation preserves dates, priority, recurrence, custom fields and staged assets. API keys retain their explicit scopes, including assignment permission. Non-null cycle assignment is rejected until Phase 4.

Project settings control triage, its owner, a revocable 256-bit intake token and the GitHub/GitLab/Gitea routing switches. Enabling triage creates a canceled-category column if the project has none. Integration configuration is merged without returning secrets. The anonymous intake route only returns a receipt; it never reveals the project or task. Duplicate notices to intake email addresses contain no private task identifiers, titles or links. Email requires the existing SMTP configuration.

Intake limits apply per API process: 300 requests/minute globally, 20 per IP, 30 per token, with a bounded 2,048-entry map and a 64 KiB request body limit. Unknown client IPs share a bucket. Replicas do not share quotas; Redis remains optional. The five-minute snooze job uses the existing distributed job lease. Lists also treat expired snoozes as due immediately, so a delayed scheduler does not hide work.

MCP adds `list_triage_items`, `create_triage_item`, `accept_triage_item` and `decline_triage_item` through the existing registrar, making them available to both stdio and the API's authenticated remote MCP transport.

### Phase 1 shared-file additions and extensions

Small read predicates are necessary to keep pending reports out of every existing public/list surface. A task-created subscriber alone cannot make integration intake atomic: the original task would already be committed and eligible for outbound sync. Each supported webhook producer therefore calls the parity staging helper inside its transaction and selects the triage event before publishing. Domain behavior stays in parity modules. These integration points exceed the original shared-file target; the maintainer authorized continuing with the closest Linear behavior. No upstream table or upstream migration is altered.

| File | Change and reason |
| --- | --- |
| `apps/api/src/index.ts` | Mount anonymous intake before session auth, initialize triage subscribers, keep pending-task assets private. |
| `apps/api/src/task/controllers/get-tasks.ts` | Exclude pending triage from board queries and their counts. |
| `apps/api/src/task/controllers/get-task.ts` | Exclude pending tasks from board-card mode; retain authorized detail access. |
| `apps/api/src/task/controllers/get-assigned-tasks.ts` | Exclude pending reports from assigned-task lists. |
| `apps/api/src/task/recurrence/create-next-occurrence.ts` | Prevent pending intake from starting a recurring series through ordinary task editing. Decline/duplicate stop the rule atomically and retain it in decision activity. |
| `apps/api/src/task/get-subtask-counts.ts` | Exclude pending children from visible task counts. |
| `apps/api/src/task/description-pages.ts` | Exclude pending reports from public descriptions and description searches. |
| `apps/api/src/project/controllers/get-projects.ts` | Exclude pending reports from project task statistics. |
| `apps/api/src/search/controllers/global-search.ts` | Exclude pending reports from title, identifier, activity and comment search. |
| `apps/api/src/calendar-feed/service.ts` | Exclude pending reports from published calendar feeds. |
| `apps/api/src/scheduler/index.ts` | Register and stop the leased triage snooze job. |
| `apps/api/src/task-relation/schema.ts` | Allow the design’s duplicate relation type. |
| `apps/api/src/task-relation/response.ts` | Describe duplicate relations in the public contract. |
| `apps/docs/openapi.json` | Generate the triage API contract and duplicate relation enum. |
| `apps/mobile/src/app/(app)/index.tsx` | Mount the planning Inbox and combine unread and triage counts. |
| `apps/mobile/src/app/(app)/task/new.tsx` | Mount the triage switch and route creation through the parity endpoint. |
| `apps/mobile/src/features/task/sections.tsx` | Display duplicate relationships in native task detail. |
| `apps/web/src/components/inbox/inbox-task.tsx` | Allow triage detail to show the existing Markdown description renderer. |
| `apps/web/src/components/nav-main.tsx` | Add the feature-gated Triage entry and count. |
| `apps/web/src/components/settings/nav/use-settings-nav.ts` | Add feature-gated project triage settings navigation. |
| `apps/web/src/components/shared/modals/create-task-modal.tsx` | Mount the triage option; preserve task inputs and avoid optimistic board insertion for pending items. |
| `apps/web/src/components/task/sections/relation-tag.tsx` | Display duplicate relation labels. |
| `apps/web/src/components/task/task-relations.tsx` | Group duplicate relationships in both directions and navigate using the linked task’s project. |
| `apps/web/src/fetchers/task-relation/create-task-relation.ts` | Include duplicate in the typed relation union. |
| `apps/web/src/routeTree.gen.ts` | Generate the new inbox, settings and public-intake routes. |
| `i18n/en-US.json` | Add web and mobile triage copy; all 20 existing locale catalogs translate the same new keys. |
| `i18n/schema.json` | Synchronize only the parity namespaces; preserve unrelated inherited schema entries. |
| `packages/mcp/src/tools/register.ts` | Register the four triage tools. |
| `tests/api-integration/helpers/database.ts` | Apply additive parity migrations after upstream migrations; drain real background event/delivery work before truncating fixtures. |
| `tests/api-integration/setup.ts` | Track real asynchronous event subscribers and notification deliveries in tests, draining before mock restoration to prevent teardown deadlocks and cross-test writes. |
| `apps/api/src/billing/controllers/require-entitlement.ts` | Accept an existing database transaction for triage entitlement checks. |
| `apps/api/src/billing/controllers/get-workspace-billing.ts` | Carry that transaction through billing lookup, trial claiming and conflict recovery to avoid nested pool acquisition. |
| `tests/api-integration/mocks/email.ts` | Provide the existing notification-email export in the test mock. |
| `apps/api/src/plugins/sync/eligibility.ts` | Prevent pending intake from outbound sync without setting a sticky filter-pause marker; acceptance restores normal eligibility. |
| `apps/api/src/plugins/github/webhooks/issue-opened.ts` | Stage opted-in incoming tasks atomically and publish the triage event instead of outbound task creation. |
| `apps/api/src/plugins/gitlab/webhooks/issue-opened.ts` | Stage opted-in incoming tasks atomically and publish the triage event instead of outbound task creation. |
| `apps/api/src/plugins/gitea/webhooks/issue-opened.ts` | Stage opted-in incoming tasks atomically and publish the triage event instead of outbound task creation. |

The feature-owned API/mobile/web modules, routes, tests, partial queue index and migration metadata live in the parity locations. The existing parity browser override now enables triage as well as foundation. CI already discovers new workspace tests, integration files and `*.parity.ts` browser flows; no new deployment workflow is introduced.

### Phase 1 verification

Automated public fixtures use synthetic local data. An additional private local rehearsal copied five authorized Linear issues, preserving titles and complete Markdown descriptions (up to 8,521 characters), hiding all five from the board before acceptance and showing them afterward. The source data is outside the repository. The browser flow checks anonymous intake, two-tab live updates, all four decisions and revoked-link rejection. Native iPhone 17 / iOS 27 verification includes the combined badge, swipe acceptance and decision sheets. A native modal-transition bug found during this check was fixed by retaining one sheet while changing its content.

The focused API suite covers concurrent decisions, project access, API-key scopes, defaults, preserved member fields, staged-asset ownership, public asset privacy, integration rollback, token rotation and the leased snooze job. Provider regression suites passed 207 tests (three inherited skips), including all three integrations with the feature enabled, disabled and opted out. The final Docker image passed three upstream browser flows with parity disabled and both parity flows with it enabled. The complete local integration run passed 2,230 tests and exposed two failures (a cached pre-fix recurrence module and a connection timeout under load); both failed files plus upstream recurrence passed fresh against final source, 24/24, without changing assertions or timeouts. Exact final CI and review results are recorded on the phase PR before merge. No production migration, import, Railway change or distribution submission is included.

Phase 1 review corrections add transaction-aware billing (including trial-claim race recovery), exclude pending activity/comment search, reject declined duplicate targets, separate the project-create route from workspace-list routes, and use the shared nullable timestamp contract. Web regression tests cover focused shortcuts, creating pending tasks while columns fail to load, and queue shrinkage across pages. Native duplicate search shows loading, empty and retry states. Cross-project duplicate links use the target project.

The initial PR CI passed quality, workspace units, Docker/browser tests and three integration shards; one shard exposed an inherited background-notification query racing the next fixture's TRUNCATE. Integration setup now tracks real subscriber/delivery promises and drains them before reset and mock teardown without changing production event timing or test timeouts. Focused cleanup, triage, existing billing, modal and client-contract tests passed after these corrections.

## Manufact MCP assessment

Reviewed 2026-11-13. Tracing already serves authenticated MCP at `/api/mcp`; both HTTP transports and stdio use `packages/mcp/src/tools/register.ts`. Extend that registrar with each planning phase so authorization continues through the same API. The published upstream npm package does not contain this fork's new tools; use our build or the fork's endpoint after an approved deployment.

The proposed first integration is a direct external connection to the existing endpoint for inspection and evaluations. Manufact supports other MCP SDKs and existing OAuth, so this does not require rewriting Tracing onto mcp-use. External connections currently require setup assistance. A proxy or separately hosted server is a later routing/deployment decision. See [integration options](https://docs.manufact.com/dashboard/framework-and-cloud) and [OAuth test accounts](https://docs.manufact.com/dashboard/dashboard-oauth).

Published base usage rates are $0.10/1,000 tool calls, $0.70/evaluation, $0.07/build minute, $0.15/GB egress and $5/million managed-chat tokens. These consume a shared allowance; a $100 grant is not an unlimited plan. Account balance, grant terms and expiry have not been verified. The [billing documentation](https://docs.manufact.com/dashboard/billing) lists external connections on every plan, while the [pricing table](https://manufact.com/pricing) lists them only on Enterprise; confirm the account entitlement before choosing a plan. No subscription, deployment or credit consumption was initiated.

Once the account and deployment are approved, verify the credit balance and overage limit, connect a dedicated test account through Tracing OAuth, and evaluate tool discovery, pending-item creation, acceptance, required decline comments and hidden-project denial against a disposable workspace. Keep real Linear exports out of public fixtures and Manufact payload capture. Authenticate through the official sign-in flow, without putting credentials in source files or PR comments.

## Phase 2 — project planning and initiatives

Phase 2 adds project status, lead, start/target dates and priority, milestones, health updates, and initiatives with many-to-many project links. Enable `projects,initiatives`; `initiatives` also enables `projects` because its linked-project pages use project plans. Features still default off. The previous phase merged as [PR #2](https://github.com/Go-Figure-App/tracing/pull/2); its merge commit passed Go Figure CI.

The API lives in `parity/planning`. Four new tables and one milestone lookup index are introduced by `0002_planning.sql`; all foreign keys are inline in new table declarations. The migration test now compares every existing upstream table's columns and the upstream migration ledger before and after parity migration. No upstream schema or migration is changed.

Progress excludes pending triage and canceled-category tasks (including declined and duplicate decisions), resolves both current column IDs and legacy status slugs, and uses only projects the caller can read. Optional estimates use one point for unestimated work. Project and milestone writes lock the project before related rows. Concurrent updates use their insertion time after the parent lock, so the feed's latest update agrees with stored health. Moving projects unlinks initiatives from their old workspace; moving tasks clears obsolete milestone assignments. Reads immediately hide stale links, including before subscribers run.

Weekly reminders use the existing scheduler and job leases. An hourly scan nudges eligible project leads whose project has gone seven days without an update, with a durable one-week receipt per lead/workspace. Notifications contain a generic workspace prompt, so a later project-access change cannot expose its name. Orphaned updates are cleaned in bounded batches; archived initiative history is retained.

Web adds a project overview tab, workspace projects grouped by status, initiative list/detail and editing, milestone creation/editing/reordering/deletion, and a task milestone picker. Status updates render Markdown. Native adds project overviews before boards, editable project properties, initiative list/detail and limited name/owner/date/status editing, update posting, milestone assignment, and a More tab containing Activity and Initiatives. Date and owner fields can be cleared. Archived projects retain their existing board entry point. Existing React Native picker sheets, Markdown rendering and Expo Router are reused; no native dependency is added.

Eight MCP tools use the same authenticated API: `get_project_plan`, `update_project_plan`, `list_milestones`, `create_status_update`, `list_initiatives`, `get_initiative`, `create_initiative`, and `add_project_to_initiative`. The HTTP and stdio registrars both include them. This continues the existing Manufact-compatible endpoint approach; no Manufact service, deployment or paid usage was started.

### Phase 2 shared-file additions and extensions

| File | Change and reason |
| --- | --- |
| `apps/api/src/index.ts` | Initialize planning event subscribers after startup. |
| `apps/api/src/scheduler/index.ts` | Register the leased planning reminder/orphan cleanup tick. |
| `apps/web/src/components/common/project-layout.tsx` | Mount Overview navigation and preserve it when switching projects. |
| `apps/web/src/components/common/project-layout.test.tsx` | Supply the feature query provider to the existing isolated layout tests; retain all access and navigation assertions. |
| `apps/web/src/components/nav-main.tsx` | Add gated Initiatives and Projects entries. |
| `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/projects.tsx` | Mount the planning projects page when enabled; preserve the original page when disabled. |
| `apps/web/src/components/task/properties/properties-rail.tsx` | Mount the milestone picker in full task properties. |
| `apps/web/src/components/task/properties/property-chips.tsx` | Mount the milestone picker in compact task properties. |
| `apps/web/src/routeTree.gen.ts` | Generated routes for Overview and Initiatives. |
| `apps/mobile/src/app/(app)/index.tsx` | Mount More while planning is enabled. |
| `apps/mobile/src/features/home/bottom-nav.tsx` | Replace Activity with More when planning is enabled; retain four tabs. |
| `apps/mobile/src/features/home/home-tab.tsx` | Open active project overviews before boards when enabled. |
| `apps/mobile/src/features/task/properties.tsx` | Mount the native milestone picker. |
| `packages/mcp/src/tools/register.ts` | Register the eight planning tools. |
| `Dockerfile.tracing` | Install web dependencies from manifests before copying source, retaining the install cache on UI changes. |
| `apps/docs/openapi.json` | Generated planning contract. |
| `apps/web/src/query-client/index.ts`, `apps/mobile/src/lib/query.ts` | Clear parity caches on forbidden/missing-resource responses, including native action failures, using an owned helper. |
| `i18n/en-US.json`, the 20 other catalogs, `i18n/schema.json` | Add web/native planning keys. New non-English copy currently uses the permitted English fallback; existing translations are unchanged. Only parity branches of the generated schema are synchronized to avoid unrelated inherited drift. |

The feature's domain logic remains in owned modules. The small navigation/property mounts extend the shared-file register already expanded in earlier phases; they do not rewrite upstream controllers. The existing Go Figure CI still runs quality/contracts, workspace unit tests, four PostgreSQL integration shards, Docker build and browser flows. Its parity Compose overlay now enables projects and initiatives, and Playwright discovers the two new planning flows. No release or deployment workflow is activated.

### Phase 2 verification

Focused API/migration tests cover all new routes, viewers and custom roles, read-only API keys, hidden projects, cross-workspace links, legacy tasks, milestone cleanup, archived initiatives, concurrent updates, event subscribers, and durable reminder deduplication. Browser flows cover both features, including live milestone progress across two tabs, assignment/clearing, persisted plan properties, update health, linking/unlinking projects and archive/restore.

The maintainer authorized copies of Go Figure Linear data for local testing. A private rehearsal exercised 27 project plans, 25 milestones and 29 initiative links (two projects in multiple initiatives); 26 missing start dates, 20 missing target dates and six missing leads round-tripped. Lead identity was mapped to the synthetic local member for this rehearsal; production identity mapping belongs to Phase 7. Real source data and rehearsal scripts/results remain outside the repository and are not CI fixtures or PR attachments. No Linear writes or production import occurred.

The final bundled image passed all three upstream browser flows with parity disabled, then all four parity flows with it enabled. Lint, i18n, generated OpenAPI and all 22 workspace typecheck/build tasks passed. Workflow/security regression tests passed 176 checks and browser-security fixtures passed 53. The native development build succeeded on iPhone 17 / iOS 27; manual checks covered project properties, Markdown health updates visible on web, milestone assignment and clearing, initiative creation and owner removal, and viewing linked-project progress. Android was not exercised. New non-English strings retain the permitted English fallback; charts over historical project progress are implemented with Insights in Phase 5.

Phase 2 review fixes preserve descriptions when omitted from milestone/initiative patches and preserve incoming lead/owner changes until a picker is explicitly edited. Reminder scans use bounded keyset pages past denied leads, cache role checks within a tick, and retain the 500-delivery cap. Reconciliation publishes project-scoped hints in the current workspace and initiative hints in former workspaces. Web and native lists deduplicate overlapping pages and hide rows after failed refreshes; forbidden/missing-resource responses cancel pending reads and erase parity content while keeping active error/retry state. Non-sensitive feature flags remain available so those screens can render. Native planning actions expose button roles. Regression tests cover these cases, including more than 500 denied leads, description archive/restore, late query responses and concurrent owner changes.

The next review pass restricts cache clearing to operations explicitly identified as parity queries, mutations or native actions, preserving open planning drafts when an unrelated request returns 404. Native paginated lists retain successfully loaded items during transient errors and show an empty state only after a successful empty response. Initiative ordering controls require a successful, fully loaded list; both component and browser regressions verify reordering and its persisted order.

## Phase 3: roadmap

`PARITY_FEATURES=roadmap` enables the workspace timeline and its planning dependencies. `GET /api/parity/roadmap/{workspaceId}` returns one compact snapshot of readable active projects, their progress, milestones and active initiative links. It omits large descriptions and update bodies, batches aggregates instead of querying per project, and omits archived, hidden and cross-workspace links. The existing workspace/project/task read permissions apply to sessions and API keys. There are no new tables or migrations.

Web shows projects in every linked initiative, with unlinked projects last and incomplete schedules in an undated side list. Week, month, quarter and year windows allocate at most 366 calendar days. Today, previous/next and a date jump control navigate long plans. Status, lead, initiative and health filters apply to the full authorized snapshot. Dragging a bar moves both dates while preserving its duration; edges resize a single date; diamonds change milestone dates. Arrow keys move one day, Shift plus arrows one week, and Escape cancels a drag. A date editor provides an alternative and can clear either date. Dropping an unscheduled project creates a seven-day inclusive plan, clamped at the maximum supported year. Project moves leave milestone dates unchanged, following the design's separate project and milestone PUT contracts. Existing planning mutations enforce project-update permission and refresh other clients through the user socket.

The timeline reuses upstream's pure `parseTaskDate` helper; its fixed 91-day Gantt window is unsuitable for the four roadmap zoom levels, so bounded window/drag geometry lives in the owned roadmap module. The endpoint intentionally returns the complete compact workspace snapshot specified by the design; pagination/virtualization for very large portfolios is not introduced in this phase. No new backend service, chart library or native dependency is added.

The iOS More tab opens a read-only grouped list with dates, lead, health, progress and the next incomplete milestone. Selecting a project opens its existing overview. A project in multiple initiatives appears in each section. Native lists retain their loaded data during transient errors, hide it for access denials and offer retry. The existing API-key and HTTP/stdio MCP planning operations continue to work; the design does not add a roadmap-specific MCP tool.

### Phase 3 integration register

| File | Change and reason |
| --- | --- |
| `apps/web/src/components/nav-main.tsx` | Add a feature-gated Roadmap navigation entry. |
| `apps/web/src/routeTree.gen.ts` | Generated roadmap route. |
| `apps/docs/openapi.json` | Generated roadmap response contract. |
| `i18n/en-US.json`, the 20 other catalogs and `i18n/schema.json` | Add web/native roadmap copy; new non-English keys retain the permitted English fallback. |

All other implementation changes are in owned parity modules, new route files and tests. The existing Go Figure CI discovers the new tests; its disposable Compose overlay enables roadmap alongside prior features. The three upstream browser flows still run with parity disabled before the parity flows. No deployment or release workflow is enabled.

### Phase 3 verification

The complete PostgreSQL suite passed all 207 files: 2,268 tests passed with three inherited skips. The new roadmap route and migration compatibility also passed six focused integration checks, including session/API-key authorization, hidden projects, archived plans and initiatives, stale cross-workspace links, compact progress and empty workspaces. Nine web helper/component tests cover bounded calendar windows, daylight saving, date clamping, grouping, combined filters, keyboard/pointer edits, cancellation and read-only controls. The initial complete workspace unit suite passed 5,229 tests (including 141 native tests), and all 22 typecheck/build tasks passed. An initial parallel package run hit inherited module-import timeouts; the unchanged tests passed with the same serial package execution used by CI. Lint, every translation catalog and the generated OpenAPI contract passed. Workflow/security regression checks passed all 176 tests, and browser-security fixtures passed all 53.

The bundled image passed all three upstream browser flows with parity disabled and all six parity flows with it enabled. The roadmap flow uses real pointer dragging for projects, resize handles and milestones, verifies another tab receives dates over the socket, schedules an undated project, filters, and clears dates through the editor. It waits for the preceding UI save to finish before another drag. Manual browser inspection covered week/month navigation, health colors, lead avatar, progress and milestone placement. The iPhone 17 / iOS 27 simulator showed initiative grouping, dates, lead, progress and next milestone, and opened the existing project overview from a roadmap card.

A read-only rehearsal of the authorized local Linear copy matched all 27 projects, 25 milestones and 29 initiative links, preserving 26 absent start dates and 20 absent target dates. Source records, credentials and rehearsal output remain outside the repository. No production import, deployment, TestFlight upload or paid service activation occurred.

Phase 3 review fixes keep pointer-captured bars, resize handles and milestone markers mounted when their preview crosses the visible window. Off-window previews are clipped or transparent until release/cancellation, avoiding lost saves and stuck deltas. Drag commits use the latest callback after a realtime refetch, so saved dates match the current preview. All 15 focused roadmap tests and all 22 workspace typecheck/build tasks passed. The rebuilt image passed the expanded browser flow, including both edges and whole bars/markers crossing the weekly window, plus project and milestone dates changing through another client during a drag.

## Phase 4: cycles

The maintainer approved two model additions on 2026-11-13: `workspace_ext.time_zone` (IANA timezone, default UTC) and `cycle_day.project_totals` (per-project historical counts/points). The upstream workspace has no timezone field. Workspace-wide historical totals cannot be filtered after rollover or a project-access change, so each daily snapshot retains its project breakdown; close summaries retain the same breakdown inside the already-designed `cycle.summary` JSON. Responses sum only currently readable, active projects and never return the stored breakdown. Imported aggregate-only history is marked unavailable instead of being presented as permission-filtered history.

Migration `0003_cycles.sql` creates `cycle` and `cycle_day`, their keys/indexes, and the approved timezone side-table column. Drizzle generated the schema snapshot; new-table foreign keys are inline. No upstream table or migration is modified. The separate migration rehearsal verifies that the upstream schema and ledger stay unchanged and that repeated/concurrent startup remains safe.

The cycle API owns settings, cycle lists/details, upcoming date edits, filtered tasks, task estimates/assignments and atomic bulk cycle/estimate/milestone updates. Calendar arithmetic preserves local midnight through daylight saving. Changing cadence preserves active dates and upcoming IDs; disabling closes current cycles, removes upcoming cycles and clears those assignments without deleting issues. Historical summaries remain immutable, while the task list reflects current assignments. Triage acceptance can assign a workspace cycle in the same transaction.

The hourly `cycle-tick` uses the existing durable job lease. Workspace, project and task locks follow upstream move ordering. Closing rolls only accepted unfinished tasks, writes system activities, and retains completed/canceled assignments. An extended outage closes at most 64 cycles per workspace transaction and resumes next tick; it never invents daily history. Same-day snapshots update only when totals or their project allocation change. Realtime subscribers clear stale cross-workspace cycle references and invalidate cycle data after task/project changes.

Web adds current/upcoming/past pages, editable cadence and upcoming dates, a burndown chart with an accessible history table, grouped and filtered cycle tasks, and a This cycle section in My Tasks. Task properties and context menus support cycle/estimate assignment and clearing; Shift+C and Shift+E open those pickers. Board, list, backlog and schedule filters use one compact project assignment query only while the filter is active, avoiding per-card requests. Atomic bulk controls update cycle, estimate or milestone for up to 100 selected tasks. List reordering and board collection actions are disabled while a cycle filter is active because those upstream actions rewrite the displayed subset; individual board-card moves still use the canonical project cache.

Native adds a current-cycle Home card, a Cycles entry under More, current/upcoming/past lists, grouped/filtered cycle tasks, SVG burndown and accessible daily rows, task cycle/estimate sheets, and This cycle in My Tasks. Cycle screens refetch when the native stack focuses them after task edits. Dates and remaining days use the workspace calendar, including 23/25-hour days. The existing Expo Router and react-native-svg dependencies are reused; there is no native dependency or build-service change.

Four MCP tools (`list_cycles`, `get_cycle`, `update_task_cycle`, `update_task_estimate`) are registered for both HTTP and stdio. They use the same permission-checked API and preserve explicit nulls for clearing properties. The feature-owned API also exposes a compact project assignment lookup for existing task views and a task-property lookup shared by the two pickers. No upstream task controller is modified.

### Phase 4 integration register

| File | Change and reason |
| --- | --- |
| `apps/api/src/index.ts` | Initialize the owned cycle event subscribers. |
| `apps/api/src/scheduler/index.ts` | Mount the owned hourly cycle job on the existing scheduler. |
| `apps/web/src/components/task/properties/property-chips.tsx`, `properties-rail.tsx` | Mount the owned cycle and estimate pickers. |
| `apps/web/src/components/task/task-action-target.ts`, `apps/web/src/lib/shortcuts/catalog.ts` | Register cycle/estimate property targets and Shift+C / Shift+E in the existing shortcut manager. |
| `apps/web/src/components/kanban-board/task-card-context-menu/task-card-context-menu-content.tsx` | Mount lazy cycle/estimate context-menu sections. |
| `apps/web/src/components/bulk-selection/bulk-bar.tsx` | Mount atomic planning bulk actions. |
| `apps/web/src/components/project/toolbar/use-project-task-view.ts`, `project-toolbar.tsx`, `apps/web/src/components/project/task-filters/use-filter-shortcuts.ts` | Compose the owned cycle predicate and picker with existing task filters; register cycle selection with clear-filter shortcuts using the shared hook’s minimal subject interface. |
| `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx` | Guard subset-rewriting actions while cycle filtering. |
| `apps/web/src/components/nav-main.tsx`, `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/my-tasks.tsx` | Mount Cycles navigation and the assigned current-cycle section. |
| `apps/web/src/query-client/index.ts` | Apply owned parity defaults so invalidated inactive views refresh on return; other queries keep upstream defaults. |
| `apps/web/src/routeTree.gen.ts` | Generated cycle routes. |
| `apps/mobile/src/features/task/properties.tsx` | Mount native cycle/estimate pickers. |
| `apps/mobile/src/features/home/home-tab.tsx`, `my-tasks-tab.tsx` | Mount current-cycle Home card and This cycle task list. |
| `apps/mobile/src/app/(app)/index.tsx` | Show More when cycles are enabled independently of projects. |
| `packages/mcp/src/tools/register.ts` | Register four cycle tools for both transports. |
| `apps/docs/openapi.json` | Generated settings, cycle, task-property, project-metadata and bulk contracts. |
| `i18n/en-US.json`, the 20 other catalogs, `i18n/schema.json` | Add web/native cycle copy and valid locale plural forms, retaining English fallback for new keys. Only parity branches of the generated schema are synchronized. |
| Existing context-menu, toolbar, board and Gantt test fixtures | Mock the new parity hook/component at existing isolation boundaries; keep all original behavior assertions. |
| `tests/e2e/compose.parity.yml` | Enable cycles on the disposable parity stack; feature-off browser checks still run first. |

The API, schema, migrations, clients and feature tests remain in owned parity locations. The existing Go Figure CI discovers cycle unit tests, API integration tests across four shards and the browser flow. No release/deployment job is activated.

### Phase 4 verification

Focused API tests cover migration compatibility, local-midnight cadence and daylight saving, repeat/concurrent ticks, rollover and immutable summaries, estimate scales, task and bulk assignments, triage acceptance, project moves, hidden projects, API-key restrictions and feature-off routes. Web tests cover pickers, settings drafts, bulk changes, filter failures, charts and inactive-query refresh. Native tests cover explicit-null requests, filter serialization and chart/calendar calculations; MCP tests cover registration, paths, pagination, clear actions and API errors.

The iPhone 17 / iOS 27 simulator verified current/upcoming lists, task assignment to another cycle and clearing, estimate selection and clearing, current-cycle task navigation, Home totals, and My Tasks / This cycle. A return-to-detail check found stale points after editing a task; a focus refresh now updates both the cycle screen and Home card. Android was not exercised.

The authorized private Linear rehearsal preserved all 16 cycle numbers and exact start/end instants, and 95 historical daily records. It covered the 169-hour week crossing daylight saving. America/New_York was a local rehearsal assumption consistent with the observed UTC offsets, not a verified Linear workspace setting. Imported history lacks per-project breakdowns, so the API correctly reports it unavailable and does not expose the aggregate chart to a restricted viewer. Source records, credentials, rehearsal script and output remain outside the repository.

Lint, localization, generated OpenAPI and all 22 workspace typecheck/build tasks passed. The complete unit suite passed across the workspace after updating the Gantt fixtures to isolate the new parity hook without changing their assertions; the web rerun passed all 396 files / 2,023 tests. The final native cycle suite passed seven tests and the MCP package passed all 373 tests. Full PostgreSQL integration passed all 210 files / 2,294 tests, with three inherited skips. The final bundled image passed all seven parity browser flows and all three upstream flows with parity disabled. All 53 browser-security checks and the release/workflow/security checks passed, including reruns of fixtures affected by local Docker disk exhaustion. No production migration, deployment, import, distribution upload or paid service activation is included.

Phase 4 review fixes resolve every cycle boundary from its local calendar date, including skipped midnight in America/Santiago, and wait for task event handlers before announcing the next rollover or bulk change. State grouping keeps project-local column slugs distinct. Cycle assignment and task filters remain clearable when metadata requests fail on web and native; the board clearing shortcuts include the cycle filter. Chart dates and native totals use the current locale. Request bodies reject unsupported fields, with regenerated OpenAPI schemas. Regression tests cover skipped midnight, bounded event delivery, cross-project grouping, metadata failures, shortcut composition, fresh-cache invalidation and a date-controlled disable scenario. Cycle total reducers share one owned module to keep the PR within the current review file limit.

Review-fix verification passed 11 API unit tests, nine native cycle tests, 33 focused web tests, 27 PostgreSQL integration tests, and the seven-test scheduler/event-delivery rerun. All 22 workspace typecheck/build tasks, lint, localization and regenerated OpenAPI checks passed. The final bundled image passed the expanded cycle browser flow, including both clear-filter shortcuts. A fresh iOS development bundle verified clearing a cycle while its options endpoint returned 503, restoring the assignment, refreshed totals and localized daily-history dates. Local Docker disk exhaustion was resolved by removing only obsolete Tracing test images and their build cache.

## Phase 5: Insights

`PARITY_FEATURES=insights` enables the permission-filtered reporting API, workspace dashboard and native cycle summaries. The foundation's lifecycle timestamps/backfill and completed-at/cycle indexes, cycle close summaries and per-project daily history supply the reports; no additional model or migration is needed. `GET /api/parity/insights/{workspaceId}` implements throughput, lead time, cycle time, velocity, burndown, scope change, created-versus-completed, time in state, workload and time to triage.

Task reports use PostgreSQL `date_trunc` and `percentile_cont`, with week boundaries in the workspace timezone. Calendar filters include both end dates and cover at most two years; the default is the last 12 weeks, or the selected cycle. Task measures support week, cycle, assignee, project, label and priority slices. Unestimated work counts as one point when estimates are enabled, matching cycles. Label slicing can count an issue in multiple label groups, while other slices never multiply labeled issues. Missing lifecycle intervals remain unavailable; they are not zero-day observations.

Historical cycle measures accept project/initiative filters and the cycle slice. They reject assignee filters because the approved history stores project totals, not historical assignments. Burndown requires a cycle and returns daily rows. Velocity uses immutable close totals and up to three most recent closed cycles for its average. Scope change compares the first day's recorded scope with closing scope; a missing first-day sample does not become an invented baseline. Aggregate-only imported history is unavailable when it cannot be permission-filtered. Time in state batches activity reads and averages each task's recorded time in each category, clipping to the requested dates and excluding history in inaccessible projects. Workload shows current open work; API date filters optionally select a creation cohort, while the dashboard leaves workload unbounded by dates.

The bounded, per-user/query memory cache lasts 60 seconds. Every hit rechecks current readable projects, and task/project/planning events invalidate cached results. A revision guard prevents an in-flight report from restoring data invalidated while it was computed. The implementation requires no Redis or analytics service. Task reports limit groups to 2,000; cycle reports have the same bound. State history pages tasks and caps each activity batch, returning a filter-narrowing error instead of silently truncating results.

Web adds project, initiative, cycle and date filters, fixed report panels, count/point toggles and accessible data tables. Recharts and its matching React peer are loaded through the chart module only when a report renders. Project overview embeds created-versus-completed progress; the cycle page retains its existing accessible burndown. Charts show workspace-local dates and locale-formatted numbers. Failed report requests hide cached results and offer retry; disabling estimates switches a previously selected points view back to issue counts.

Native More opens current/last-cycle cards with velocity, throughput, median cycle time, the closed-cycle average and a small weekly SVG chart. Missing history is explicit. Focus and pull-to-refresh update the cards. The existing react-native-svg dependency is reused; no new native dependency or distribution change is needed. The design adds no Insights-specific MCP operation.

### Phase 5 integration register

| File | Change and reason |
| --- | --- |
| `apps/api/src/index.ts` | Initialize owned report cache invalidation subscribers. |
| `apps/web/package.json`, `pnpm-lock.yaml` | Add Recharts and the React-version-matched react-is peer. |
| `apps/web/src/components/nav-main.tsx` | Add feature-gated Insights navigation. |
| `apps/web/src/routeTree.gen.ts` | Generate the workspace Insights route. |
| `apps/mobile/src/app/(app)/index.tsx` | Show More when Insights is enabled independently. |
| `apps/docs/openapi.json` | Generate the strict reporting query and response contract. |
| `i18n/en-US.json`, the 20 other catalogs and `i18n/schema.json` | Add web/native reporting copy, retaining the permitted English fallback for new non-English keys. |
| `tests/e2e/compose.parity.yml`, `tests/e2e/smoke.spec.ts` | Enable Insights on the disposable parity stack and assert its navigation stays absent in the feature-off smoke flow. |
| `.github/workflows/parity-ci.yml` | Retain the disposable browser failure traces, screenshots and report for seven days so CI failures can be diagnosed. |
| `apps/web/src/hooks/use-user-websocket-lifecycle.test.tsx` | Extend the existing empty query-cache fixture with `findAll`; retain all upstream revocation and reconnect assertions. |

All other changes live in owned parity modules, new route files and tests. Go Figure CI discovers the additional unit, PostgreSQL and browser tests without a new workflow or service. Deployment/release workflows remain inactive.

### Phase 5 verification

Focused PostgreSQL tests cover every metric, all task slices, timestamp percentiles, missing history, readable-project totals, immutable history, API-key scopes, feature-off behavior, invalid filters and event-driven cache invalidation. Web tests cover missing versus zero values, points disabling, permission errors and retry. Native tests cover report requests and summary/chart calculations. The first CI run passed quality/contracts, the complete unit suite and all four PostgreSQL shards. Its three upstream browser flows and seven existing parity flows passed; the new Insights flow exposed the access-sync issue described below. The corrected Insights browser flow also passed locally, including filtering, point totals, accessible data and recovery from permission errors. Final CI verification is in progress.

Review corrections publish an internal lifecycle event after its transaction commits, preventing an intervening report from caching pre-commit timestamps. Time-in-state history omits an uncertain trailing interval when the last recorded state differs from the current task. The feature-off browser assertion waits for the feature response and checks the actual navigation button. Narrowed burndown ranges retain an interpolated ideal line at the requested boundaries. Access-sync events now clear protected data while retaining mounted query observers and refetching them; removing those queries previously stranded the dashboard in its loading state despite successful responses. Nine focused web tests, eleven PostgreSQL cases and three reporting unit tests passed after these corrections. The subsequent CI run exposed an incomplete upstream WebSocket test double: its empty cache lacked `findAll`, so the access handler threw before reaching the existing assertions. The fixture now models that query-cache method without changing any assertions.

The iPhone 17 / iOS 27 preview verified the Insights navigation, current-cycle card, workspace-local dates, zero delivery totals and explicit missing duration history. A synthetic task was temporarily completed and restored for refresh verification, but the simulator control surface became unavailable before the pull gesture could be verified. Android and distribution builds were not exercised. Initial local unit timeouts passed on focused rerun and in CI; local workflow checks requiring localhost listeners passed all 48 tests with the appropriate execution permission. Only obsolete Tracing images and verified runtime-cache descendants were removed to recover local Docker space.

Phase 5 final verification: PR #6 was approved at `9dcb89aca8178ca14a36a80f0aa3bc511e5f8427` and merged as `e0045a7d8aba03cbb2fc788f8a40671e8aa86b9f`. Both the final PR run (43499758523) and post-merge run (43517308605) passed every Go Figure CI job. Returning to native Insights after a synthetic status change verified focus refresh; pull-to-refresh remains unverified. A read-only local rehearsal checked 48 reports across 16 imported cycles and 95 historical days without exposing aggregate-only history.

## Phase 6: Views

The `views` flag adds a paginated workspace issue API, filter choices, saved personal/shared views, personal favorites, and project issue templates. The additive migration creates only the design's `saved_view`, `favorite` and `task_template` tables; templates use the project/name composite key, and favorites use user/kind/target. No upstream table or migration changes.

Issue filters combine status category, priority, assignee, recorded creator, label, project, cycle, milestone, estimate, due/created/completed dates. Date comparisons use the workspace calendar. Unknown creation history stays null. Tasks are accepted, currently readable issues; label filtering does not multiply rows. Shared views whose filter expressions reference an inaccessible project or milestone are hidden intact, preserving both privacy and filter meaning. Personal views and favorites can be organized by viewer-role sessions; API-key mutations additionally require `project:update`, so read-only keys remain read-only. Shared views and templates require `project:update`; administrators can edit shared views but cannot privatize another member's view.

Web adds All issues with list/board layouts, rich filters, grouping, ordering and visible properties; saved views retain filters/display, while search is temporary. Favorites support all five designed target kinds and reorder only the current workspace's visible entries. Template management and the create dialog preserve title, description and default properties. Pending triage creation stores a validated estimate atomically. Normal upstream task creation applies its estimate afterward; failure reports that the issue already exists and never retries creation.

Mobile opens saved views as read-only task lists. The current upstream mobile board already includes a list toggle, contrary to the design's inventory, so it is reused. New navigation shortcuts are `g t`, `g c`, `g r`, `g v`; `Shift+M` opens the milestone picker. The shared MCP catalog adds `list_saved_views` and `list_workspace_tasks` to HTTP and stdio without requiring a new hosted service. Expo SDK 58 Router docs were checked before native changes.

### Phase 6 shared-file register

| File | Change and reason |
| --- | --- |
| `apps/web/src/components/nav-main.tsx` | Add Views and place planning navigation in the designed order. |
| `apps/web/src/components/app-sidebar.tsx` | Mount the owned Favorites section before the project list. |
| `apps/web/src/components/shared/modals/create-task-modal.tsx` | Mount the owned template picker; apply template fields and preserve estimate defaults during creation. |
| `apps/web/src/components/activity/comment-editor.tsx` and its Markdown regression test | Suppress content updates when setting editability, so hydration of a new editor cannot clear a template's description. |
| `apps/web/src/components/shortcuts/global-shortcuts.tsx` | Mount the owned planning navigation shortcuts. |
| `apps/web/src/lib/shortcuts/catalog.ts`, `apps/web/src/components/task/task-action-target.ts` | Register four navigation bindings and the milestone action. |
| `apps/web/src/routeTree.gen.ts` | Generated workspace issue, view and template routes. |
| `apps/mobile/src/app/(app)/index.tsx` | Show More when Views is enabled independently of the other planning features. |
| `packages/mcp/src/tools/register.ts` | Register the two view tools once for both transports. |
| `apps/docs/openapi.json` | Generated Views contracts and optional member-triage estimate. |
| `i18n/en-US.json`, the 20 other catalogs, `i18n/schema.json` | Web/native Views copy and shortcut labels, using English fallback for new keys. Add only the owned branches and the previously missing shortcut catalog to the schema. |
| `tests/e2e/compose.parity.yml`, `tests/e2e/smoke.spec.ts` | Enable Views on the disposable parity stack and verify absence with features disabled; observe flags before shortcuts preload them during onboarding. |
| `tests/e2e/parity-planning.parity.ts` | Exercise the new Shift+M milestone picker and scope retry to the initiative error, preserving the original persistence and access assertions. |

All other feature changes stay in owned parity modules, new route files, additive migrations and tests. Verification is ongoing; no deployment, paid activation, production import or distribution upload is included.

### Phase 6 verification

The focused PostgreSQL suite passed 17 tests across seven files, covering migrations, workspace filtering, shared/personal visibility, hidden filter references, API-key write restrictions, templates, favorites and atomic triage estimates. The complete workspace unit run passed 5,307 tests before the final editor correction; the final focused web run passed 18 tests, including the regression that first reproduced the empty hydration update. The final full web rerun passed all 401 files / 2,042 tests with two workers and unchanged assertions/timeouts. All 22 workspace typecheck/build tasks passed, as did the final web/mobile typechecks, lint, all 21 localization catalogs and generated OpenAPI checks. Workflow/security controls passed 176 tests and the browser-security harness passed 53. The complete PostgreSQL suite passed all 218 files / 2,322 tests, with three inherited skips. PR CI is pending.

All nine parity browser flows passed across the initial and focused corrected runs. The new Views flow covers filters, stored display, shared views, favorites, template creation/application, description and estimate persistence, navigation shortcuts and access-error recovery. The existing planning flow now covers Shift+M and clearing the milestone. All three feature-off upstream browser flows passed across the full and corrected smoke runs. The smoke response observer now starts before global shortcuts preload feature flags. Resource contention caused an initial cycle timeout and unrelated web unit timeouts; the unchanged cycle assertions passed after reducing concurrent work.

The iPhone 17 / iOS 27 simulator verified More → Views, a shared view, task navigation, All issues, focus-refresh failure hiding cached content, and retry recovery. It also verified the existing native board/list toggle, which the design inventory had missed. Pull-to-refresh was attempted but its effect was not verified; Android and distribution builds were not exercised. A local-only Linear rehearsal checked filter metadata for 27 projects and 25 milestones and a personal saved-view round trip. A second authorized rehearsal copied title, description and priority from 20 Go Figure issues into a separate local workspace with seven project groups; all 12 project/priority filter comparisons and a personal saved-view round trip passed. This was a sample test, not a historical import. Private source records and session data remain outside the repository.

The first PR run passed quality/contracts, workspace units and all four PostgreSQL shards. Eight parity browser flows passed; the Views flow exposed a second editor lifecycle race. When content and editor dependencies changed together, hydration could call commands on the destroyed previous instance. A new regression reproduced the same exception before the fix. Hydration and editability effects now skip destroyed instances, allowing the replacement to receive the current value.

Review fixes apply shared-view reference privacy to owners as well as other readers, serialize raw PostgreSQL timestamp expressions as ISO instants, and enforce the same 6,000-character URL-encoded filter limit in saved views, task execution, web and MCP. This leaves space for the rest of a request within the bundled proxy's request-line limit. Estimate filters reject fractional, negative and oversized values before requests or saves. Deleted favorite targets are excluded before the list limit and reclaimed transactionally when adding a favorite; existence checks never treat revoked access, archival or disabled features as deletion. This keeps cleanup in owned code without changing upstream deletion controllers.

Template names are encoded as individual path segments, and template application selects each label name once, preferring its workspace row. Saved-view requests capture their submitted filters/display and preserve any edits made while saving or refreshing. A dialog settings change explicitly resets browser drafts; renaming and background refreshes do not. Regression coverage includes both save timing windows, draft resets, reserved URL characters, duplicate labels, shared-view ownership, dead favorite capacity and unnormalized timestamp wire values. All 22 workspace typecheck/build tasks passed again; focused checks passed 26 web tests, three schema tests, two MCP tests and all 12 affected PostgreSQL cases across the initial and corrected-fixture runs. The editor-only full web rerun passed 2,043 tests before these additional review fixes.

The final review-fix web run passed all 403 files / 2,050 tests. A fresh Docker build passed all nine parity browser flows together, including editing and deleting a template containing reserved URL characters while retaining a similarly named template. All three feature-off browser flows also passed together. Final lint, formatting, all 21 localization catalogs and regenerated OpenAPI passed. A further native check restored and reopened the shared view after removing the local failure injection; pull-to-refresh remains unverified.

Phase 6 final verification: PR #7 was approved at `6daa009be2c32626db217934ec4b7892316f976e` with zero unresolved threads and all nine checks passing. It merged as `8e724a689696ceb0528c1d93ff131322e392d7c6`. Final PR CI (43529486248) and post-merge main CI (43530398795) both passed every Go Figure job.

## Phase 7: Linear import

The owned adapter extends the existing import flow under `PARITY_FEATURES=import`. Discovery lists actual Linear projects and a catch-all per team. The upstream team importer remains the feature-off path. New source types and planning writers stay under `apps/api/src/parity/import`; no database-model or migration change is required. Source credentials continue through the existing guarded fetch, redaction, in-memory background job and permission checks.

Read-only preflight verified the current public GraphQL schema and inspected 241 authorized Go Figure issues in a private local export. Original identifiers need an explicit search predicate in addition to external links. Cycle history cannot supply a permission-safe per-project breakdown, so the import preserves cycles and membership without inventing chart history. Production import, cutover, deployment and paid activation remain separate approval steps.

### Phase 7 shared-file register

| File | Change and reason |
| --- | --- |
| `packages/importers/package.json`, `packages/importers/src/linear/index.ts` | Export the existing Linear HTTP transport and its types for the owned adapter. |
| `apps/api/src/import/source/open-import-source.ts` | Select the owned source/writer behind the import flag, retaining guarded fetch and secret redaction. |
| `apps/api/src/import/run-import-job.ts` | Invoke optional project writer and final relation-linking hook within the existing job/progress lifecycle. |
| `apps/api/src/import/writer/write-project-content.ts` | Expose task/column mappings to an optional callback inside the existing transaction. |
| `apps/api/src/import/writer/create-import-project.ts` | Accept an optional cancellation signal and check it after project placement, immediately before the transaction returns. |
| `apps/api/src/search/controllers/global-search.ts` | Mount the owned original-identifier predicate inside existing task access filters. |
| `apps/api/src/import/index.ts`, `apps/docs/openapi.json` | Describe feature-dependent discovery and imported planning data. |
| `apps/web/src/components/import/import-flow.tsx`, `import-source-picker.tsx` | Select the feature-aware project terminology and import explanation. |
| `apps/web/src/components/import/import-run-view.tsx`, `import-run-history-row.tsx` | Use stored source-ID prefixes to identify planning imports after the flag is disabled, and show a failed final linking stage without hiding successfully imported projects. |
| `i18n/en-US.json`, 20 other catalogs and `i18n/schema.json` | Add the two owned import explanations with the established English fallback. |
| `tests/e2e/compose.parity.yml` | Enable import and mount a test-only Linear HTTP fixture, guarded to the disposable browser database. Production images do not contain or load the fixture. |

All other changes remain in owned parity modules and tests. The upstream project table has no update timestamp, so that Linear field cannot be preserved there without an unapproved model addition; issue update timestamps are preserved.


The reader paginates every root and nested collection, includes archived records, reuses the existing guarded/retrying transport and rejects stalled pagination. Each project and its planning metadata commit together; a failed project leaves no partial destination project. Initiatives and cycles share run-scoped identifiers across projects. Cross-project subtask, blocking, related and duplicate links are added after successful projects commit, with warnings for links to unselected or failed projects. Cancellation is checked after reading and before the project transaction commits. A final linking failure leaves committed projects available and marks the run failed with a visible error.

Original identifiers are stored in `external_link` and searchable through global search and the workspace issue API, inside their existing access filters. Source people map only to existing destination members. Unmatched ownership and authorship remain unassigned; upstream comment display retains the external author name. Issue creation/update and lifecycle instants, available workflow spans, project dates, milestones, updates and cycle instants are preserved. Invalid required timestamps fail the project. Existing workspace settings are preserved; a new settings row takes the source team's timezone and estimate scale, keeps automatic cycles off, and warns about incompatible team settings. Colliding cycle numbers receive a free workspace number while their names retain the source team and number.

Past cycles without completion timestamps close at their scheduled end with an explicit warning, preventing imported work from being rolled forward automatically. No aggregate-only burndown, close summary or per-project history is invented. Archived completed/canceled issues retain their terminal category in reports; archived issues are excluded from current workload and rollover. Linear's proposed initiatives map to planned; canceled initiatives map to archived/planned with a warning. Archived milestones retain their contents as ordinary milestones because the approved model has no milestone archive state. Repeating the import creates another copy, as explained before starting it.

### Phase 7 verification

The full workspace unit verification passed 3,272 non-web tests and 404 web files / 2,052 tests. All 22 workspace typecheck/build tasks, formatting, lint, all 21 localization catalogs and generated OpenAPI checks passed. The 15 GraphQL queries were checked against the current public schema (290 field selections and 58 arguments); this is not authenticated live-source validation. Five reader/pagination unit cases and 26 initial PostgreSQL import/upstream cases passed. The expanded archive regression run passed all 53 tests across import, planning, Insights, Views and cycle scheduling. The complete PostgreSQL run passed all 218 upstream/existing files; its only two failures were newly added archive regressions encountered before their corrections were loaded. Both passed in the clean 53-test rerun and the final 13-test import rerun (2,337 passing cases across the corrected runs, three inherited skips). PR CI will verify the final commit from a clean checkout.

The bundled image passed all ten parity browser flows and all three feature-off upstream flows. Import covers project discovery, catch-all selection, real background persistence through a test-only HTTP fixture, reload, original-ID search, initiative and triage visibility, project navigation, and a visible final-stage error. The synthetic Linear fixture is mounted only by the disposable parity Compose overlay; it is absent from production images. All 53 browser-security checks passed. Workflow/release/security verification passed 174 tests initially; the two nginx checks affected by local Docker disk exhaustion passed unchanged after reclaiming only obsolete Tracing verification images and their build cache.

The private local rehearsal ran 241 authorized Go Figure issues through the actual reader and writer: 27 projects plus one catch-all, four initiatives, 25 milestones, 16 cycles, 36 archived issues, 528 workflow spans, and 11 relationships including two duplicate links. Every issue's title, description, known creation/update/lifecycle instants, numeric estimate, cycle and milestone reference was compared with the export. Exact cycle numbers and start/end instants were checked. A second read-only API comparison verified all 241 paginated issues, counts for 27 project plans, 16 cycles and four initiatives, and 20 original-identifier searches. The iPhone 17 / iOS 27 simulator verified the imported project list, original-identifier search, navigation to the matching issue under its new project ID, cycle assignment, original Linear link and historical activity. No native implementation change was necessary.

This rehearsal uses connector exports through a private local GraphQL fixture, not a live personal API key. Team timezone/estimate configuration, project health, milestone/cycle creation timestamps, comments/updates, person email matching and workflow display order were unavailable in those exports; synthetic tests cover those paths, and the rehearsal does not claim to validate their real source values. Private records, scripts and credentials remain outside the repository and CI. Production cutover, Railway changes, distribution uploads and paid Manufact activation are not included.

The initial PR CI run (43538165893) passed every job from a clean checkout: 5,324 workspace unit tests, 2,337 PostgreSQL cases with three inherited skips, all ten parity browser flows and all three feature-off flows. Review corrections reduce nested discovery pages to fit Linear's documented complexity limit, clear a failed workspace-read promise so later projects can retry, sort initiative-project numeric strings numerically, check cancellation after project placement, acquire the scheduler's advisory lock before settings/cycle writes, and rank exact original identifiers ahead of incidental text matches. Regression tests cover recovery and successful cache reuse, later nested pages, differing order digit lengths, complete rollback including settings, cancellation during placement, concurrent cycle allocation and a one-result search with competing text matches. The two new non-English keys retain the documented English fallback used by earlier phases.

Review-fix verification passed nine focused unit tests, 38 PostgreSQL cases across the affected import/cycle/search suites and the corrected search-fixture rerun, all 22 workspace typecheck/build tasks, formatting and lint. All 15 queries still validate against the public schema; a conservative static complexity estimate is below 10,000 for each query (the largest is 7,259). Authenticated live-source validation remains separate.


## Railway cutover build compatibility

The bundled and standalone API/web Docker builds use `vp run --no-cache build`.
This keeps the existing task dependency graph while disabling Vite+ task caching
and process/file tracking inside the container build. Docker layers already cache
these outputs. Railway's builder failed before compilation with `Resource busy
(os error 16)` when Vite+ tried to spawn cache-tracked TypeScript tasks; local
development and GitHub task caching retain their existing configuration.

Shared-file register: `Dockerfile.tracing`, `apps/api/Dockerfile` and
`apps/web/Dockerfile` change only their build invocation and its explanation.
No runtime configuration, application behavior or database model changes.

## Live Linear saved-view compatibility

The authorized live cutover found saved views using exact workflow names,
initiative membership, and the currently active cycle. Views now support these
three filter clauses without new tables or migrations. Exact names distinguish
states with the same category. Initiative predicates follow current project
membership, and the current-cycle predicate evaluates the start-inclusive,
end-exclusive interval on each request. Exclusions include issues without a
cycle or initiative. Existing task/project visibility conditions remain in force;
initiative references must belong to the current workspace. Native views pass
these saved filters through to the same API.

The filter builder exposes the new choices and keeps imported state names
readable when an option is no longer present. Shared-file changes are limited to
`apps/docs/openapi.json`, the three source locale keys and their 20 translated
catalog entries, and the corresponding entries in `i18n/schema.json`. Other
changes stay in the owned Views modules and their tests.

Archived issues resolve their last recorded workflow slug against columns in
their own project for exact-state filters. Missing/deleted states fall back to
the archive status; filtering never restores or moves an archived issue.

Saved display preferences can opt into archived projects. The default remains
active projects; the opt-in keeps workspace activity and per-project access
checks, and is forwarded by both web and mobile. This preserves Linear views
that explicitly include archived items without restoring those projects.

The live export also contains already-qualified grouped label names. The import
mapper adds a group prefix only when absent, preserving both Linear shapes.


## Tracing rebrand

The user authorized renaming the fork across application copy, email, native
identity, repository links, workspace package names, CLI, MCP, docs, and
deployment artifacts. This crosses the original shared-file boundaries; it
does not alter database models or rewrite existing imported records.

`TRACING_*` server and client settings take precedence over legacy `KANEO_*`
aliases. Existing CLI repository links and stored logins remain readable, and
MCP sign-out clears both credential locations. Mobile accepts both URL schemes;
the approval page chooses only the two fixed schemes and preserves old clients.
Headers, cookies, storage formats, import provider IDs, migrations and licenses
retain their compatibility identifiers. See `BRANDING.md`.

Docker and Helm examples build this fork rather than pulling an upstream image.
The active CI accepts both repository names during the rename and builds
`Dockerfile.tracing`. Renamed CLI/MCP packages are private workspace packages;
no npm, container, chart, Homebrew, or app-store publication is claimed.
Upstream analytics scripts and inherited commercial-plan claims were removed
from the app and primary website pages. Changed marketing copy uses the existing
English fallback in translated catalogs until native translations are supplied.


The Tracing rename is delivered as five dependent PRs so each stays within the
review service file limit. Temporary workspace aliases keep intermediate PRs
buildable and are removed after consumers move. The UI review runner accepts
both package names because its base checkout can predate the rename.

Final rename audit: the Helm writable mount retains `/var/lib/kaneo`, matching
the runtime scripts. Existing Helm releases must preserve selectors, PVCs and
credentials using the documented name overrides. CLI/MCP/importer setup docs
use source builds because no Tracing registry artifacts have been published;
upstream drim and analytics are not presented as Tracing services.

## Planning UI comparison — November 2026

This UI-only pass uses the signed-in Go Figure Linear web application and the actual Linear iOS app on the maintainer's mirrored iPhone. Linear was read-only; mutations were exercised in a disposable local Tracing workspace. Existing production/imported records, planning semantics, permission checks and chart history are unchanged.

| Surface | Observed reference | Implemented web change |
| --- | --- | --- |
| Projects | Compact aligned rows; display menu with grouping, ordering and properties; overview/issues navigation | One aligned table, status and priority glyphs, name/slug/lead search, status filter, grouping by status or lead, ordering and property visibility. Collection controls load all authorized pages before reporting an empty result. |
| Project overview | Title and description in the main column, compact metadata, initiative links, milestones, updates and supporting progress | Narrower properties rail, shared Overview/Issues navigation, links back to authorized initiatives via the existing roadmap endpoint, simpler milestone rows. |
| Initiatives | Active/planned/all views; compact collection; overview followed by projects grouped by status | Status views and search, denser list, consistent detail hierarchy, grouped shared project table and retained add/remove actions. Reordering stays available only on the complete unfiltered collection. |
| Cycles | Web issue list beside dates, chart and statistics; filter/display controls. Native cycle detail opens into grouped issues. | Issues occupy the main column; dates, progress and genuine burndown history move to a supporting rail. Compact navigation, rows and a filter popover with active count and clear action. Narrow layouts stack the summary above issues. |
| Native reference | Grouped project rows; project Overview/Activity/Issues tabs; wrapping property chips; status selection sheet; initiative Overview/Activity/Projects; current/upcoming/past cycle list | Mobile implementation follows in a separate focused change. |

Reference coverage: Linear web project collection/display menu, project overview, initiative list/detail, cycle list/detail/display menu; Linear iOS project list/overview/issues, status picker without selection, initiative overview/projects, teams/cycles list, and Cycle 14 issue list. The maintainer demonstrated the last cycle screen when Mirroring clicks stopped working. Installed Tracing home was captured on the same physical phone. Native dark appearance, swipe-back, creation submission, restricted records and mutation outcomes were **not** observed in Linear. Those are validation/implementation choices, not reference claims.

Deliberate differences: Tracing retains its branding, board/backlog views, update editor, existing permission-gated property dialogs and extra cycle statistics. Linear's manual project order, project resource model, capacity forecast and unavailable historical chart points are not fabricated. New project display settings are local to the mounted view. Project-to-initiative links require the roadmap feature and disappear on failed authorization/refetch.

Shared edits in this web slice: five copy keys in `i18n/en-US.json`, with translations in the other 20 catalogs; no shared application modules, API routes or schemas changed. Parity components and their behavioral tests stay within the fork boundary. Local comparison screenshots are retained in `../tracing-ui-evidence/` (reference, baseline and updated images); no private Linear screenshots are published to the repository.

Web validation for this slice: all 2,055 web unit/component tests passed; the final planning/cycle subset passed 35 tests after chart sizing adjustments. Repository lint/format, repository type checks, locale synchronization, production web compilation and OpenAPI consistency passed. The browser exercised search/status/group/order, Escape dismissal, property save and reversal, project-to-initiative navigation, linked-project removal/addition with progress recalculation, cycle filters/clear/grouping, issue navigation, and cycle unassign/reassign on disposable records. Desktop comparisons use 1440×1000; the responsive cycle view was checked at 430×932 and both web appearances were observed. Production release verification is recorded after the final merged revision is deployed.

### Native planning UI slice

The native implementation follows the independently observed iOS hierarchy: compact status-grouped project and initiative rows, horizontal detail tabs, wrapping property chips, and direct status sheets. Projects now have a dedicated searchable collection with priority/date/progress ordering and creation, reached from Home or More. Initiatives expose their attached projects on a separate tab, with authorized add/remove actions using the existing endpoints. Cycles offer All/Current/Upcoming/Past sections and open on issues; Overview retains genuine history, progress and statistics. Filters collapse on small screens and retain their current values when switching to the cycle overview.

Shared edit register: `apps/mobile/src/features/home/home-tab.tsx` adds a link to the planning collection; `apps/mobile/src/app/(app)/projects.tsx` is a thin Expo route. Six native catalog keys were added and translated in all 21 catalogs. All other native changes stay under `features/parity`. The existing EAS editor post-install hook, production server, signing identity, API authorization and generated native folders are unchanged. The local simulator's native project was generated in an isolated temporary copy.

Deliberate native differences: Updates is named for Tracing's existing status-update feed rather than implying Linear's full Activity history. Issues opens the existing board so task management remains available. Archived projects remain accessible through Home. Property fields other than status retain the existing editor, and milestone editing remains a web capability. Native resources, customer tabs and fabricated capacity/history are not added. Linear native dark mode and gestures remain unobserved reference states.

Native validation: all 158 unit tests across 27 files, all 22 repository typecheck/build tasks, lint/format and all locale checks pass. iOS and Android production JavaScript exports pass. The isolated Tracing UI QA iOS simulator exercised Home-to-Projects navigation, search, status filtering, priority ordering, status change/reversal, project-to-initiative navigation, project unlink/relink, cycle issue/overview tabs, project filtering, clear filters, grouping and filter persistence across tabs. Project creation was checked with the software keyboard and backdrop dismissal; project-to-board/back and current/upcoming/past cycle navigation passed. Before/after screenshots use the same disposable local workspace; no production/Linear records are changed. The maintainer authorized Maestro after native computer-use clicks failed. Review fixes make pull-to-refresh reload the active update feed and project initiative links, with the indicator covering dependent requests; the active filter count uses the current locale. Physical-device coverage is reference/baseline observation only, and Android coverage is compilation and shared logic rather than emulator interaction.

Web release: PR #18 merged at `c42c053649794a62db71ebb46cfc224e3dd7b135` after all eight CI jobs passed on `4101ae4c8ad260580b63cc6edecee419b70799b1`. Verified review fixes include accessible cycle priorities and translated labels. Railway deployment `84fc29f3-8d12-459a-ba3a-3b88572ad8c5` is successful, pinned to the merge revision. Production health, project collection/search, project overview and initiative navigation were verified without changing records.


## Planning MCP completion — November 16, 2026

The shared HTTP/stdio registry adds 14 tools: milestone create/update/delete and task get/assign/clear; initiative update (including archive/restore), delete, reorder and project unlink; status-update listing; cycle settings get/update, cycle editing and filtered cycle-task listing. Initiative creation now includes its existing icon/color fields. Existing tool names remain compatible. Descriptions explain null clearing, pagination, required permissions, deletion effects and cycle cadence semantics.

This exposes the existing planning APIs without new domain models, routes, migrations or permission changes. Cycles remain automatically generated and closed: the settings tool controls cadence/lookahead, and edits respect current/past date immutability and overlap validation. Manual cycle creation/deletion and status-update edit/delete remain absent because the API has no such operations. Reusable MCP validation and domain registrars live under `packages/mcp/src/tools/parity`; docs cover the Claude connection and complete planning catalog.

Validation: 105 MCP unit tests, 34 hosted MCP protocol/tool tests and three PostgreSQL integration scenarios passed. Modern and legacy HTTP discovery both advertise the 14 new tools. The new integration suite calls the shared tool registry through actual API routes against disposable PostgreSQL, covering lifecycle reversals, hidden projects, denied archive/settings/delete operations, pagination, null/false preservation and issue retention after milestone/initiative deletion. No production/Linear mutations are used for validation.

## Project navigation comparison — November 16, 2026

A second signed-in Linear reference pass covered the desktop sidebar, project collection Display menu, project Overview/Activity/Issues navigation, details rail and project actions. Tracing now groups personal links, favorites, workspace planning and active-work links in collapsible sidebar sections, with a header issue composer and always-visible Current/Upcoming cycle links. Section expansion and project-details visibility persist for the browser session. The account menu moves to the footer; settings retain Tracing's existing screens and navigation.

Projects use compact rows with truthful no-update health, issue counts, status/progress indicators, sortable headings, a compact status filter and List/Board display modes. Cards and rows expose single-field status/priority/lead/date edits; member queries are lazy, null clearing is explicit, writes use existing API permissions and cache invalidation. Project Overview, Updates and Issues share navigation and a collapsible properties/milestones/progress rail. On narrow screens the rail replaces the main pane while open. Home project cards open Overview when planning is enabled; existing issue layouts and backlog remain reachable. The disabled-planning sidebar and project navigation retain their original behavior.

Deliberate differences (updated by Teams core): organizing teams are available behind `teams`; private teams and team-scoped cycles remain future phases. Tracing has no Reviews, Agent, Loops, project resources/customers, or full project activity feed. The existing status-update feed is labeled Updates. Board grouping follows project status; drag ordering and a project Timeline control are not implied. Roadmap remains the existing timeline surface. No domain model, permissions, schema, settings design, mobile code or distribution build changes are included.

Shared edit register: `components/app-sidebar.tsx` and `workspace-switcher.tsx` mount the optional planning sidebar/composer; `components/common/project-layout.tsx` mounts shared tabs/details, with its access-state tests updated; `components/home/home-projects.tsx` selects the planning landing page. The new Updates route and generated `routeTree.gen.ts` register that page. Nine copy keys are synchronized in all 21 locale catalogs, reusing existing translated date/issue labels. All other components and tests remain under `components/parity`.

Validation: all 2,064 web tests, repository typechecks (22 tasks), lint/format, locale synchronization, OpenAPI consistency and production web compilation passed. Behavior tests cover permission-gated edits, one-field patches, explicit clearing, lazy member loading, visible failures, accessible section collapse, disabled planning, current project tabs and details visibility. Browser checks on disposable local data covered status change/reversal, lead unassign/reassign, date clear/restore, filter/search, priority order, List/Board, favorites reversal, sidebar composer/dismissal, tab navigation and mobile cycle navigation. Desktop widths 1280 and 1440 and a 430×932 narrow viewport were inspected; light and dark appearances are captured in `../tracing-navigation-evidence/`. Linear and production data were not changed.

Review follow-up: pending property saves stay locked through attempted dismissal, workspace changes restore the correct details preference, compact leads display initials, and board issue counts and completion progress can be shown independently. Property inputs have explicit accessible labels. Two additional regression tests and the existing focused layout/property tests pass (12 total); typechecks, lint, all 21 locales and the web build were rechecked. The CI browser flows now exercise the inline editors, project tabs, board regrouping/reversal and collection-based project navigation.

## Teams core — Phase B implementation, November 17, 2026

The maintainer approved the Phase A model and PR split, including the extension's
workspace foreign key. Delivery is sequential: #22 design, #23 Expo owner, and
#24 native glass navigation were each approved on their final commit, passed all
nine checks, and merged before this core work resumed. This is the next single
PR. Phase C's proposal above remains awaiting separate implementation approval.

Owned Teams modules reuse Better Auth identity/membership and add migration
`0005_teams.sql`, `team_ext`, and nullable `project_ext.team_id`. Keys are unique
per workspace, including archived teams. Workspace locks serialize provisioning,
key/limit checks, membership, deletion and assignment. Default and legacy teams
receive extensions idempotently. Existing projects remain unassigned. Deletion
clears session/invitation references and project ownership through `SET NULL`;
it never deletes a project or task. Team endpoints require actual workspace
membership even for an instance administrator. Existing team permission statements
and editable roles remain authoritative. Leads can change membership, with an
additional `team:update` scope requirement for API keys.

Raw auth team mutations and indirect invitation enrollment are blocked only with
Teams enabled. Old team-bearing invitations must be reissued without a team.
Workspace member removal reconciles memberships, leads and cached counts. Project
moves ignore stale assignments immediately, reconcile them through the existing
project event and refetch authorized counts in both affected workspaces. Events carry only type/workspace hints. Web/mobile refetch their
existing parity query namespace, including derived issue/project/view collections;
Redis stays optional.

A single source Linear team is reused or created without merging members. The
imported identity uses a stable workspace/source-team ID, so later runs and key
fallbacks reuse it. Ambiguous multi-team ownership, archived matches or the limit
retain No team with a warning. Unavailable keys receive a deterministic free key.
Team issue pages retain the fixed team clause when saving a view copy. MCP exposes
ten Teams tools in the shared HTTP/stdio registry; filtered project listings are
paginated active planning collections and keep the unfiltered legacy contract.

### Shared-file register

- `apps/api/src/database/schema-parity.ts`, `apps/api/drizzle-parity/0005_teams.sql`
  and its journal/snapshot: additive owned data only; inline named foreign keys
  match the generated snapshot. Upstream schema/migrations are untouched.
- `apps/api/src/import/writer/create-import-project.ts`: acquires the existing
  workspace advisory lock before inserting a project, avoiding foreign-key lock
  upgrade deadlocks during concurrent planning imports.
- `apps/api/src/project/controllers/move-project.ts`: invokes the owned team-clear
  helper in the move transaction and publishes refetch hints to both workspaces
  after commit, so rapid round trips cannot retain an old assignment.
- `apps/api/src/auth.ts`: mounts the owned before guard and workspace lifecycle
  hooks. `apps/api/src/index.ts`: initializes provisioning after migrations.
- `apps/api/src/parity/index.ts`, `foundation/features.ts` and
  `foundation/workspace-events.ts`: route, feature dependencies and hint types.
- `apps/api/src/parity/planning/{schema,project-read,project-write,initiative-read}.ts`
  and `routes/{projects,initiatives}.ts`: optional assignment and authorized filters.
  `parity/roadmap/{index,read}.ts`: team timeline filter.
- `apps/api/src/parity/views/{schema,task-filters,task-read,filter-access,options,task-routes}.ts`:
  derived team filters, validated references, optional choices and feature-off
  rejection. Saved filters referencing disabled teams are hidden intact.
- `apps/api/src/parity/import/write-project.ts`: owned import team assignment and
  post-commit refetch hint.
- `apps/web/src/components/app-sidebar.tsx`: mounts owned team navigation.
  `components/settings/nav/use-settings-nav.ts`: feature-gated Settings → Teams.
  New thin workspace/settings routes and generated `routeTree.gen.ts` mount pages.
- `apps/web/src/components/parity/planning/{queries,projects-page,project-details,projects-table,initiative-detail}.tsx`
  (queries is `.ts`): Teams flag, collection filters and owned project picker.
  The table minimum width now accounts for its actual fixed column widths so
  narrow layouts scroll without compressing the name and picker.
- `apps/web/src/components/parity/views/{display,filter-builder,filter-values,issues-browser}`:
  gated team options and fixed team issue browsing/saved copies.
  `components/parity/roadmap/roadmap-page.tsx`: timeline Team filter.
  `components/parity/foundation/workspace-events.ts`: hint invalidation.
- `apps/web/src/fetchers/parity/{projects,initiatives,roadmap}.ts`: typed optional
  filters; owned `teams.ts` uses the existing typed Hono client.
- `apps/mobile/src/features/parity/planning/{queries,types,api,more-tab,project-overview}`:
  Teams flag/types/entry and owned overview picker. `views/{api,issues-list}`:
  fixed team issues. `foundation/workspace-events.ts`: refetch hints. New thin
  collection/detail routes mount owned Teams screens without native dependencies.
- `packages/mcp/src/tools/register.ts` and `tools/parity/{views,view-filters}.ts`:
  shared Teams registration and bounded nullable filters. New `teams.ts` owns tools.
- `i18n/en-US.json` and all twenty translated catalogs:
  Teams copy and synchronized mobile/filter keys.
- `apps/docs/openapi.json`, `core/integrations/mcp.mdx` and
  `core/migrations/from-linear.mdx`: generated contract and public behavior.
- `tests/e2e/compose.parity.yml`: Teams enabled only in the disposable parity stack.
  `tests/api-integration/parity-migrations.test.ts`: six-entry ledger and new owned
  table assertion. New Teams integration/browser tests and adjacent unit tests
  cover privacy, permissions, key allocation, provider guards and reverse actions.

### Verification

| Check | Result |
| --- | --- |
| Root lint/format and complete types/build graph | Clean; 22/22 tasks passed on final source. |
| All workspace unit suites | Passed with `pnpm -r --workspace-concurrency=1 test`, including API 1,687, web 2,067, mobile 159 and MCP 107. |
| Full disposable PostgreSQL run | 2,361 passed, three skipped; the old five-entry ledger expectation was the only failure. Corrected and covered by the fresh migration rehearsal below. |
| Teams API, real auth, API keys, import, MCP privacy and project moves | Focused reruns passed: 11 core, four auth, three import tests. Includes viewer/member/admin, read-only keys, encoded/trailing/bearer bypass attempts and native workspace leave. |
| Fresh migration rehearsal | Passed on a new upstream-shaped database, with concurrent/repeated startup, upstream schema preserved, six parity ledger entries and assignment/lead indexes. |
| Parity Playwright configuration | All 12 passed, including second-page actual user sockets and synthetic Linear import. Final Teams delete-navigation flow also passed after its correction. |
| Feature-off upstream Playwright configuration | All three passed on a separate freshly migrated local database. |
| Browser visual checks | 1280, 1440 and 430 widths inspected in actual light/dark themes; narrow project table keeps the team picker readable and scrolls horizontally. |
| iOS 27 simulator | More → Teams, team issues/projects, project overview clear/reassign passed. No physical device or older iOS runtime tested. |
| Locales and OpenAPI | All 21 catalogs synchronized; generated contract current. |
| iOS release export | Passed with `--platform ios --clear`, owner `tracing`, the supplied project ID and production URL; temporary QA source override removed. |

A new web cache test initially omitted the workspace hint required by the real
message contract; its corrected fixture passes. Two unchanged five-second API
tests timed out under concurrent export/browser load; all sequential suites passed
without timeout changes. Disposable preview setup required its local API URL,
no external CAPTCHA key, and socket-close handling. A stale Metro transformer
reference to the previous worktree was removed by a clean-cache export. Native
QA used paced input, dismissed the system password-save prompt and matched the
controls' actual combined accessibility labels. These setup/selector failures
are not counted as successful checks.

Production flags, Railway, production data and store submission are outside this
slice. The final requested EAS artifact is iOS only, from `@tracing/tracing` and
project `4dfa905a-804d-4710-a412-559fc4428e21`, after this PR is approved, green
and merged. No Android app, keystore or build is created.

The first Teams review found nine valid recovery/concurrency issues. Follow-up
changes isolate team-hook failures from access revocation, lock imports before
project insertion, clear assignments inside workspace moves, reapply team filters
when reading summaries, and keep stale-filter recovery available even after the
conservative global 404 cache clear. Assignment retry resubmits the failed value;
roadmap filters retain supported selections and clear unavailable ones; icon input
matches the API's 100-character bound. The legacy invite test now authenticates the
actual invitee and checks the owned rejection code. The issue-filter browser proof
excludes both an unassigned-project issue and another team's issue.

Follow-up verification: all workspace unit suites passed (API 1,687, web 2,068,
mobile 159, MCP 107), all 22 focused Teams/auth/import PostgreSQL tests passed,
and the expanded Teams browser flow passed, including a synthetic failed
assignment/retry and deletion recovery in another browser. Root types/build graph
and lint/format passed again. No production flags or deployment were changed.

A final review additionally covered flag toggling: move cleanup always clears a
stored assignment, including while Teams is disabled, so an A→B→A round trip
cannot resurrect it after re-enabling the feature. Both flag states pass the real
controller regression; all fourteen core Teams integration tests pass.
