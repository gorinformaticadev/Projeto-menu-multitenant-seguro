/*
  Warnings:

  - You are about to drop the column `auth_method` on the `email_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `email_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `email_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `email_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `provider_name` on the `email_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `smtp_host` on the `email_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `smtp_port` on the `email_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `email_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `email_configurations` table. All the data in the column will be lost.
  - Added the required column `authMethod` to the `email_configurations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerName` to the `email_configurations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `smtpHost` to the `email_configurations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `smtpPort` to the `email_configurations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `email_configurations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "email_configurations" DROP COLUMN "auth_method",
DROP COLUMN "created_at",
DROP COLUMN "created_by",
DROP COLUMN "is_active",
DROP COLUMN "provider_name",
DROP COLUMN "smtp_host",
DROP COLUMN "smtp_port",
DROP COLUMN "updated_at",
DROP COLUMN "updated_by",
ADD COLUMN     "authMethod" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providerName" TEXT NOT NULL,
ADD COLUMN     "smtpHost" TEXT NOT NULL,
ADD COLUMN     "smtpPort" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" TEXT;
