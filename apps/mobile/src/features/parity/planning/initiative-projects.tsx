import { Minus, Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ListGroupHeader } from "@/components/rows";
import { ErrorState, Loading } from "@/components/screen";
import { OptionSheet, Sheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { Button, IconButton } from "@/components/ui";
import { userMessage } from "@/lib/api/client";
import { useAction } from "@/lib/query";
import { useColors } from "@/theme";
import { planningApi } from "./api";
import { projectStatuses, usePlanningLabels } from "./labels";
import { usePlanningProjects } from "./project-queries";
import { PlanningProjectRow } from "./project-row";
import type { InitiativeDetail } from "./types";
import { uniquePageItems } from "./unique-page-items";

export function InitiativeProjects({
  initiative,
  canEdit,
}: {
  initiative: InitiativeDetail;
  canEdit: boolean;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const labels = usePlanningLabels();
  const [adding, setAdding] = useState(false);
  const { run, busy } = useAction("parity");
  const query = usePlanningProjects(initiative.workspaceId, adding && canEdit);
  const available = (
    query.isError ? [] : uniquePageItems(query.data?.pages)
  ).filter(
    (project) =>
      !initiative.projects.some((linked) => linked.id === project.id),
  );
  const groups = projectStatuses
    .map((status) => ({
      status,
      projects: initiative.projects.filter(
        (project) => project.status === status,
      ),
    }))
    .filter((group) => group.projects.length);
  return (
    <View style={{ gap: 12 }}>
      {canEdit && (
        <View style={{ paddingHorizontal: 20 }}>
          <Button
            kind="secondary"
            label={t("mobile:parity.planning.linkProject")}
            loading={busy}
            onPress={() => setAdding(true)}
            icon={<Plus size={16} color={c.ink2} />}
          />
        </View>
      )}
      {!groups.length && (
        <Txt tone="muted" style={{ padding: 20 }}>
          {t("mobile:parity.planning.noProjects")}
        </Txt>
      )}
      {groups.map((group) => (
        <View key={group.status}>
          <ListGroupHeader
            title={labels.status[group.status]}
            count={group.projects.length}
          />
          {group.projects.map((project) => (
            <PlanningProjectRow
              key={project.id}
              project={project}
              action={
                canEdit && (
                  <IconButton
                    size={44}
                    label={`${t("mobile:parity.planning.unlinkProject")}: ${project.name}`}
                    disabled={busy}
                    onPress={() => {
                      void run(() =>
                        planningApi.unlinkProject(initiative.id, project.id),
                      );
                    }}
                  >
                    <Minus size={18} color={c.muted} />
                  </IconButton>
                )
              }
            />
          ))}
        </View>
      ))}
      {adding &&
        canEdit &&
        (query.isPending || query.isError || query.hasNextPage ? (
          <Sheet
            visible
            title={t("mobile:parity.planning.linkProject")}
            onClose={() => setAdding(false)}
          >
            {query.isError ? (
              <ErrorState
                message={userMessage(query.error)}
                onRetry={query.refetch}
              />
            ) : (
              <Loading />
            )}
          </Sheet>
        ) : (
          <OptionSheet
            visible
            onClose={() => setAdding(false)}
            title={t("mobile:parity.planning.linkProject")}
            options={available.map((project) => ({
              value: project.id,
              label: project.name,
              hint: labels.status[project.status],
            }))}
            searchable
            onSelect={(projectId) => {
              void run(() => planningApi.linkProject(initiative.id, projectId));
            }}
          />
        ))}
    </View>
  );
}
