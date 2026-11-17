import { Link, useLocation } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function NavigationLink({
  title,
  href,
  icon: Icon,
  count,
  exact = false,
}: {
  title: string;
  href: string;
  icon: LucideIcon;
  count?: number;
  exact?: boolean;
}) {
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/+$/, ""),
  });
  const active =
    pathname === href || (!exact && pathname.startsWith(`${href}/`));
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={title}
        className="h-7 gap-2 rounded-md data-[active=true]:bg-none data-[active=true]:bg-sidebar-accent data-[active=true]:shadow-none text-[13px] font-normal [&>svg]:size-3.5"
        render={<Link to={href} aria-current={active ? "page" : undefined} />}
      >
        <Icon aria-hidden="true" />
        <span>{title}</span>
        {count ? (
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
