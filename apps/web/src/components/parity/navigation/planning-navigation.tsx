import {
  Box,
  ChartNoAxesCombined,
  Flag,
  GanttChart,
  House,
  Inbox,
  Layers,
  ListTodo,
  Mail,
  ScanLine,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import { usePendingInvitations } from "@/hooks/queries/invitation/use-pending-invitations";
import { useTriageCount } from "../triage/queries";
import { usePlanningEnabled } from "../planning/queries";
import { FavoritesNavigation } from "../views/favorites-navigation";
import { CycleNavigation } from "../cycles/navigation";
import { NavigationLink } from "./navigation-link";
import { NavigationSection } from "./navigation-section";

export function PlanningNavigation() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: notifications = [] } = useGetNotifications(workspace?.id);
  const { data: invitations = [] } = usePendingInvitations();
  const triage = useTriageCount(workspace?.id);
  const initiatives = usePlanningEnabled("initiatives");
  const views = usePlanningEnabled("views");
  const roadmap = usePlanningEnabled("roadmap");
  const insights = usePlanningEnabled("insights");
  if (!workspace) return null;
  const base = `/dashboard/workspace/${workspace.id}`;
  return (
    <>
      <SidebarGroup className="px-3 pt-1 pb-3">
        <SidebarMenu className="gap-0.5">
          <NavigationLink
            title={t("navigation:sidebar.inbox")}
            icon={Inbox}
            href={`${base}/inbox`}
            count={notifications.filter((item) => !item.isRead).length}
          />
          <NavigationLink
            title={t("parity:navigation.myIssues")}
            icon={ScanLine}
            href={`${base}/my-tasks`}
          />
          {invitations.length > 0 && (
            <NavigationLink
              title={t("navigation:sidebar.invitations")}
              icon={Mail}
              href="/dashboard/invitations"
              count={invitations.length}
            />
          )}
        </SidebarMenu>
      </SidebarGroup>
      <FavoritesNavigation />
      <NavigationSection
        key={`${workspace.id}:planning`}
        storageKey={`tracing:sidebar:${workspace.id}:planning`}
        title={t("parity:views.workspace")}
      >
        <SidebarMenu className="gap-0.5">
          {initiatives && (
            <NavigationLink
              title={t("parity:planning.initiatives")}
              icon={Flag}
              href={`${base}/initiatives`}
            />
          )}
          <NavigationLink
            title={t("parity:planning.projects")}
            icon={Box}
            href={`${base}/projects`}
          />
          {views && (
            <NavigationLink
              title={t("parity:views.title")}
              icon={Layers}
              href={`${base}/views`}
            />
          )}
        </SidebarMenu>
      </NavigationSection>
      <NavigationSection
        key={`${workspace.id}:work`}
        storageKey={`tracing:sidebar:${workspace.id}:work`}
        title={
          <>
            <span
              aria-hidden="true"
              className="flex size-4 shrink-0 items-center justify-center rounded bg-sidebar-accent text-[9px] font-semibold"
            >
              {workspace.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="truncate">{workspace.name}</span>
          </>
        }
      >
        <SidebarMenu className="gap-0.5 pl-4">
          <NavigationLink
            title={t("navigation:sidebar.home")}
            icon={House}
            href={base}
            exact
          />
          {triage.enabled && (
            <NavigationLink
              title={t("parity:triage.title")}
              icon={Inbox}
              href={`${base}/triage`}
              count={triage.data?.count}
            />
          )}
          {views && (
            <NavigationLink
              title={t("parity:cycles.tasks")}
              icon={ListTodo}
              href={`${base}/issues`}
            />
          )}
          <CycleNavigation workspaceId={workspace.id} expanded compact />
        </SidebarMenu>
      </NavigationSection>
      <NavigationSection
        key={`${workspace.id}:more`}
        storageKey={`tracing:sidebar:${workspace.id}:more`}
        title={t("navigation:sidebar.more")}
      >
        <SidebarMenu className="gap-0.5">
          {roadmap && (
            <NavigationLink
              title={t("parity:roadmap.title")}
              icon={GanttChart}
              href={`${base}/roadmap`}
            />
          )}
          {insights && (
            <NavigationLink
              title={t("parity:insights.title")}
              icon={ChartNoAxesCombined}
              href={`${base}/insights`}
            />
          )}
          <NavigationLink
            title={t("navigation:sidebar.members")}
            icon={Users}
            href={`${base}/members`}
          />
        </SidebarMenu>
      </NavigationSection>
    </>
  );
}
