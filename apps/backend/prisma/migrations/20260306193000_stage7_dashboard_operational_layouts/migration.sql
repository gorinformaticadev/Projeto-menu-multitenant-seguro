CREATE TABLE IF NOT EXISTS "dashboard_layouts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "layoutJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "filtersJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dashboard_layouts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_layouts_userId_role_key"
  ON "dashboard_layouts"("userId", "role");

CREATE INDEX IF NOT EXISTS "dashboard_layouts_userId_idx"
  ON "dashboard_layouts"("userId");

CREATE INDEX IF NOT EXISTS "dashboard_layouts_role_idx"
  ON "dashboard_layouts"("role");

CREATE INDEX IF NOT EXISTS "dashboard_layouts_updatedAt_idx"
  ON "dashboard_layouts"("updatedAt");
