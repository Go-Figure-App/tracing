import { router } from "expo-router";
import { useState } from "react";
import { Screen } from "@/components/screen";
import { HomeTabView } from "@/features/home/home-tab";
import { WorkspaceSheet } from "@/features/home/workspace-sheet";
import { useHomeWorkspace } from "@/features/parity/navigation/workspace-context";

export default function HomeScreen() {
  const workspace = useHomeWorkspace();
  const [switcher, setSwitcher] = useState(false);
  return (
    <Screen>
      <HomeTabView
        workspace={workspace}
        onSwitch={() => setSwitcher(true)}
        onViewAllTasks={() => router.navigate("/tasks")}
      />
      <WorkspaceSheet
        visible={switcher}
        onClose={() => setSwitcher(false)}
        current={workspace}
      />
    </Screen>
  );
}
