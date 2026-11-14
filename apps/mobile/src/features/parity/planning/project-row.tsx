import { router } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ProjectIcon } from "@/components/icons";
import { Txt } from "@/components/text";
import { Touch } from "@/components/ui";
import { currentLocale } from "@/lib/i18n";
import { useColors } from "@/theme";
import { usePlanningLabels } from "./labels";
import { PlanningStatusIcon } from "./status-icon";
import type { ProjectSummary } from "./types";

export function PlanningProjectRow({
  project,
  action,
}: {
  project: ProjectSummary;
  action?: ReactNode;
}) {
  const c = useColors();
  const { t } = useTranslation(["mobile"]);
  const labels = usePlanningLabels();
  const percent = new Intl.NumberFormat(currentLocale(), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format((project.progress.pointsPercent ?? project.progress.percent) / 100);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: c.divider,
      }}
    >
      <Touch
        accessibilityRole="button"
        accessibilityLabel={`${project.name}, ${labels.status[project.status]}, ${t("mobile:parity.planning.progress")} ${percent}`}
        onPress={() =>
          router.push({
            pathname: "/project/[projectId]/overview",
            params: { projectId: project.id },
          })
        }
        style={{
          flex: 1,
          minHeight: 56,
          paddingVertical: 12,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <ProjectIcon name={project.icon} color={c.ink2} />
        <Txt variant="body" style={{ flex: 1 }} numberOfLines={2}>
          {project.name}
        </Txt>
        <Txt variant="caption" tone="muted">
          {percent}
        </Txt>
        <PlanningStatusIcon status={project.status} />
      </Touch>
      {action}
    </View>
  );
}
