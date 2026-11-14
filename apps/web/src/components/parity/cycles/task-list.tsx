import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PlanningStatusIcon } from "../planning/status-icon";
import { getPriorityIcon } from "@/lib/priority";
import { Button } from "@/components/ui/button";
import {
  getCycleTasks,
  type CycleSettings,
  type CycleTaskFilters,
} from "@/fetchers/parity/cycles";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { uniquePageItems } from "../planning/unique-page-items";
import { estimateLabel } from "./estimates";
import { groupCycleTasks, type CycleGroup } from "./group-tasks";
import { CycleTaskFiltersBar } from "./task-filters";

export function CycleTaskList({
  cycleId,
  workspaceId,
  settings,
  assigneeId,
  compact = false,
}: {
  cycleId: string;
  workspaceId: string;
  settings: CycleSettings;
  assigneeId?: string;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [filters, setFilters] = useState<CycleTaskFilters>({});
  const [groupBy, setGroupBy] = useState<CycleGroup>("state");
  const effective = { ...filters, ...(assigneeId ? { assigneeId } : {}) };
  const query = useInfiniteQuery({
    queryKey: ["parity", "cycle-tasks", cycleId, effective],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getCycleTasks(cycleId, pageParam, effective),
    getNextPageParam: (page) => (page.hasMore ? page.page + 1 : undefined),
  });
  const items = query.isError ? [] : uniquePageItems(query.data?.pages);
  const groups = groupCycleTasks(items, groupBy, t("parity:cycles.unassigned"));
  return (
    <section className="space-y-4">
      {!compact && (
        <>
          <h2 className="text-sm font-medium">{t("parity:cycles.tasks")}</h2>
          <CycleTaskFiltersBar
            workspaceId={workspaceId}
            filters={filters}
            setFilters={setFilters}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
          />
        </>
      )}
      {query.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("parity:planning.loading")}
        </p>
      )}
      {query.error && (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
          <Button variant="ghost" onClick={() => void query.refetch()}>
            {t("parity:planning.retry")}
          </Button>
        </p>
      )}
      {!query.isPending && !query.error && !items.length && (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {assigneeId
            ? t("parity:cycles.emptyAssigned")
            : t("parity:cycles.noTasks")}
        </p>
      )}
      {groups.map((group) => (
        <div key={group.id} className="overflow-hidden">
          <h3 className="flex gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs font-medium">
            {group.name}
            <span className="text-muted-foreground">{group.tasks.length}</span>
            {groupBy === "state" && (
              <span className="ml-auto truncate font-normal text-muted-foreground">
                {group.tasks[0]?.projectName}
              </span>
            )}
          </h3>
          {group.tasks.map((task) => (
            <Link
              key={task.id}
              to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
              params={{
                workspaceId,
                projectId: task.projectId,
                taskId: task.id,
              }}
              className="flex min-h-10 items-center gap-2.5 border-b border-border/30 px-3 py-2 text-[13px] outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span title={getPriorityLabel(task.priority)}>
                <span aria-hidden="true">{getPriorityIcon(task.priority)}</span>
                <span className="sr-only">
                  {getPriorityLabel(task.priority)}
                </span>
              </span>
              <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{`${task.projectSlug.toUpperCase()}-${task.number ?? ""}`}</span>
              <PlanningStatusIcon status={task.category} />
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              <span className="hidden max-w-32 truncate text-xs text-muted-foreground sm:block">
                {task.assigneeName ?? t("parity:cycles.unassigned")}
              </span>
              {settings.estimateScale !== "none" && task.estimate !== null && (
                <span className="min-w-5 text-right text-xs tabular-nums text-muted-foreground">
                  {estimateLabel(
                    task.estimate,
                    settings.estimateScale,
                    i18n.language,
                  )}
                </span>
              )}
            </Link>
          ))}
        </div>
      ))}
      {query.hasNextPage && (
        <Button
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t("parity:cycles.loadMore")}
        </Button>
      )}
    </section>
  );
}
