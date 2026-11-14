import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { planningApi } from "./api";

export function usePlanningProjects(workspaceId: string, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: ["parity", "projects", workspaceId],
    queryFn: ({ pageParam }) => planningApi.projects(workspaceId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (page) => (page.hasMore ? page.page + 1 : undefined),
    enabled: enabled && Boolean(workspaceId),
  });
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  useEffect(() => {
    if (enabled && hasNextPage && !isFetching && !isError) void fetchNextPage();
  }, [enabled, hasNextPage, isFetching, isError, fetchNextPage]);
  return query;
}
