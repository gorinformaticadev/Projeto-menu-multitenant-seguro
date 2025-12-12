-- AlterTable
ALTER TABLE "security_config" ADD COLUMN     "smtpPassword" TEXT,
ADD COLUMN     "smtpUsername" TEXT;

-- CreateTable
CREATE TABLE "smtp_credentials" (
    "id" TEXT NOT NULL,
    "smtpUser" TEXT NOT NULL,
    "smtpPass" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smtp_credentials_pkey" PRIMARY KEY ("id")
);
