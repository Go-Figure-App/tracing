import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { SidebarGroup } from "@/components/ui/sidebar";

export function NavigationSection({
  title,
  storageKey,
  children,
}: {
  title: ReactNode;
  storageKey: string;
  children: ReactNode;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) !== "closed";
    } catch {
      return true;
    }
  });
  return (
    <SidebarGroup className="px-3 py-2">
      <button
        type="button"
        className="mb-1 flex h-7 w-fit max-w-full items-center gap-1 rounded px-2 text-xs text-sidebar-foreground/70 outline-none hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen(!open);
          try {
            sessionStorage.setItem(storageKey, open ? "closed" : "open");
          } catch {
            /* Navigation still works when storage is unavailable. */
          }
        }}
      >
        {title}
        <ChevronDown
          aria-hidden="true"
          className={`size-3 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      <div id={panelId} hidden={!open}>
        {children}
      </div>
    </SidebarGroup>
  );
}
