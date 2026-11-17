import { router } from "expo-router";
import { Screen } from "@/components/screen";
import { ActivityTab } from "@/features/home/activity-tab";
import { MoreTab } from "@/features/parity/planning/more-tab";
import { usePlanningEnabled } from "@/features/parity/planning/queries";
import { VisitedTab } from "@/features/parity/navigation/visited-tab";
import { useHomeWorkspace } from "@/features/parity/navigation/workspace-context";

export default function MoreScreen() {
  const workspace = useHomeWorkspace();
  const projects = usePlanningEnabled();
  const cycles = usePlanningEnabled("cycles");
  const insights = usePlanningEnabled("insights");
  const views = usePlanningEnabled("views");
  return (
    <Screen surface>
      <VisitedTab>
        {projects || cycles || insights || views ? (
          <MoreTab
            workspaceId={workspace.id}
            onActivity={() => router.push("/activity")}
          />
        ) : (
          <ActivityTab workspace={workspace} />
        )}
      </VisitedTab>
    </Screen>
  );
}
