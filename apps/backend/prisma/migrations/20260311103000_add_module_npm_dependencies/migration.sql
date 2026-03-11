-- Expand module status lifecycle for dependency-driven installation
ALTER TYPE "ModuleStatus" ADD VALUE IF NOT EXISTS 'uploaded';
ALTER TYPE "ModuleStatus" ADD VALUE IF NOT EXISTS 'pending_dependencies';
ALTER TYPE "ModuleStatus" ADD VALUE IF NOT EXISTS 'dependencies_installed';
ALTER TYPE "ModuleStatus" ADD VALUE IF NOT EXISTS 'dependency_conflict';
ALTER TYPE "ModuleStatus" ADD VALUE IF NOT EXISTS 'ready';

-- Create enum for NPM dependency target
DO $$
BEGIN
  CREATE TYPE "ModuleNpmDependencyTarget" AS ENUM ('backend', 'frontend');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for NPM dependency status
DO $$
BEGIN
  CREATE TYPE "ModuleNpmDependencyStatus" AS ENUM ('pending', 'installed', 'conflict');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Track NPM dependencies declared by each module
CREATE TABLE IF NOT EXISTS "module_npm_dependencies" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "moduleSlug" TEXT NOT NULL,
  "packageName" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "target" "ModuleNpmDependencyTarget" NOT NULL,
  "status" "ModuleNpmDependencyStatus" NOT NULL DEFAULT 'pending',
  "note" TEXT,
  "createdBy" TEXT,
  "installedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "module_npm_dependencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "module_npm_dependencies_moduleId_packageName_target_key"
  ON "module_npm_dependencies"("moduleId", "packageName", "target");

CREATE INDEX IF NOT EXISTS "module_npm_dependencies_moduleSlug_idx"
  ON "module_npm_dependencies"("moduleSlug");

CREATE INDEX IF NOT EXISTS "module_npm_dependencies_status_idx"
  ON "module_npm_dependencies"("status");

CREATE INDEX IF NOT EXISTS "module_npm_dependencies_target_idx"
  ON "module_npm_dependencies"("target");

DO $$
BEGIN
  ALTER TABLE "module_npm_dependencies"
    ADD CONSTRAINT "module_npm_dependencies_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "modules"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
