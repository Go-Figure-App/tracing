import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Calendar, MoreHorizontal, User } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { MarkdownText } from "@/components/markdown";
import {
  ErrorState,
  Loading,
  PageHeader,
  Screen,
  Scroll,
  useBottomInset,
} from "@/components/screen";
import { OptionSheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { IconButton } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { useAction } from "@/lib/query";
import { useColors } from "@/theme";
import { planningApi } from "./api";
import { PlanningHealth } from "./health";
import { InitiativeProjects } from "./initiative-projects";
import { initiativeStatuses, usePlanningLabels } from "./labels";
import { PlanningTabs } from "./planning-tabs";
import { PlanningProgress } from "./progress";
import { PlanningPropertyChip } from "./property-chip";
import { usePlanningEnabled, usePlanningPermissions } from "./queries";
import { PlanningStatusIcon } from "./status-icon";
import { PlanningUpdates } from "./update-feed";

export function InitiativeDetailScreen({
  initiativeId,
}: {
  initiativeId: string;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const bottom = useBottomInset(24);
  const labels = usePlanningLabels();
  const enabled = usePlanningEnabled("initiatives");
  const { run, busy } = useAction("parity");
  const [tab, setTab] = useState<"overview" | "updates" | "projects">(
    "overview",
  );
  const [menu, setMenu] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const query = useQuery({
    queryKey: ["parity", "initiative", initiativeId],
    queryFn: () => planningApi.initiative(initiativeId),
    enabled,
  });
  const initiative = query.isError ? undefined : query.data;
  const client = useQueryClient();
  const updatesQueryKey = ["parity", "updates", "initiative", initiativeId];
  const updatesFetching = useIsFetching({
    queryKey: updatesQueryKey,
    exact: true,
  });
  const permissions = usePlanningPermissions(initiative?.workspaceId);
  const canEdit =
    !initiative?.archivedAt && Boolean(permissions.data?.updateProjects);
  const canArchive = Boolean(
    permissions.data?.updateProjects && permissions.data.manageSettings,
  );
  const edit = canEdit
    ? () =>
        router.push({
          pathname: "/initiative/[initiativeId]/edit",
          params: { initiativeId },
        })
    : undefined;
  return (
    <Screen surface>
      <PageHeader
        title={initiative?.name ?? t("mobile:parity.planning.initiative")}
        action={
          initiative &&
          (canEdit || canArchive) && (
            <IconButton
              size={44}
              label={t("mobile:parity.planning.more")}
              disabled={busy}
              onPress={() => setMenu(true)}
            >
              <MoreHorizontal size={22} color={c.ink2} />
            </IconButton>
          )
        }
      />
      {!enabled ? (
        <Txt center>{t("mobile:parity.planning.unavailable")}</Txt>
      ) : query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState
          message={userMessage(query.error)}
          onRetry={query.refetch}
        />
      ) : (
        initiative && (
          <>
            <PlanningTabs
              value={tab}
              onChange={setTab}
              options={[
                {
                  value: "overview",
                  label: t("mobile:parity.planning.overview"),
                },
                {
                  value: "updates",
                  label: t("mobile:parity.planning.updates"),
                },
                {
                  value: "projects",
                  label: t("mobile:parity.planning.projects"),
                },
              ]}
            />
            <Scroll
              refreshing={
                query.isRefetching || (tab === "updates" && updatesFetching > 0)
              }
              onRefresh={() => {
                void query.refetch();
                if (tab === "updates")
                  void client.refetchQueries({
                    queryKey: updatesQueryKey,
                    exact: true,
                    type: "active",
                  });
              }}
              bottomPadding={bottom + 24}
            >
              <View style={{ paddingTop: 20 }}>
                {tab === "projects" ? (
                  <InitiativeProjects
                    initiative={initiative}
                    canEdit={canEdit}
                  />
                ) : (
                  <View style={{ paddingHorizontal: 20, gap: 24 }}>
                    {tab === "updates" ? (
                      <PlanningUpdates
                        kind="initiative"
                        id={initiativeId}
                        health={initiative.health}
                        canUpdate={canEdit}
                      />
                    ) : (
                      <>
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          <PlanningPropertyChip
                            label={t("mobile:parity.planning.status")}
                            value={
                              initiative.archivedAt
                                ? t("mobile:parity.planning.archived")
                                : labels.status[initiative.status]
                            }
                            icon={
                              <PlanningStatusIcon status={initiative.status} />
                            }
                            disabled={busy}
                            onPress={
                              canEdit ? () => setStatusOpen(true) : undefined
                            }
                          />
                          <PlanningPropertyChip
                            label={t("mobile:parity.planning.owner")}
                            value={
                              initiative.ownerName ??
                              t("mobile:parity.planning.noOwner")
                            }
                            icon={<User size={15} color={c.muted} />}
                            onPress={edit}
                          />
                          <PlanningPropertyChip
                            label={t("mobile:parity.planning.targetDate")}
                            value={
                              initiative.targetDate
                                ? formatDate(initiative.targetDate)
                                : t("mobile:parity.planning.noDate")
                            }
                            icon={<Calendar size={15} color={c.muted} />}
                            onPress={edit}
                          />
                        </View>
                        <View style={{ gap: 12 }}>
                          <PlanningHealth health={initiative.health} />
                          <PlanningProgress progress={initiative.progress} />
                        </View>
                        {initiative.description ? (
                          <MarkdownText>{initiative.description}</MarkdownText>
                        ) : (
                          <Txt tone="muted">
                            {t("mobile:parity.planning.noDescription")}
                          </Txt>
                        )}
                        <PlanningPropertyChip
                          label={t("mobile:parity.planning.linkedProjects")}
                          value={`${t("mobile:parity.planning.projects")} (${initiative.projects.length})`}
                          onPress={() => setTab("projects")}
                        />
                      </>
                    )}
                  </View>
                )}
              </View>
            </Scroll>
            <OptionSheet
              visible={statusOpen && canEdit}
              onClose={() => setStatusOpen(false)}
              title={t("mobile:parity.planning.status")}
              selected={initiative.status}
              options={initiativeStatuses.map((value) => ({
                value,
                label: labels.status[value],
                leading: <PlanningStatusIcon status={value} />,
              }))}
              onSelect={(status) => {
                void run(() =>
                  planningApi.updateInitiative(initiativeId, { status }),
                );
              }}
            />
            <OptionSheet
              visible={menu}
              onClose={() => setMenu(false)}
              title={t("mobile:parity.planning.more")}
              options={[
                ...(canEdit
                  ? [
                      {
                        value: "edit",
                        label: t("mobile:parity.planning.editProperties"),
                      },
                    ]
                  : []),
                ...(canArchive
                  ? [
                      {
                        value: "archive",
                        label: t(
                          initiative.archivedAt
                            ? "mobile:parity.planning.restore"
                            : "mobile:parity.planning.archive",
                        ),
                      },
                    ]
                  : []),
              ]}
              onSelect={(value) => {
                if (value === "edit") edit?.();
                else if (canArchive)
                  void run(() =>
                    planningApi.updateInitiative(initiativeId, {
                      archived: !initiative.archivedAt,
                    }),
                  );
              }}
            />
          </>
        )
      )}
    </Screen>
  );
}
