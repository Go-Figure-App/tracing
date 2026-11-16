import { Link } from "@tanstack/react-router";
import { PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectDetails } from "@/components/parity/planning/project-details";
import { FavoriteButton } from "@/components/parity/views/favorite-button";
import { usePlanningEnabled } from "@/components/parity/planning/queries";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import MobileProjectNav from "@/components/common/header/mobile-project-nav";
import ProjectCrumbSelect from "@/components/common/header/project-crumb-select";
import WorkspaceCrumbSelect from "@/components/common/header/workspace-crumb-select";
import Layout from "@/components/common/layout";
import { ProjectScopeToggle } from "@/components/project/views/project-scope-toggle";
import {
  PROJECT_ROUTE_PATHS,
  type ProjectRoute,
  resolveProjectView,
} from "@/components/project/views/project-views";
import { useGoToProjectView } from "@/components/project/views/use-go-to-project-view";
import { useProjectViewShortcuts } from "@/components/project/views/use-project-view-shortcuts";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useGetProject from "@/hooks/queries/project/use-get-project";
import { useProjectWebSocket } from "@/hooks/use-project-websocket";
import { cn } from "@/lib/cn";
import { getProjectUnavailableReason } from "@/lib/project-unavailable-reason";
import { useBackgroundStore } from "@/store/background";
import { useUserPreferencesStore } from "@/store/user-preferences";
import ProjectUnavailable from "./project-unavailable";
import { ProjectPlanningNav } from "@/components/parity/planning/project-nav";

type ProjectLayoutProps = {
  projectId: string;
  workspaceId: string;
  toolbar?: ReactNode;
  summary?: ReactNode;
  filterBar?: ReactNode;
  children: ReactNode;
  showViewSwitcher?: boolean;
  activeView?: ProjectRoute;
};

