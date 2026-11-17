import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FlatList } from "react-native";
import { EmptyState, ErrorState, Loading } from "@/components/screen";
import { Button } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { planningApi } from "../planning/api";
import { PlanningProjectRow } from "../planning/project-row";
import { uniquePageItems } from "../planning/unique-page-items";
export function TeamProjects({
  workspaceId,
  teamId,
}: {
  workspaceId: string;
  teamId: string;
}) {
  const { t } = useTranslation(["mobile"]);
  const query = useInfiniteQuery({
    queryKey: ["parity", "team-projects", workspaceId, teamId],
    queryFn: ({ pageParam }) =>
      planningApi.projects(workspaceId, pageParam, teamId),
    initialPageParam: 1,
    getNextPageParam: (page) => (page.hasMore ? page.page + 1 : undefined),
  });
  return (
    <FlatList
      contentContainerStyle={{ paddingBottom: 40 }}
      data={query.isError ? [] : uniquePageItems(query.data?.pages)}
      keyExtractor={(item) => item.id}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      renderItem={({ item }) => <PlanningProjectRow project={item} />}
      ListEmptyComponent={
        query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState
            message={userMessage(query.error)}
            onRetry={query.refetch}
          />
        ) : (
          <EmptyState title={t("mobile:parity.planning.noProjects")} />
        )
      }
      ListFooterComponent={
        query.hasNextPage ? (
          <Button
            label={t("mobile:parity.planning.loadMore")}
            loading={query.isFetchingNextPage}
            onPress={() => void query.fetchNextPage()}
          />
        ) : undefined
      }
    />
  );
}
