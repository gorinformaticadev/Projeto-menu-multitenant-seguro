-- AlterTable
ALTER TABLE "security_config" ADD COLUMN     "emailVerificationLevel" TEXT NOT NULL DEFAULT 'SOFT',
ADD COLUMN     "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordReuseLimit" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "twoFactorRequiredForAdmins" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSuggested" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastPasswordChange" TIMESTAMP(3),
ADD COLUMN     "passwordHistory" TEXT;
