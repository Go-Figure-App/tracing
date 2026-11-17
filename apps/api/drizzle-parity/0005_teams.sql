CREATE TABLE "team_ext" (
  "team_id" text PRIMARY KEY CONSTRAINT "team_ext_team_id_team_id_fk" REFERENCES "team"("id") ON DELETE CASCADE,
  "workspace_id" text NOT NULL CONSTRAINT "team_ext_workspace_id_workspace_id_fk" REFERENCES "workspace"("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "icon" text,
  "color" text,
  "lead_id" text CONSTRAINT "team_ext_lead_id_user_id_fk" REFERENCES "user"("id") ON DELETE SET NULL,
  "archived_at" timestamp with time zone,
  "position" integer NOT NULL DEFAULT 0,
  CONSTRAINT "team_ext_key_check" CHECK ("key" ~ '^[A-Z]{2,5}$'),
  CONSTRAINT "team_ext_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "team_ext_workspace_key_idx" ON "team_ext" ("workspace_id", "key");
--> statement-breakpoint
CREATE INDEX "team_ext_lead_id_idx" ON "team_ext" ("lead_id");
--> statement-breakpoint
ALTER TABLE "project_ext" ADD COLUMN "team_id" text CONSTRAINT "project_ext_team_id_team_id_fk" REFERENCES "team"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "project_ext_team_id_idx" ON "project_ext" ("team_id");
