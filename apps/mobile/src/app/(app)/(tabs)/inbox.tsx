import { Screen } from "@/components/screen";
import { VisitedTab } from "@/features/parity/navigation/visited-tab";
import { useHomeWorkspace } from "@/features/parity/navigation/workspace-context";
import { PlanningInbox } from "@/features/parity/triage/inbox";

export default function InboxScreen() {
  const workspace = useHomeWorkspace();
  return (
    <Screen surface>
      <VisitedTab>
        <PlanningInbox workspaceId={workspace.id} />
      </VisitedTab>
    </Screen>
  );
}
