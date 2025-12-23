-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER', 'CLIENT');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('detected', 'installed', 'db_ready', 'active', 'disabled');

-- CreateEnum
CREATE TYPE "MigrationType" AS ENUM ('migration', 'seed');

-- CreateEnum
CREATE TYPE "DemoStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cnpjCpf" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "nomeResponsavel" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "logoUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "tenantId" TEXT,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),
    "passwordHistory" TEXT,
    "lastPasswordChange" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "lastFailedLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_config" (
    "id" TEXT NOT NULL,
    "loginMaxAttempts" INTEGER NOT NULL DEFAULT 5,
    "loginLockDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "loginWindowMinutes" INTEGER NOT NULL DEFAULT 1,
    "globalMaxRequests" INTEGER NOT NULL DEFAULT 100,
    "globalWindowMinutes" INTEGER NOT NULL DEFAULT 1,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "passwordRequireUppercase" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireLowercase" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireNumbers" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireSpecial" BOOLEAN NOT NULL DEFAULT true,
    "accessTokenExpiresIn" TEXT NOT NULL DEFAULT '15m',
    "refreshTokenExpiresIn" TEXT NOT NULL DEFAULT '7d',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorRequired" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorRequiredForAdmins" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSuggested" BOOLEAN NOT NULL DEFAULT true,
    "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationLevel" TEXT NOT NULL DEFAULT 'SOFT',
    "passwordReuseLimit" INTEGER NOT NULL DEFAULT 5,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
    "smtpUsername" TEXT,
    "smtpPassword" TEXT,
    "platformName" TEXT DEFAULT 'Sistema Multitenant',
    "platformEmail" TEXT,
    "platformPhone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "security_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_configurations" (
    "id" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL,
    "encryption" TEXT NOT NULL,
    "authMethod" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "appVersion" TEXT DEFAULT '1.0.0',
    "gitToken" TEXT,
    "gitUsername" TEXT,
    "gitRepository" TEXT,
    "gitReleaseBranch" TEXT NOT NULL DEFAULT 'main',
    "packageManager" TEXT NOT NULL DEFAULT 'npm',
    "updateCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdateCheck" TIMESTAMP(3),
    "availableVersion" TEXT,
    "updateAvailable" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "update_logs" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "packageManager" TEXT NOT NULL DEFAULT 'npm',
    "backupPath" TEXT,
    "errorMessage" TEXT,
    "rollbackReason" TEXT,
    "executedBy" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "executionLogs" TEXT,

    CONSTRAINT "update_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "description" TEXT,
    "status" "ModuleStatus" NOT NULL DEFAULT 'detected',
    "hasBackend" BOOLEAN NOT NULL DEFAULT false,
    "hasFrontend" BOOLEAN NOT NULL DEFAULT false,
    "installedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_menus" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "route" TEXT NOT NULL,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "permission" TEXT,
    "isUserMenu" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_tenant" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_migrations" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "type" "MigrationType" NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "module" TEXT,
    "tenantId" TEXT,
    "userId" TEXT,
    "context" TEXT,
    "data" TEXT NOT NULL DEFAULT '{}',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_public_pages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Página Institucional',
    "subtitle" TEXT,
    "description" TEXT,
    "content" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "contactInfo" TEXT,
    "socialLinks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_public_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "status" "DemoStatus" NOT NULL DEFAULT 'draft',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "demos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_tags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_category_relations" (
    "demoId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_category_relations_pkey" PRIMARY KEY ("demoId","categoryId")
);

-- CreateTable
CREATE TABLE "demo_tag_relations" (
    "demoId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_tag_relations_pkey" PRIMARY KEY ("demoId","tagId")
);

