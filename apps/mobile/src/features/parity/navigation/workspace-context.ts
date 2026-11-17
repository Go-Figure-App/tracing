import { createContext, useContext } from "react";
import type { Workspace } from "@/lib/api/types";

export const HomeWorkspaceContext = createContext<Workspace | null>(null);

export function useHomeWorkspace() {
  const workspace = useContext(HomeWorkspaceContext);
  if (!workspace) throw new Error("Home tabs require a workspace");
  return workspace;
}
