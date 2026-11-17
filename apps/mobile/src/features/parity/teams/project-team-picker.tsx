import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { OptionSheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { Button } from "@/components/ui";
import { useAction } from "@/lib/query";
import { planningApi } from "../planning/api";
import { PlanningPropertyChip } from "../planning/property-chip";
import { usePlanningEnabled } from "../planning/queries";
import { useTeams } from "./queries";
export function ProjectTeamPicker({
  workspaceId,
  projectId,
  teamId,
  canEdit,
}: {
  workspaceId: string;
  projectId: string;
  teamId?: string | null;
  canEdit: boolean;
}) {
  const { t } = useTranslation(["mobile"]);
  const enabled = usePlanningEnabled("teams");
  const query = useTeams(workspaceId);
  const [open, setOpen] = useState(false);
  const { run, busy } = useAction("parity");
  if (!enabled) return null;
  return (
    <View>
      <PlanningPropertyChip
        label={t("mobile:parity.teams.team")}
        value={
          query.data?.find((team) => team.id === teamId)?.name ??
          t("mobile:parity.teams.noTeam")
        }
        disabled={busy || query.isPending || query.isError}
        onPress={canEdit ? () => setOpen(true) : undefined}
      />
      {query.error && (
        <>
          <Txt tone="muted">{query.error.message}</Txt>
          <Button
            label={t("mobile:parity.planning.retry")}
            onPress={() => void query.refetch()}
          />
        </>
      )}
      <OptionSheet
        visible={open && canEdit}
        onClose={() => setOpen(false)}
        title={t("mobile:parity.teams.team")}
        selected={teamId ?? ""}
        options={[
          { value: "", label: t("mobile:parity.teams.noTeam") },
          ...(query.data
            ?.filter((team) => !team.archivedAt)
            .map((team) => ({ value: team.id, label: team.name })) ?? []),
        ]}
        onSelect={(value) => {
          void run(() =>
            planningApi.updateProject(projectId, { teamId: value || null }),
          );
        }}
      />
    </View>
  );
}
