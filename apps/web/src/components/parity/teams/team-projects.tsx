import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getProjectPlans } from "@/fetchers/parity/projects";
import { Button } from "@/components/ui/button";
import { ProjectsTable } from "../planning/projects-table";
import { uniquePageItems } from "../planning/unique-page-items";
export function TeamProjects({
  workspaceId,
  teamId,
}: {
  workspaceId: string;
  teamId: string;
}) {
  const { t } = useTranslation();
  const query = useInfiniteQuery({
    queryKey: ["parity", "team-projects", workspaceId, teamId],
    queryFn: ({ pageParam }) => getProjectPlans(workspaceId, pageParam, teamId),
    initialPageParam: 1,
    getNextPageParam: (page) => (page.hasMore ? page.page + 1 : undefined),
  });
  return (
    <div>
      {query.isPending && <p role="status">{t("parity:planning.loading")}</p>}
      {query.error ? (
        <p role="alert">
          {query.error.message}
          <Button onClick={() => void query.refetch()}>
            {t("parity:planning.retry")}
          </Button>
        </p>
      ) : (
        <ProjectsTable projects={uniquePageItems(query.data?.pages)} />
      )}
      {!query.isPending &&
        !query.error &&
        !query.data?.pages[0]?.items.length && (
          <p>{t("parity:planning.noProjects")}</p>
        )}
      {query.hasNextPage && (
        <Button
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t("parity:planning.loadMore")}
        </Button>
      )}
    </div>
  );
}
