-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('study', 'work', 'exercise', 'meal', 'sleep', 'leisure', 'chore', 'social', 'other');

-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ActivityCategory" NOT NULL DEFAULT 'other',
    "notes" TEXT,
    "daysOfWeek" INTEGER[],
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "isolation" BOOLEAN NOT NULL DEFAULT false,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderLeadMin" INTEGER NOT NULL DEFAULT 5,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableAllowedTarget" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "appOrSite" TEXT NOT NULL,
    "kind" "ScreenTargetKind" NOT NULL DEFAULT 'url',
    "label" TEXT,

    CONSTRAINT "TimetableAllowedTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimetableEntry_userId_idx" ON "TimetableEntry"("userId");

-- CreateIndex
CREATE INDEX "TimetableAllowedTarget_entryId_idx" ON "TimetableAllowedTarget"("entryId");

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableAllowedTarget" ADD CONSTRAINT "TimetableAllowedTarget_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TimetableEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
