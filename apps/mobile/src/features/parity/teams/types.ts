export type Team = {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string;
  icon: string | null;
  color: string | null;
  leadId: string | null;
  archivedAt: string | null;
  position: number;
  memberCount: number;
  projectCount: number;
};
