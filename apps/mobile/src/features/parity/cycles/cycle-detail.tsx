import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
  ErrorState,
  Loading,
  PageHeader,
  Screen,
  Scroll,
  useBottomInset,
} from "@/components/screen";
import { Txt } from "@/components/text";
import { currentLocale } from "@/lib/i18n";
import { userMessage } from "@/lib/api/client";
import { PlanningTabs } from "../planning/planning-tabs";
import { usePlanningEnabled } from "../planning/queries";
import { cyclesApi } from "./api";
import { CycleBurndown } from "./burndown-chart";
import { CycleProgress } from "./progress";
import { CycleTaskList } from "./task-list";
import { useCycleFocus } from "./queries";

export function CycleDetailScreen({ cycleId }: { cycleId: string }) {
  const { t } = useTranslation(["mobile"]);
  const [tab, setTab] = useState<"issues" | "overview">("issues");
  const bottom = useBottomInset(24);
  const enabled = usePlanningEnabled("cycles");
  const query = useQuery({
    queryKey: ["parity", "cycle", cycleId],
    queryFn: () => cyclesApi.detail(cycleId),
    enabled: enabled && Boolean(cycleId),
  });
  const cycle = query.isError ? undefined : query.data;
  useCycleFocus(query.refetch, enabled && Boolean(cycleId));
  const date = new Intl.DateTimeFormat(currentLocale(), {
    month: "short",
    day: "numeric",
    timeZone: cycle?.settings.timeZone ?? "UTC",
  });
  return (
    <Screen surface>
      <PageHeader
        description={
          cycle
            ? `${date.format(new Date(cycle.startsAt))} – ${date.format(new Date(+new Date(cycle.endsAt) - 1))}`
            : undefined
        }
        title={
          cycle?.name ??
          (cycle
            ? t("mobile:parity.cycles.number", { number: cycle.number })
            : t("mobile:parity.cycles.title"))
        }
      />
      {!enabled ? (
        <Txt center>{t("mobile:parity.planning.unavailable")}</Txt>
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState
          message={userMessage(query.error)}
          onRetry={query.refetch}
        />
      ) : (
        cycle && (
          <>
            <PlanningTabs
              value={tab}
              onChange={setTab}
              options={[
                { value: "issues", label: t("mobile:parity.cycles.tasks") },
                {
                  value: "overview",
                  label: t("mobile:parity.planning.overview"),
                },
              ]}
            />
            <View
              style={{
                flex: tab === "issues" ? 1 : 0,
                display: tab === "issues" ? "flex" : "none",
              }}
            >
              <CycleTaskList
                key={cycle.id}
                cycleId={cycle.id}
                workspaceId={cycle.workspaceId}
                settings={cycle.settings}
                refreshing={query.isRefetching}
                onRefresh={() => void query.refetch()}
              />
            </View>
            {tab === "overview" && (
              <Scroll
                refreshing={query.isRefetching}
                onRefresh={() => void query.refetch()}
                bottomPadding={bottom + 24}
              >
                <View style={{ padding: 20, gap: 24 }}>
                  <Txt variant="meta" tone="muted">
                    {t(`mobile:parity.cycles.${cycle.phase}`)}
                  </Txt>
                  <CycleProgress cycle={cycle} settings={cycle.settings} />
                  <CycleBurndown cycle={cycle} />
                </View>
              </Scroll>
            )}
          </>
        )
      )}
    </Screen>
  );
}
