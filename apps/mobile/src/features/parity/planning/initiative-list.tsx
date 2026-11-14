import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Flag, Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionList, View } from "react-native";
import { ListGroupHeader } from "@/components/rows";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Screen,
  useBottomInset,
} from "@/components/screen";
import { SearchField } from "@/components/sheet";
import { Txt } from "@/components/text";
import { IconButton, Touch } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { currentLocale } from "@/lib/i18n";
import { useColors } from "@/theme";
import { planningApi } from "./api";
import { initiativeStatuses, usePlanningLabels } from "./labels";
import { PlanningTabs } from "./planning-tabs";
import { usePlanningEnabled, usePlanningPermissions } from "./queries";
import { PlanningStatusIcon } from "./status-icon";
import { uniquePageItems } from "./unique-page-items";

export function InitiativeList({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const bottom = useBottomInset(24);
  const labels = usePlanningLabels();
  const enabled = usePlanningEnabled("initiatives");
  const [archived, setArchived] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const permissions = usePlanningPermissions(workspaceId);
  const query = useInfiniteQuery({
    queryKey: ["parity", "initiatives", workspaceId, archived],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      planningApi.initiatives(workspaceId, pageParam, archived),
    getNextPageParam: (page) => (page.hasMore ? page.page + 1 : undefined),
    enabled,
  });
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  useEffect(() => {
    if (enabled && hasNextPage && !isFetching && !isError) void fetchNextPage();
  }, [enabled, hasNextPage, isFetching, isError, fetchNextPage]);
  const term = search.trim().toLocaleLowerCase(currentLocale());
  const items = (
    query.isError ? [] : uniquePageItems(query.data?.pages)
  ).filter(
    (item) =>
      (!status || item.status === status) &&
      (!term || item.name.toLocaleLowerCase(currentLocale()).includes(term)),
  );
  const sections = initiativeStatuses
    .map((value) => ({
      key: value,
      title: labels.status[value],
      data: items.filter((item) => item.status === value),
    }))
    .filter((section) => section.data.length);
  return (
    <Screen surface>
      <PageHeader
        title={t("mobile:parity.planning.initiatives")}
        action={
          enabled &&
          permissions.data?.updateProjects && (
            <IconButton
              size={44}
              label={t("mobile:parity.planning.newInitiative")}
              onPress={() =>
                router.push({
                  pathname: "/initiative/new",
                  params: { workspaceId },
                })
              }
            >
              <Plus size={22} color={c.ink2} />
            </IconButton>
          )
        }
      />
      {!enabled ? (
        <Txt center>{t("mobile:parity.planning.unavailable")}</Txt>
      ) : (
        <>
          <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder={t("mobile:parity.planning.searchInitiatives")}
            />
          </View>
          <PlanningTabs
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: t("mobile:parity.planning.all") },
              ...initiativeStatuses.map((value) => ({
                value,
                label: labels.status[value],
              })),
            ]}
          />
          {query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorState
              message={userMessage(query.error)}
              onRetry={query.refetch}
            />
          ) : (
            <SectionList
              sections={sections}
              stickySectionHeadersEnabled={false}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              contentContainerStyle={{ paddingBottom: bottom + 20 }}
              renderSectionHeader={({ section }) => (
                <ListGroupHeader
                  title={section.title}
                  count={section.data.length}
                />
              )}
              renderItem={({ item }) => (
                <Touch
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/initiative/[initiativeId]",
                      params: { initiativeId: item.id },
                    })
                  }
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    minHeight: 64,
                    gap: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: c.divider,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Flag size={18} color={c.ink2} />
                    <Txt variant="body" style={{ flex: 1 }} numberOfLines={2}>
                      {item.name}
                    </Txt>
                    <PlanningStatusIcon status={item.status} />
                  </View>
                  <Txt
                    variant="caption"
                    tone="muted"
                    numberOfLines={1}
                    style={{ paddingLeft: 30 }}
                  >
                    {item.archivedAt
                      ? t("mobile:parity.planning.archived")
                      : (item.ownerName ??
                        t("mobile:parity.planning.noOwner"))}{" "}
                    ·{" "}
                    {item.targetDate
                      ? formatDate(item.targetDate)
                      : t("mobile:parity.planning.noDate")}{" "}
                    ·{" "}
                    {new Intl.NumberFormat(currentLocale(), {
                      style: "percent",
                      maximumFractionDigits: 0,
                    }).format(
                      (item.progress.pointsPercent ?? item.progress.percent) /
                        100,
                    )}
                  </Txt>
                </Touch>
              )}
              ListEmptyComponent={
                !query.hasNextPage ? (
                  <EmptyState
                    title={t("mobile:parity.planning.noInitiatives")}
                  />
                ) : undefined
              }
              ListFooterComponent={query.hasNextPage ? <Loading /> : undefined}
            />
          )}
          <Touch
            accessibilityRole="checkbox"
            accessibilityState={{ checked: archived }}
            onPress={() => setArchived(!archived)}
            style={{
              minHeight: 44,
              paddingHorizontal: 20,
              paddingBottom: bottom,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: c.divider,
            }}
          >
            <Txt variant="meta" tone="muted">
              {archived ? "✓ " : ""}
              {t("mobile:parity.planning.showArchived")}
            </Txt>
          </Touch>
        </>
      )}
    </Screen>
  );
}
