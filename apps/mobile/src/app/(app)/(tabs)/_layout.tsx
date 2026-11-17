import { NativeNavigation } from "@/features/parity/navigation/native-navigation";
import { WorkspaceShell } from "@/features/parity/navigation/workspace-shell";

export default function HomeTabsLayout() {
  return (
    <WorkspaceShell>
      <NativeNavigation />
    </WorkspaceShell>
  );
}
