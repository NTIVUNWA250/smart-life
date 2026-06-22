-- CreateEnum
CREATE TYPE "ScreenTargetKind" AS ENUM ('app', 'url');

-- AlterTable: distinguish app vs website targets and carry a display label
ALTER TABLE "ScreenTimePolicy" ADD COLUMN "kind" "ScreenTargetKind" NOT NULL DEFAULT 'url';
ALTER TABLE "ScreenTimePolicy" ADD COLUMN "label" TEXT;
