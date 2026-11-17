import { TeamsNavigation } from "@/components/parity/teams/navigation";
import { useLocation } from "@tanstack/react-router";
import type * as React from "react";
import { useEffect } from "react";

import { usePlanningEnabled } from "@/components/parity/planning/queries";
import { PlanningNavigation } from "@/components/parity/navigation/planning-navigation";
import { UserAvatar } from "@/components/user-avatar";
import { FavoritesNavigation } from "@/components/parity/views/favorites-navigation";
import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavSecondary } from "@/components/nav-secondary";
import { ThemeToggleDropdown } from "@/components/theme-toggle-dropdown";
import { TrialCard } from "@/components/trial-card";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { VersionDisplay } from "@/components/version-display";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const planning = usePlanningEnabled("projects");
  const { setOpenMobile } = useSidebar();
  const pathname = useLocation({ select: (location) => location.pathname });

  // Navigation that doesn't start from a sidebar link (creating a project,
  // the command palette) must still dismiss the mobile drawer.
  useEffect(() => {
    if (pathname) setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar
      collapsible="offcanvas"
      variant="inset"
      className="border-none"
      {...props}
    >
      <SidebarHeader className="pt-1 pb-1.5">
        <WorkspaceSwitcher planning={planning} />
      </SidebarHeader>
      <SidebarContent
        className={
          planning ? "overflow-y-auto gap-0 py-1" : "overflow-hidden gap-1 py-1"
        }
      >
        {planning ? (
          <>
            <PlanningNavigation />
            <TeamsNavigation />
          </>
        ) : (
          <>
            <NavMain />
            <FavoritesNavigation />
            <NavProjects />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavSecondary />
        <TrialCard />
        <div className="flex items-center justify-between">
          {planning && <UserAvatar />}
          <VersionDisplay />
          <ThemeToggleDropdown />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
