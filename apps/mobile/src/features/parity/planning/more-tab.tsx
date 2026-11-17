import { router } from "expo-router";
import {
  Users,
  Activity,
  Folder,
  LayoutList,
  Flag,
  GanttChart,
  CircleDashed,
  ChartNoAxesCombined,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader, Scroll } from "@/components/screen";
import { Txt } from "@/components/text";
import { Group, Touch } from "@/components/ui";
import { useColors } from "@/theme";
import { usePlanningEnabled } from "./queries";

export function MoreTab({
  workspaceId,
  onActivity,
}: {
  workspaceId: string;
  onActivity: () => void;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const projects = usePlanningEnabled();
  const initiatives = usePlanningEnabled("initiatives");
  const roadmap = usePlanningEnabled("roadmap");
  const cycles = usePlanningEnabled("cycles");
  const insights = usePlanningEnabled("insights");
  const views = usePlanningEnabled("views");
  const teams = usePlanningEnabled("teams");
  const entries = [
    {
      id: "teams",
      enabled: teams,
      label: t("mobile:parity.teams.title"),
      Icon: Users,
      onPress: () =>
        router.push({ pathname: "/teams", params: { workspaceId } }),
    },
    {
      id: "projects",
      enabled: projects,
      label: t("mobile:home.projects"),
      Icon: Folder,
      onPress: () =>
        router.push({ pathname: "/projects", params: { workspaceId } }),
    },
    {
      id: "initiatives",
      enabled: initiatives,
      label: t("mobile:parity.planning.initiatives"),
      Icon: Flag,
      onPress: () =>
        router.push({ pathname: "/initiatives", params: { workspaceId } }),
    },
    {
      id: "cycles",
      enabled: cycles,
      label: t("mobile:parity.cycles.title"),
      Icon: CircleDashed,
      onPress: () =>
        router.push({ pathname: "/cycles", params: { workspaceId } }),
    },
    {
      id: "roadmap",
      enabled: roadmap,
      label: t("mobile:parity.roadmap.title"),
      Icon: GanttChart,
      onPress: () =>
        router.push({ pathname: "/roadmap", params: { workspaceId } }),
    },
    {
      id: "views",
      enabled: views,
      label: t("mobile:parity.views.title"),
      Icon: LayoutList,
      onPress: () =>
        router.push({ pathname: "/views", params: { workspaceId } }),
    },
    {
      id: "insights",
      enabled: insights,
      label: t("mobile:parity.insights.title"),
      Icon: ChartNoAxesCombined,
      onPress: () =>
        router.push({ pathname: "/insights", params: { workspaceId } }),
    },
    {
      id: "activity",
      enabled: true,
      label: t("mobile:nav.activity"),
      Icon: Activity,
      onPress: onActivity,
    },
  ];
  return (
    <Scroll>
      <PageHeader title={t("mobile:parity.planning.more")} back={false} />
      <View style={{ paddingHorizontal: 20 }}>
        <Group>
          {entries
            .filter((entry) => entry.enabled)
            .map(({ id, label, Icon, onPress }) => (
              <Touch
                key={id}
                accessibilityRole="button"
                onPress={onPress}
                style={{
                  padding: 18,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Icon size={20} color={c.ink2} />
                <Txt>{label}</Txt>
              </Touch>
            ))}
        </Group>
      </View>
    </Scroll>
  );
}
