import { Screen } from "@/components/screen";
import { MyTasksTab } from "@/features/home/my-tasks-tab";
import { VisitedTab } from "@/features/parity/navigation/visited-tab";
import { useHomeWorkspace } from "@/features/parity/navigation/workspace-context";

export default function TasksScreen() {
  const workspace = useHomeWorkspace();
  return (
    <Screen surface>
      <VisitedTab>
        <MyTasksTab workspaceId={workspace.id} />
      </VisitedTab>
    </Screen>
  );
}