-- CreateTable
CREATE TABLE "demo_attachments" (
    "id" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_comments" (
    "id" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,
    "parentId" TEXT,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "demo_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_activities" (
    "id" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "changes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_email_key" ON "tenants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_cnpjCpf_key" ON "tenants"("cnpjCpf");

-- CreateIndex
CREATE INDEX "tenants_ativo_idx" ON "tenants"("ativo");

-- CreateIndex
CREATE INDEX "tenants_createdAt_idx" ON "tenants"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_isLocked_idx" ON "users"("isLocked");

-- CreateIndex
CREATE INDEX "users_tenantId_role_idx" ON "users"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_expiresAt_idx" ON "refresh_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_usedAt_idx" ON "password_reset_tokens"("usedAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_action_createdAt_idx" ON "audit_logs"("tenantId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_action_createdAt_idx" ON "audit_logs"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "update_logs_status_idx" ON "update_logs"("status");

-- CreateIndex
CREATE INDEX "update_logs_startedAt_idx" ON "update_logs"("startedAt");

-- CreateIndex
CREATE INDEX "update_logs_version_idx" ON "update_logs"("version");

-- CreateIndex
CREATE INDEX "update_logs_executedBy_idx" ON "update_logs"("executedBy");

-- CreateIndex
CREATE UNIQUE INDEX "modules_slug_key" ON "modules"("slug");

-- CreateIndex
CREATE INDEX "modules_status_idx" ON "modules"("status");

-- CreateIndex
CREATE INDEX "modules_slug_idx" ON "modules"("slug");

-- CreateIndex
CREATE INDEX "module_menus_moduleId_idx" ON "module_menus"("moduleId");

-- CreateIndex
CREATE INDEX "module_menus_parentId_idx" ON "module_menus"("parentId");

-- CreateIndex
CREATE INDEX "module_menus_order_idx" ON "module_menus"("order");

-- CreateIndex
CREATE INDEX "module_tenant_tenantId_idx" ON "module_tenant"("tenantId");

-- CreateIndex
CREATE INDEX "module_tenant_moduleId_idx" ON "module_tenant"("moduleId");

-- CreateIndex
CREATE INDEX "module_tenant_enabled_idx" ON "module_tenant"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "module_tenant_moduleId_tenantId_key" ON "module_tenant"("moduleId", "tenantId");

-- CreateIndex
CREATE INDEX "module_migrations_moduleId_idx" ON "module_migrations"("moduleId");

-- CreateIndex
CREATE INDEX "module_migrations_type_idx" ON "module_migrations"("type");

-- CreateIndex
CREATE INDEX "module_migrations_executedAt_idx" ON "module_migrations"("executedAt");

-- CreateIndex
CREATE UNIQUE INDEX "module_migrations_moduleId_filename_type_key" ON "module_migrations"("moduleId", "filename", "type");

-- CreateIndex
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_audience_idx" ON "notifications"("audience");

-- CreateIndex
CREATE INDEX "notifications_severity_idx" ON "notifications"("severity");

-- CreateIndex
CREATE INDEX "notifications_source_idx" ON "notifications"("source");

-- CreateIndex
CREATE INDEX "notifications_module_idx" ON "notifications"("module");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_tenantId_audience_read_idx" ON "notifications"("tenantId", "audience", "read");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_public_pages_tenantId_key" ON "tenant_public_pages"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_public_pages_tenantId_idx" ON "tenant_public_pages"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_public_pages_isActive_idx" ON "tenant_public_pages"("isActive");

-- CreateIndex
CREATE INDEX "demos_tenantId_idx" ON "demos"("tenantId");

-- CreateIndex
CREATE INDEX "demos_status_idx" ON "demos"("status");

-- CreateIndex
CREATE INDEX "demos_createdAt_idx" ON "demos"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "demos_createdBy_idx" ON "demos"("createdBy");

-- CreateIndex
CREATE INDEX "demos_deletedAt_idx" ON "demos"("deletedAt");

-- CreateIndex
CREATE INDEX "demo_categories_tenantId_idx" ON "demo_categories"("tenantId");

-- CreateIndex
CREATE INDEX "demo_categories_slug_idx" ON "demo_categories"("slug");

-- CreateIndex
CREATE INDEX "demo_categories_isActive_idx" ON "demo_categories"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "demo_categories_tenantId_slug_key" ON "demo_categories"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "demo_tags_tenantId_idx" ON "demo_tags"("tenantId");

-- CreateIndex
CREATE INDEX "demo_tags_slug_idx" ON "demo_tags"("slug");

-- CreateIndex
CREATE INDEX "demo_tags_usageCount_idx" ON "demo_tags"("usageCount" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "demo_tags_tenantId_slug_key" ON "demo_tags"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "demo_category_relations_demoId_idx" ON "demo_category_relations"("demoId");

-- CreateIndex
CREATE INDEX "demo_category_relations_categoryId_idx" ON "demo_category_relations"("categoryId");

-- CreateIndex
CREATE INDEX "demo_tag_relations_demoId_idx" ON "demo_tag_relations"("demoId");

-- CreateIndex
CREATE INDEX "demo_tag_relations_tagId_idx" ON "demo_tag_relations"("tagId");

-- CreateIndex
CREATE INDEX "demo_attachments_demoId_idx" ON "demo_attachments"("demoId");

-- CreateIndex
CREATE INDEX "demo_attachments_mimeType_idx" ON "demo_attachments"("mimeType");

-- CreateIndex
CREATE INDEX "demo_comments_demoId_idx" ON "demo_comments"("demoId");

-- CreateIndex
CREATE INDEX "demo_comments_userId_idx" ON "demo_comments"("userId");

-- CreateIndex
CREATE INDEX "demo_comments_parentId_idx" ON "demo_comments"("parentId");

-- CreateIndex
CREATE INDEX "demo_comments_createdAt_idx" ON "demo_comments"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "demo_activities_demoId_idx" ON "demo_activities"("demoId");

-- CreateIndex
CREATE INDEX "demo_activities_userId_idx" ON "demo_activities"("userId");

-- CreateIndex
CREATE INDEX "demo_activities_action_idx" ON "demo_activities"("action");

-- CreateIndex
CREATE INDEX "demo_activities_createdAt_idx" ON "demo_activities"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_menus" ADD CONSTRAINT "module_menus_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_menus" ADD CONSTRAINT "module_menus_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "module_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_tenant" ADD CONSTRAINT "module_tenant_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_tenant" ADD CONSTRAINT "module_tenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_migrations" ADD CONSTRAINT "module_migrations_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_public_pages" ADD CONSTRAINT "tenant_public_pages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_category_relations" ADD CONSTRAINT "demo_category_relations_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "demos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_category_relations" ADD CONSTRAINT "demo_category_relations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "demo_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_tag_relations" ADD CONSTRAINT "demo_tag_relations_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "demos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_tag_relations" ADD CONSTRAINT "demo_tag_relations_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "demo_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_attachments" ADD CONSTRAINT "demo_attachments_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "demos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_comments" ADD CONSTRAINT "demo_comments_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "demos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_comments" ADD CONSTRAINT "demo_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "demo_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_activities" ADD CONSTRAINT "demo_activities_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "demos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
