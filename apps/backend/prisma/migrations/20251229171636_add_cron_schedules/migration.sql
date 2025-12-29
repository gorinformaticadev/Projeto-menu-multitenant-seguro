/*
  Warnings:

  - You are about to drop the `demo_activities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `demo_attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `demo_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `demo_category_relations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `demo_comments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `demo_tag_relations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `demo_tags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `demos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tenant_public_pages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "demo_activities" DROP CONSTRAINT "demo_activities_demoId_fkey";

-- DropForeignKey
ALTER TABLE "demo_attachments" DROP CONSTRAINT "demo_attachments_demoId_fkey";

-- DropForeignKey
ALTER TABLE "demo_category_relations" DROP CONSTRAINT "demo_category_relations_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "demo_category_relations" DROP CONSTRAINT "demo_category_relations_demoId_fkey";

-- DropForeignKey
ALTER TABLE "demo_comments" DROP CONSTRAINT "demo_comments_demoId_fkey";

-- DropForeignKey
ALTER TABLE "demo_comments" DROP CONSTRAINT "demo_comments_parentId_fkey";

-- DropForeignKey
ALTER TABLE "demo_tag_relations" DROP CONSTRAINT "demo_tag_relations_demoId_fkey";

-- DropForeignKey
ALTER TABLE "demo_tag_relations" DROP CONSTRAINT "demo_tag_relations_tagId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_public_pages" DROP CONSTRAINT "tenant_public_pages_tenantId_fkey";

-- DropTable
DROP TABLE "demo_activities";

-- DropTable
DROP TABLE "demo_attachments";

-- DropTable
DROP TABLE "demo_categories";

-- DropTable
DROP TABLE "demo_category_relations";

-- DropTable
DROP TABLE "demo_comments";

-- DropTable
DROP TABLE "demo_tag_relations";

-- DropTable
DROP TABLE "demo_tags";

-- DropTable
DROP TABLE "demos";

-- DropTable
DROP TABLE "tenant_public_pages";

-- DropEnum
DROP TYPE "DemoStatus";

-- CreateTable
CREATE TABLE "cron_schedules" (
    "id" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "modulo" TEXT,
    "identificador" TEXT NOT NULL,
    "descricao" TEXT,
    "expressao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "editavel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cron_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cron_schedules_modulo_identificador_key" ON "cron_schedules"("modulo", "identificador");
