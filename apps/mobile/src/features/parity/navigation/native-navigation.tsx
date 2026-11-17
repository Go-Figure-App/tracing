import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useUnreadCount } from "@/lib/hooks";
import { useColors, useIsDark } from "@/theme";
import { usePlanningEnabled } from "../planning/queries";
import { useTriageCount } from "../triage/queries";
import { useHomeWorkspace } from "./workspace-context";

export function NativeNavigation() {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const dark = useIsDark();
  const workspace = useHomeWorkspace();
  const unread = useUnreadCount(workspace.id);
  const triage = useTriageCount(workspace.id);
  const projects = usePlanningEnabled();
  const cycles = usePlanningEnabled("cycles");
  const insights = usePlanningEnabled("insights");
  const views = usePlanningEnabled("views");
  const planning = projects || cycles || insights || views;
  const count = unread + (triage.data?.count ?? 0);
  const hideLabels = Platform.OS === "ios";
  const moreLabel = planning
    ? t("mobile:parity.planning.more")
    : t("mobile:nav.activity");
  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      <NativeTabs
        tintColor={c.ink}
        badgeBackgroundColor={c.info}
        backBehavior="history"
        minimizeBehavior="never"
      >
        <NativeTabs.Trigger
          name="index"
          testID="navigation-home"
          accessibilityLabel={t("mobile:nav.home")}
        >
          <NativeTabs.Trigger.Icon sf="house" md="home" />
          <NativeTabs.Trigger.Label hidden={hideLabels}>
            {t("mobile:nav.home")}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="tasks"
          testID="navigation-tasks"
          accessibilityLabel={t("mobile:nav.tasks")}
        >
          <NativeTabs.Trigger.Icon sf="scope" md="task_alt" />
          <NativeTabs.Trigger.Label hidden={hideLabels}>
            {t("mobile:nav.tasks")}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="inbox"
          testID="navigation-inbox"
          accessibilityLabel={
            count > 0
              ? t("mobile:nav.inboxUnread", { count })
              : t("mobile:nav.inbox")
          }
        >
          <NativeTabs.Trigger.Icon sf="tray" md="inbox" />
          <NativeTabs.Trigger.Label hidden={hideLabels}>
            {t("mobile:nav.inbox")}
          </NativeTabs.Trigger.Label>
          {count > 0 ? (
            <NativeTabs.Trigger.Badge>
              {count > 99 ? "99+" : String(count)}
            </NativeTabs.Trigger.Badge>
          ) : null}
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="(collections)"
          disableAutomaticContentInsets
          testID="navigation-more"
          accessibilityLabel={moreLabel}
        >
          <NativeTabs.Trigger.Icon
            sf={planning ? "square.stack" : "waveform.path"}
            md={planning ? "layers" : "timeline"}
          />
          <NativeTabs.Trigger.Label hidden={hideLabels}>
            {moreLabel}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
