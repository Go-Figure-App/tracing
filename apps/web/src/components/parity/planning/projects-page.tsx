import { uniquePageItems } from "./unique-page-items";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Filter, Import, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TrialExpiredCallout } from "@/components/billing/trial-expired-callout";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import { Button } from "@/components/ui/button";
import { getProjectPlans } from "@/fetchers/parity/projects";
import { useCanImport } from "@/hooks/use-can-import";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { projectStatuses, usePlanningLabels } from "./labels";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ProjectsBoard } from "./projects-board";
import { ProjectsTable } from "./projects-table";
import { ProjectDisplayOptions } from "./project-display-options";
import {
  defaultProjectColumns,
  selectProjects,
  type ProjectColumn,
  type ProjectGrouping,
  type ProjectOrder,
} from "./project-collection";

export function PlanningProjectsPage({ workspaceId }: { workspaceId: string }) {
  const { t, i18n } = useTranslation();
  const labels = usePlanningLabels();
  const { canCreateProjects } = useWorkspacePermission();
  const { canImport } = useCanImport();
  const [creating, setCreating] = useState(false);
  const [groupBy, setGroupBy] = useState<ProjectGrouping>("none");
  const [orderBy, setOrderBy] = useState<ProjectOrder>("name");
  const [columns, setColumns] = useState<ProjectColumn[]>(
    defaultProjectColumns,
  );
  const [layout, setLayout] = useState<"list" | "board">("list");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["parity", "project-plans", workspaceId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getProjectPlans(workspaceId, pageParam),
    getNextPageParam: (page) => (page.hasMore ? page.page + 1 : undefined),
  });
  // Collection controls must include every authorized page, not only the first.
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetching && !isError) void fetchNextPage();
  }, [hasNextPage, isFetching, isError, fetchNextPage]);
  const projects = query.isError ? [] : uniquePageItems(query.data?.pages);
  const visibleProjects = selectProjects(
    projects,
    search,
    status,
    orderBy,
    i18n.language,
  );
  return (
    <WorkspaceLayout
      title={t("parity:planning.projects")}
      headerActions={
        <>
          {canImport && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("settings:workspaceImport.entry.projectsEmpty")}
              title={t("settings:workspaceImport.entry.projectsEmpty")}
              render={<Link to="/dashboard/settings/workspace/import" />}
            >
              <Import aria-hidden="true" className="size-4 sm:hidden" />
              <span className="hidden sm:inline">
                {t("settings:workspaceImport.entry.projectsEmpty")}
              </span>
            </Button>
          )}
          {canCreateProjects() && (
            <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t("parity:planning.newProject")}
            </Button>
          )}
        </>
      }
    >
      <PageTitle title={t("parity:planning.projects")} />
      <TrialExpiredCallout workspaceId={workspaceId} className="m-4" />
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2">
          <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium">
            {t("parity:cycles.allProjects")}
          </span>
          <label className="ml-auto flex min-w-32 max-w-64 flex-1 items-center gap-2 rounded-md px-2 focus-within:ring-2 focus-within:ring-ring">
            <Search
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
            />
            <input
              aria-label={t("parity:planning.searchProjects")}
              placeholder={t("parity:planning.searchProjects")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-8 min-w-0 w-full bg-transparent text-xs outline-none"
            />
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("common:actions.filter")}
                aria-pressed={Boolean(status)}
              >
                <Filter className="size-3.5" />
                <span className="hidden sm:inline">
                  {status
                    ? labels.status[status as keyof typeof labels.status]
                    : t("common:actions.filter")}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 space-y-2 p-3">
              <label className="grid gap-2 text-xs">
                {t("parity:planning.status")}
                <select
                  aria-label={t("parity:planning.status")}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-8 max-w-40 rounded-md border border-border/60 bg-background px-2 text-xs"
                >
                  <option value="">{t("parity:planning.allStatuses")}</option>
                  {projectStatuses.map((value) => (
                    <option key={value} value={value}>
                      {labels.status[value]}
                    </option>
                  ))}
                </select>
              </label>
            </PopoverContent>
          </Popover>
          <ProjectDisplayOptions
            layout={layout}
            setLayout={setLayout}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            orderBy={orderBy}
            setOrderBy={setOrderBy}
            columns={columns}
            setColumns={setColumns}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto py-1">
          {query.isPending && (
            <p role="status">{t("parity:planning.loading")}</p>
          )}
          {query.error && (
            <div role="alert">
              {query.error.message}
              <Button variant="ghost" onClick={() => query.refetch()}>
                {t("parity:planning.retry")}
              </Button>
            </div>
          )}
          {!query.isPending &&
            !query.hasNextPage &&
            !query.error &&
            visibleProjects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("parity:planning.noProjects")}
              </p>
            )}
          {layout === "board" ? (
            <ProjectsBoard
              projects={visibleProjects}
              columns={columns}
              status={status}
            />
          ) : (
            <ProjectsTable
              orderBy={orderBy}
              onOrderChange={setOrderBy}
              projects={visibleProjects}
              groupBy={groupBy}
              columns={columns}
            />
          )}
          {!query.isError && query.hasNextPage && (
            <Button
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              {t("parity:planning.loadMore")}
            </Button>
          )}
        </div>
      </div>
      <CreateProjectModal
        open={creating}
        onClose={() => {
          setCreating(false);
          void query.refetch();
        }}
      />
    </WorkspaceLayout>
  );
}
