import { uniquePageItems } from "./unique-page-items";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Plus, Target, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
  getInitiatives,
  reorderInitiatives,
} from "@/fetchers/parity/initiatives";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { HealthBadge } from "./health-badge";
import { InitiativeEditor } from "./initiative-editor";
import { usePlanningLabels } from "./labels";
import { ProgressMeter } from "./progress-meter";
import { PlanningStatusIcon } from "./status-icon";
import { refreshPlanning, usePlanningEnabled } from "./queries";

export function InitiativesPage({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const labels = usePlanningLabels();
  const enabled = usePlanningEnabled("initiatives");
  const navigate = useNavigate();
  const client = useQueryClient();
  const { canUpdateProjects } = useWorkspacePermission();
  const [creating, setCreating] = useState(false);
  const [archived, setArchived] = useState(false);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["parity", "initiatives", workspaceId, archived],
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getInitiatives(workspaceId, pageParam, archived),
    getNextPageParam: (page) => (page.hasMore ? page.page + 1 : undefined),
  });
  // Collection controls must include every authorized page, not only the first.
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetching && !isError) void fetchNextPage();
  }, [hasNextPage, isFetching, isError, fetchNextPage]);
  const items = query.isError ? [] : uniquePageItems(query.data?.pages);
  const visibleItems = items.filter(
    (item) =>
      (status === "all" || item.status === status) &&
      item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const reorder = useMutation({
    mutationKey: ["parity"],
    mutationFn: ({ index, offset }: { index: number; offset: number }) => {
      const ids = items.map((item) => item.id);
      [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
      return reorderInitiatives(workspaceId, ids);
    },
    onSettled: () => refreshPlanning(client),
  });
  return (
    <WorkspaceLayout
      title={t("parity:planning.initiatives")}
      headerActions={
        enabled &&
        canUpdateProjects() && (
          <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {t("parity:planning.newInitiative")}
          </Button>
        )
      }
    >
      <PageTitle title={t("parity:planning.initiatives")} />
      <div className="h-full overflow-y-auto">
        {!enabled ? (
          <p>{t("parity:planning.unavailable")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2">
              <div
                aria-label={t("parity:planning.status")}
                className="flex gap-1"
              >
                {(["all", "active", "planned", "completed"] as const).map(
                  (value) => (
                    <Button
                      key={value}
                      variant="ghost"
                      size="sm"
                      className={`h-8 rounded-full px-3 text-xs ${status === value ? "bg-muted" : "text-muted-foreground"}`}
                      aria-pressed={status === value}
                      onClick={() => setStatus(value)}
                    >
                      {value === "all"
                        ? t("parity:planning.allInitiatives")
                        : labels.status[value]}
                    </Button>
                  ),
                )}
              </div>
              <label className="ml-auto flex min-w-32 max-w-56 flex-1 items-center gap-2 rounded-md px-2 focus-within:ring-2 focus-within:ring-ring">
                <Search
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground"
                />
                <input
                  aria-label={t("parity:planning.searchInitiatives")}
                  placeholder={t("parity:planning.searchInitiatives")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-8 min-w-0 w-full bg-transparent text-xs outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(event) => setArchived(event.target.checked)}
                />
                {t("parity:planning.showArchived")}
              </label>
            </div>
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
            {reorder.error && (
              <p role="alert" className="text-sm text-destructive">
                {reorder.error.message}
              </p>
            )}
            {!query.isPending &&
              !query.hasNextPage &&
              !query.error &&
              visibleItems.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("parity:planning.noInitiatives")}
                </p>
              )}
            <div className="divide-y divide-border/40">
              {visibleItems.map((initiative) => (
                <article
                  key={initiative.id}
                  className="group px-5 py-3 transition-colors hover:bg-accent/30 focus-within:bg-accent/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Link
                        to="/dashboard/workspace/$workspaceId/initiatives/$initiativeId"
                        params={{ workspaceId, initiativeId: initiative.id }}
                        className="flex items-center gap-2.5 rounded-sm text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Target
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="truncate">{initiative.name}</span>
                      </Link>
                      <div className="ml-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <PlanningStatusIcon status={initiative.status} />
                          {initiative.archivedAt
                            ? t("parity:planning.archived")
                            : labels.status[initiative.status]}
                        </span>
                        <span>
                          {initiative.ownerName ?? t("parity:planning.noOwner")}
                        </span>
                        <span>
                          {initiative.targetDate
                            ? formatDateMedium(
                                new Date(`${initiative.targetDate}T12:00:00`),
                              )
                            : t("parity:planning.noDate")}
                        </span>
                        <HealthBadge health={initiative.health} />
                      </div>
                    </div>
                    <div className="flex items-center gap-5">
                      <ProgressMeter progress={initiative.progress} compact />
                      {canUpdateProjects() &&
                        !archived &&
                        status === "all" &&
                        !search &&
                        !query.isError &&
                        !query.hasNextPage && (
                          <div className="flex">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("parity:planning.moveUp")}
                              disabled={
                                items.indexOf(initiative) === 0 ||
                                reorder.isPending
                              }
                              onClick={() =>
                                reorder.mutate({
                                  index: items.indexOf(initiative),
                                  offset: -1,
                                })
                              }
                            >
                              <ArrowUp className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("parity:planning.moveDown")}
                              disabled={
                                items.indexOf(initiative) ===
                                  items.length - 1 || reorder.isPending
                              }
                              onClick={() =>
                                reorder.mutate({
                                  index: items.indexOf(initiative),
                                  offset: 1,
                                })
                              }
                            >
                              <ArrowDown className="size-4" />
                            </Button>
                          </div>
                        )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!query.isError && query.hasNextPage && (
              <Button
                className="mt-5"
                variant="outline"
                disabled={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
              >
                {t("parity:planning.loadMore")}
              </Button>
            )}
          </>
        )}
      </div>
      {creating && (
        <InitiativeEditor
          workspaceId={workspaceId}
          onClose={() => setCreating(false)}
          onCreated={(initiativeId) =>
            navigate({
              to: "/dashboard/workspace/$workspaceId/initiatives/$initiativeId",
              params: { workspaceId, initiativeId },
            })
          }
        />
      )}
    </WorkspaceLayout>
  );
}