export default function ProjectLayout({
  projectId,
  workspaceId,
  toolbar,
  summary,
  filterBar,
  children,
  showViewSwitcher = true,
  activeView,
}: ProjectLayoutProps) {
  const { t } = useTranslation();
  const planning = usePlanningEnabled("projects");
  const detailsKey = `tracing:project-details:${workspaceId}`;
  const [detailsOpen, setDetailsOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem(detailsKey);
      if (saved !== null) return saved === "open";
    } catch {
      /* Keep the default if preference storage is unavailable. */
    }
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1280px)").matches
    );
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { data: project, error: projectError } = useGetProject({
    id: projectId,
    workspaceId,
  });
  const unavailableReason = getProjectUnavailableReason(projectError);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false);
  const { background } = useBackgroundStore();
  const viewMode = useUserPreferencesStore((state) => state.viewMode);

  useProjectWebSocket(unavailableReason ? "" : projectId);

  const resolvedRoute: ProjectRoute =
    activeView ??
    (location.pathname.includes("/backlog")
      ? "backlog"
      : location.pathname.includes("/calendar")
        ? "calendar"
        : location.pathname.includes("/gantt")
          ? "gantt"
          : "board");
  const currentView = resolveProjectView(resolvedRoute, viewMode);
  const showViews = showViewSwitcher && !unavailableReason;

  const goToView = useGoToProjectView({
    workspaceId,
    projectId,
    currentRoute: resolvedRoute,
  });
  useProjectViewShortcuts(goToView, currentView, showViews);

  const handleProjectSwitch = (nextProjectId: string) => {
    if (location.pathname.endsWith("/updates")) {
      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/updates",
        params: { workspaceId, projectId: nextProjectId },
      });
      return;
    }
    if (location.pathname.endsWith("/overview")) {
      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/overview",
        params: { workspaceId, projectId: nextProjectId },
      });
      return;
    }
    navigate({
      to: PROJECT_ROUTE_PATHS[resolvedRoute],
      params: {
        workspaceId,
        projectId: nextProjectId,
      },
    });
  };

  return (
    <>
      <Layout.Header
        className={cn("h-11 border-border/80 px-2", {
          "bg-card/90 backdrop-blur": !!background,
        })}
      >
        <div className="flex w-full min-w-0 items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="-ml-1 h-7 w-7 shrink-0 cursor-pointer text-foreground/85 hover:text-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="flex items-center gap-2 text-[10px]">
                  {t("navigation:settingsLayout.toggleSidebar")}
                  <ShortcutKeys id="toggleSidebar" />
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="h-4 w-px shrink-0 bg-border/80" />

          <div className="hidden min-w-0 items-center gap-1 md:flex">
            <WorkspaceCrumbSelect />
            <span className="text-foreground/30 text-xs">/</span>
            <ProjectCrumbSelect
              workspaceId={workspaceId}
              projectId={projectId}
              projectName={project?.name}
              onSelectProject={handleProjectSwitch}
              onAddProject={() => setIsCreateProjectModalOpen(true)}
            />
          </div>

          {planning && !unavailableReason && (
            <FavoriteButton
              workspaceId={workspaceId}
              kind="project"
              targetId={projectId}
            />
          )}
          <div className="min-w-0 md:hidden">
            <MobileProjectNav
              workspaceId={workspaceId}
              projectId={projectId}
              projectName={project?.name}
              onSelectProject={handleProjectSwitch}
              onAddProject={() => setIsCreateProjectModalOpen(true)}
            />
          </div>
        </div>
      </Layout.Header>

      {unavailableReason ? null : (
        <TooltipProvider>
          <div
            className={cn(
              "flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-border/80 border-b px-2 py-1 sm:px-3",
              { "bg-card/80 backdrop-blur": !!background },
            )}
          >
            <ProjectPlanningNav
              workspaceId={workspaceId}
              projectId={projectId}
            />
            {showViewSwitcher && !planning && (
              <ProjectScopeToggle
                workspaceId={workspaceId}
                projectId={projectId}
                currentView={currentView}
                onSelect={goToView}
              />
            )}
            {summary}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {planning && showViewSwitcher && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  render={
                    <Link
                      to="/dashboard/workspace/$workspaceId/project/$projectId/backlog"
                      params={{ workspaceId, projectId }}
                    />
                  }
                  aria-current={
                    resolvedRoute === "backlog" ? "page" : undefined
                  }
                >
                  {t("tasks:view.backlog")}
                </Button>
              )}
              {toolbar}
              {planning && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={t(
                    detailsOpen
                      ? "parity:planning.hideDetails"
                      : "parity:planning.showDetails",
                  )}
                  aria-expanded={detailsOpen}
                  aria-controls="project-details"
                  onClick={() => {
                    setDetailsOpen(!detailsOpen);
                    try {
                      sessionStorage.setItem(
                        detailsKey,
                        detailsOpen ? "closed" : "open",
                      );
                    } catch {
                      /* The panel still toggles without storage. */
                    }
                  }}
                >
                  <PanelRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <div className={cn({ "bg-card/80 backdrop-blur": !!background })}>
            {filterBar}
          </div>
        </TooltipProvider>
      )}

      <Layout.Content>
        {unavailableReason ? (
          <ProjectUnavailable
            reason={unavailableReason}
            workspaceId={workspaceId}
          />
        ) : (
          <div className="flex h-full min-h-0 min-w-0">
            <div
              className={cn(
                "h-full min-w-0 flex-1",
                planning && detailsOpen && "hidden xl:block",
              )}
            >
              {children}
            </div>
            {planning && detailsOpen && (
              <aside
                id="project-details"
                aria-label={t("parity:planning.properties")}
                className="h-full w-full shrink-0 overflow-y-auto border-l border-border/60 bg-background xl:w-80"
              >
                <ProjectDetails
                  key={projectId}
                  workspaceId={workspaceId}
                  projectId={projectId}
                />
              </aside>
            )}
          </div>
        )}
      </Layout.Content>

      <CreateProjectModal
        open={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
      />
    </>
  );
}
