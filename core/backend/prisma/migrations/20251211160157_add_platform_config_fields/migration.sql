/*
  Warnings:

  - You are about to drop the `smtp_credentials` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "security_config" ADD COLUMN     "platformEmail" TEXT,
ADD COLUMN     "platformName" TEXT DEFAULT 'Sistema Multitenant',
ADD COLUMN     "platformPhone" TEXT;

-- DropTable
DROP TABLE "smtp_credentials";
