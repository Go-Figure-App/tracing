import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleDashed, ChevronRight } from "lucide-react-native";
import { SectionList, View } from "react-native";
import {
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Screen,
  useBottomInset,
} from "@/components/screen";
import { Txt } from "@/components/text";
import { Button, Touch } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { usePlanningEnabled } from "../planning/queries";
import { uniquePageItems } from "../planning/unique-page-items";
import { cyclesApi } from "./api";
import { PlanningTabs } from "../planning/planning-tabs";
import { ListGroupHeader } from "@/components/rows";
import { currentLocale } from "@/lib/i18n";
import { useColors } from "@/theme";
import { completion } from "./chart";
import type { CyclePhase } from "./types";
import { useCycleFocus } from "./queries";

export function CycleList({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const bottom = useBottomInset(24);
  const enabled = usePlanningEnabled("cycles");
  const [phase, setPhase] = useState<CyclePhase | "all">("all");
  const query = useInfiniteQuery({
    queryKey: ["parity", "cycles", workspaceId, phase],
    queryFn: ({ pageParam }) => cyclesApi.list(workspaceId, phase, pageParam),
    initialPageParam: 1,
    getNextPageParam: (page) => (page.hasMore ? page.page + 1 : undefined),
    enabled: enabled && Boolean(workspaceId),
  });
  const items = query.isError ? [] : uniquePageItems(query.data?.pages);
  useCycleFocus(query.refetch, enabled && Boolean(workspaceId));
  const settings = query.data?.pages[0]?.settings;
  const sections = (["current", "upcoming", "past"] as const)
    .map((value) => ({
      key: value,
      title: t(`mobile:parity.cycles.${value}`),
      data: items.filter((item) => item.phase === value),
    }))
    .filter((section) => section.data.length);
  const date = new Intl.DateTimeFormat(currentLocale(), {
    month: "short",
    day: "numeric",
    timeZone: settings?.timeZone ?? "UTC",
  });
  return (
    <Screen surface>
      <PageHeader title={t("mobile:parity.cycles.title")} />
      {!enabled ? (
        <Txt center>{t("mobile:parity.planning.unavailable")}</Txt>
      ) : (
        <>
          <PlanningTabs
            value={phase}
            onChange={setPhase}
            options={(["all", "current", "upcoming", "past"] as const).map(
              (value) => ({
                value,
                label:
                  value === "all"
                    ? t("mobile:parity.planning.all")
                    : t(`mobile:parity.cycles.${value}`),
              }),
            )}
          />
          {query.isPending ? (
            <Loading />
          ) : query.error ? (
            <ErrorState
              message={userMessage(query.error)}
              onRetry={query.refetch}
            />
          ) : (
            <SectionList
              sections={sections}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => (
                <ListGroupHeader
                  title={section.title}
                  count={section.data.length}
                />
              )}
              keyExtractor={(item) => item.id}
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              contentContainerStyle={{
                paddingBottom: bottom + 20,
              }}
              ListEmptyComponent={
                <EmptyState
                  title={
                    phase === "current"
                      ? t("mobile:parity.cycles.noCurrentCycle")
                      : t("mobile:parity.cycles.noCycles")
                  }
                  message={
                    settings?.cyclesEnabled
                      ? undefined
                      : t("mobile:parity.cycles.disabled")
                  }
                />
              }
              renderItem={({ item }) => (
                <Touch
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/cycle/[cycleId]",
                      params: { cycleId: item.id },
                    })
                  }
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    minHeight: 72,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: c.divider,
                  }}
                >
                  <CircleDashed
                    size={20}
                    color={item.phase === "current" ? c.warningFg : c.muted}
                  />
                  <View style={{ flex: 1, gap: 5 }}>
                    <Txt variant="body" weight="medium" numberOfLines={2}>
                      {item.name ??
                        t("mobile:parity.cycles.number", {
                          number: item.number,
                        })}
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      {date.format(new Date(item.startsAt))} –{" "}
                      {date.format(new Date(+new Date(item.endsAt) - 1))}
                    </Txt>
                  </View>
                  <Txt variant="caption" tone="muted">
                    {new Intl.NumberFormat(currentLocale(), {
                      style: "percent",
                      maximumFractionDigits: 0,
                    }).format(
                      completion(
                        item.summary ?? item.progress,
                        settings?.estimateScale !== "none",
                      ) / 100,
                    )}
                  </Txt>
                  <ChevronRight size={16} color={c.faint} />
                </Touch>
              )}
              ListFooterComponent={
                query.hasNextPage ? (
                  <Button
                    label={t("mobile:parity.cycles.loadMore")}
                    kind="secondary"
                    loading={query.isFetchingNextPage}
                    onPress={() => void query.fetchNextPage()}
                  />
                ) : undefined
              }
            />
          )}
        </>
      )}
    </Screen>
  );
}
